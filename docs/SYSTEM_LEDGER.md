# System Ledger

**Location:** Atelier → **System** tab (`components/atelier/SystemTab.tsx`)

**Purpose:** Record maintenance, improvements, and suggestions for the studio system. Entries are stored in Supabase table **`system_log`** (manual rows: `event_type` is null; audit machine rows are excluded from this tab).

---

## Header

| Element | Notes |
|--------|--------|
| **Title** | i18n: `system_ledger_title` |
| **Subtitle** | i18n: `system_ledger_subtitle` |

### Actions (top right)

| Control | Behaviour |
|---------|-----------|
| **Site checklist (PDF)** | i18n: `system_download_site_checklist` — calls `exportSiteMapChecklistPdf()` (`app/atelier/vault/actions.ts`). |
| **Regenerate Studio Bible** | i18n: `system_ledger_bible_cta` / `system_ledger_bible_regenerating`. Confirms (`system_ledger_bible_confirm`), then `vaultStudioBible()`; on success inserts a completed `improvement` log row. |
| **Copy / download reference MD** | `system_ledger_ref_*` keys; server: `getSystemLedgerReferenceMarkdown()` (`app/atelier/system-reference-actions.ts`). |

---

## New entry form

Submitted rows insert into `system_log` with: `action`, `details`, `type`, `status`, `priority`, **`attachments`**.

| Field | UI | Default / notes |
|-------|-----|-----------------|
| **Priority** | Select | i18n `system_ledger_priority_p1` … `p4`. Default **P3**. |
| **Category (type)** | Select | i18n `system_task_type_*`. Default **maintenance**. |
| **Summary** | Single-line input | i18n `system_ledger_summary_ph` → DB **`action`** (required). |
| **Details** | Textarea | i18n `system_ledger_details_ph` → **`details`**. Image **paste** in this field uploads via `uploadLedgerAttachment` and appends to **`attachments`** (does not embed binary in `details`). |
| **Screenshots** | Button + thumbnails | i18n `system_ledger_attach_add`; file input `accept` JPEG/PNG/WebP/GIF; max **8** per row; R2 keys prefix **`ledger/`**. |
| **Submit** | i18n `system_ledger_add_entry` / `system_ledger_logging` | Disabled when summary empty or request in flight. |

**Initial status on insert:** `requested` if type is `suggestion`, otherwise **`active`**.

---

## Attachments (R2 + DB)

- **Column:** `system_log.attachments` (`jsonb`, default `[]`). Migration: `supabase/sql/system_log_attachments.sql`.
- **Shape:** `[{ "key": "ledger/L_<uuid>_<hash8>.<ext>" }, …]`
- **Upload:** Server action `uploadLedgerAttachment` in `app/atelier/system/ledger-attachment-actions.ts` (team gate `is_team()`, Sharp validation via `validateWorkImageBuffer`, `r2PutObject`).
- **Retention:** R2 lifecycle on bucket `paintings` — prefix **`ledger/`**, delete objects after **30 days** (configure in Cloudflare; documented in `CLAUDE.md`). Thumbnails use `onError` + i18n `system_ledger_attachment_expired` when the object is gone.

---

## Ledger list (below the form)

- Columns (desktop): **Pri** · **Date** · **Type** · **Entry** · **Status** · actions (i18n column headers `system_ledger_col_*`).
- **Status** values (cycle control): `active` → `requested` → `in-progress` → `completed` → `dismissed` → …
- Row **edit** / **delete** — delete confirm: `system_ledger_delete_confirm`.

---

## Markdown template (copy for tickets / runbooks)

```markdown
## System ledger — &lt;short title&gt;

- **Priority:** P1 | P2 | P3 | P4
- **Type:** suggestion | improvement | maintenance | backlog | bug
- **Summary:** &lt;one line — what changed or needs fixing&gt;
- **Details:**
  - &lt;technical notes, links, reproduction steps&gt;

**Status:** active | requested | in-progress | completed | dismissed
```

---

## Operations runbooks (owner)

| Task | When | Command / doc |
|------|------|----------------|
| **O1 GRANT audit** | Before **2026-10-30** (Supabase existing-project deadline) | `pwsh scripts/run-grant-audit.ps1` → [`supabase/sql/grant_audit_queries.sql`](../supabase/sql/grant_audit_queries.sql) |
| **O2 R2 key rotation** | When rotating Cloudflare R2 access key | See runbook below |
| **O3 Broadcast secret rotation** | When rotating `INVENTORY_BROADCAST_SECRET` | See runbook below |
| **R2 lifecycle** | One-time Cloudflare console | Bucket `paintings`: prefix **`recycle/`** delete after **90d**; **`ledger/`** after **30d** (see § Attachments above) |
| **Graph CSV backup** | Weekly (Sun 04:30 UTC) + manual | [`graph-csv-backup.yml`](../.github/workflows/graph-csv-backup.yml); verify: `pwsh scripts/verify-graph-csv-backup.ps1` |
| **Embed backfill** | Desktop ongoing | `npm run embed:worker -- --watch` — see [`docs/GRAPHIFY_NOTES.md`](./GRAPHIFY_NOTES.md) |
| **gen:types** | After each `public` table migration | `npm run gen:types` (requires `SUPABASE_ACCESS_TOKEN` in `.env.local`) |

---

### O2 — R2 access key rotation runbook

R2 credentials are in `.env.local` (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) and mirrored to Vercel as encrypted env vars. The same key pair is used by the GitHub Actions backup workflow (GH secret `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`).

**Steps:**
1. Cloudflare dashboard → R2 → Manage R2 API Tokens → create a new token with Object Read & Write on bucket `paintings`.
2. Note the new `Access Key ID` and `Secret Access Key` (only shown once).
3. Update Vercel: Settings → Environment Variables → replace `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for Production + Preview.
4. Update GitHub: repo Settings → Secrets → replace `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
5. Update `.env.local` on dev machine.
6. Delete the old Cloudflare token.
7. Log rotation date in this ledger (`maintenance` entry) and in `CLAUDE.md` near the R2 section.

**Last rotated:** _not yet documented — fill in when first rotation is done._

---

### O3 — Broadcast Bearer token rotation runbook

`INVENTORY_BROADCAST_SECRET` is the shared secret that authenticates the inventory broadcast HTTP chain (`/api/inventory/broadcast/*`). It is accepted as `Authorization: Bearer <secret>` or `x-inventory-broadcast-secret: <secret>` header (see [`lib/inventory-broadcast-secret.ts`](../lib/inventory-broadcast-secret.ts)).

**Steps:**
1. Generate a new secret: `openssl rand -base64 40` (or any cryptographically random 32+ byte string).
2. Update Vercel: Settings → Environment Variables → replace `INVENTORY_BROADCAST_SECRET` for Production + Preview.
3. Update the secret in whatever external system calls the broadcast endpoints (n8n, Make, or custom automation).
4. Deploy Vercel (the new env var takes effect on next deployment).
5. Smoke test: POST to `/api/inventory/broadcast/event` with the new secret; expect 200.
6. Log rotation date in this ledger (`maintenance` entry).

**Last rotated:** _not yet documented — fill in when first rotation is done._

---

## Related code

| Area | Path |
|------|------|
| UI | `components/atelier/SystemTab.tsx` |
| Ledger screenshot upload | `app/atelier/system/ledger-attachment-actions.ts` |
| Site map checklist PDF | `app/atelier/vault/actions.ts` → `exportSiteMapChecklistPdf` |
| Studio Bible vault | `app/atelier/vault/bible-action.ts` → `vaultStudioBible` |
| Copy (strings) | Legacy `lib/i18n/dictionary/` (`system_*`, `system_task_type_*`); new Atelier copy → `defineMessages` per [`archive/HANDOFF_SLICE4.md`](./archive/HANDOFF_SLICE4.md) |
