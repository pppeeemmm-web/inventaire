# Broadcast — production checklist and middleware (Make / n8n)

Canonical feature summary: [BROADCAST_PHASE2_COMPLETE.md](./BROADCAST_PHASE2_COMPLETE.md).

## 1. Production database

Apply the same migration as dev if not already on production:

- File: [supabase/sql/broadcast_phase2.sql](../supabase/sql/broadcast_phase2.sql) (idempotent).
- Prerequisite: [supabase/sql/oeuvre_broadcasts.sql](../supabase/sql/oeuvre_broadcasts.sql) (Phase 1) must already exist.

**Verify in Supabase SQL editor (production):**

```sql
-- Column on Oeuvres
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'Oeuvres' and column_name = 'broadcast_caption_seed';

-- Extended oeuvre_broadcasts
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'oeuvre_broadcasts'
  and column_name in ('status', 'queued_at', 'attempt_count', 'external_url', 'caption_final');

-- Events table
select to_regclass('public.broadcast_events');
```

Expect: `broadcast_caption_seed` present; all five columns on `oeuvre_broadcasts`; `broadcast_events` non-null.

## 2. Vercel and secrets

- Set **`INVENTORY_BROADCAST_SECRET`** on the Vercel project (Production and Preview if previews should call the API).
- Use a long random value; store the same value in Make/n8n as the Bearer token.
- **Rotation:** generate a new secret in Vercel, update Make scenarios, deploy, then remove the old value from any stale env copies. Middleware calls fail closed with `401` if the secret mismatches.

Auth header options (see [lib/inventory-broadcast-secret.ts](../lib/inventory-broadcast-secret.ts)):

- `Authorization: Bearer <secret>` (case-insensitive `Bearer`), or
- `x-inventory-broadcast-secret: <secret>` (if the client strips `Authorization`).

## 3. Make.com / n8n scenario (recommended flow)

Base URL: `https://<your-deployment-host>` (no trailing slash).

All routes require the secret above. Responses are JSON.

### Step A — Pull work batch

`GET /api/inventory/broadcast/feed?platform=<slug>`

- `platform`: lowercase alphanumeric slug, e.g. `instagram`, `linkedin` (must match what you use in queue/confirm/event).
- **200:** `{ platform, count, items }` where each `items[]` entry includes `oeuvreId`, dimensions, technique/support labels, image URLs, and **`captionSeed`** (nullable string from Atelier).
- **503:** secret not configured on the server.

### Step B — Lock each item before processing

`POST /api/inventory/broadcast/queue`  
Body (JSON): `{ "oeuvreId": <number>, "platform": "<slug>" }`  
(PascalCase `OeuvreID` / `Platform` also accepted.)

- Work must still be eligible (public, `broadcast_ready`, cover image, not deleted).
- **200:** row set to `queued`; item disappears from feed for ~30 minutes (stuck recovery window).
- **409:** already posted on that platform — skip or branch in Make.

### Step C — AI caption and Buffer (outside this app)

Use `captionSeed` plus feed fields in your own AI module; push to Buffer (or similar) as **draft** for human approval. This repository does not generate captions.

### Step D — Confirm after publish

`POST /api/inventory/broadcast/confirm`  
Body (JSON), camelCase or PascalCase:

```json
{
  "oeuvreId": 1234,
  "platform": "instagram",
  "externalUrl": "https://www.instagram.com/p/…",
  "captionFinal": "Final caption text as posted (optional but recommended)"
}
```

- **200:** transitions `queued` → `posted` or inserts a fresh posted row.
- **409:** already posted for that platform.

Optional: `externalPostId`, `metadata` object — see [app/api/inventory/broadcast/confirm/route.ts](../app/api/inventory/broadcast/confirm/route.ts).

### Step E — Optional activity log

`POST /api/inventory/broadcast/event`  
Body (JSON):

- `platform` (required)
- `eventType`: one of `queued`, `posted`, `comment`, `engagement`, `error`, `note`
- `priority`: `vip` or `normal` (default `normal`) — VIP rows surface in Atelier **Activité** with filter on by default
- Optional: `oeuvreId`, `summary`, `externalUrl`, `payload` (object)

VIP tagging and Slack routing stay in middleware; the app only stores and displays events.

## 4. Smoke test (curl)

Replace `HOST`, `SECRET`, and a real eligible `oeuvreId`.

```bash
curl -sS -H "Authorization: Bearer SECRET" "HOST/api/inventory/broadcast/feed?platform=instagram" | head -c 500
curl -sS -H "Authorization: Bearer SECRET" -H "Content-Type: application/json" \
  -d '{"oeuvreId":9999,"platform":"instagram"}' "HOST/api/inventory/broadcast/queue"
```

## 5. Atelier UI

Admins: `/atelier?tab=broadcast` — Queue / Publiés / Activité. Editors see the admin-only message (no data).
