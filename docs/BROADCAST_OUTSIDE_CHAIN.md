# Building the outside chain — **Make.com only** (Make → Buffer → Slack)

This doc is the **Make.com** build guide for middleware and Slack. Your app’s HTTP contract is in [BROADCAST.md](./BROADCAST.md); handlers under `app/api/inventory/broadcast/`. (Other tools: same HTTP calls; this file does not walk them.)

---

## 0 — Prerequisites (gather in Make)

| Item | Where |
|------|--------|
| **Base URL** | Production host, e.g. `https://your-app.vercel.app` (no trailing slash) |
| **Secret** | Same value as Vercel `INVENTORY_BROADCAST_SECRET` |
| **Platform slug** | Lowercase token you reuse everywhere, e.g. `instagram` or `linkedin` |
| **Buffer** | Account with Instagram/LinkedIn **connected** in Buffer; **Make** connection to Buffer ([Make Buffer app](https://www.make.com/en/integrations/buffer)) |
| **Buffer behaviour** | Prefer **draft** or **queue** so a human approves before publish ([Buffer + automation](https://support.buffer.com/article/610-integrating-and-automating-with-third-party-apps)) |
| **AI** | OpenAI / Anthropic / etc. **connection** in Make for caption text |
| **Slack (optional)** | [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL for an internal channel |

Store `BASE_URL` and `SECRET` as **Make** [Tools → variables](https://www.make.com/en/help/tools/variables) (organization or team) or duplicate-safe scenario variables — never expose them in Slack bodies.

---

## 1 — HTTP in Make (all calls to your app)

Module: **HTTP → Make a request**.

- **Headers:** `Authorization: Bearer <SECRET>` and `Content-Type: application/json` on POSTs.  
  If a run shows **401** while the secret is correct, try **`x-inventory-broadcast-secret: <SECRET>`** instead (some stacks strip `Authorization`; your app accepts both — see [lib/inventory-broadcast-secret.ts](../lib/inventory-broadcast-secret.ts)).

**Tip:** Save one **HTTP** submodule as a blueprint: same headers, only URL/method/body change — duplicate per route.

---

## 2 — Make tips (before you wire modules)

- **Two scenarios** — Easier to maintain than one mega-scenario: **(A)** pull → queue → AI → Buffer; **(B)** confirm (webhook or schedule). Turn **scheduling off** on B while testing.
- **Error handlers** — Right-click route → add **error handler** path → Slack ping without leaking the secret.
- **Iterator** — Feed returns `items[]`; use **Iterator** on that array so queue/AI/Buffer run **per work**.
- **Data store (optional)** — For approach B3 later: modules **Data store → Set a record** after Buffer returns an id, key = `bufferPostId`, value = `oeuvreId` JSON.

---

## 3 — Scenario A — “Pull, lock, draft” (main loop)

**Goal:** For each eligible work: lock in DB → generate caption → **Buffer → Create a status update** as **draft / queue**, not live publish.

**Module order (Make.com):**

1. **Trigger** — **Schedule** (e.g. every 15–60 min) or **Run once** while testing.
2. **HTTP** — `GET` `{BASE_URL}/api/inventory/broadcast/feed?platform={platform}`  
   - Map response: `items` array (may be empty).
3. **Router** — If `count` is `0`, end route (optional second route → Slack “feed empty”).
4. **Iterator** — Source = `items` from step 2.
5. **HTTP** — `POST` `{BASE_URL}/api/inventory/broadcast/queue`  
   - Body: `{ "oeuvreId": {{oeuvreId from iterator}}, "platform": "{{platform}}" }` (use Make’s field mapper).  
   - **Error handler / Router on status 409** — “Already posted”: skip Buffer for this bundle (end route).
6. **OpenAI** (or **Anthropic**, etc.) — Prompt includes: `titre`, `techniqueLabel`, `supportLabel`, dimensions, `captionSeed`, `anneeYear`. Output = caption string.
7. **Buffer → Create a status update** — Map caption + **image** from iterator `imageUrl` (or `thumbUrl` if Buffer prefers).  
   - Profiles: pick Instagram (etc.).  
   - Mode: **draft** / **add to queue** / equivalent “needs approval” — **avoid “Share now”** until the pipeline is trusted.  
   - Reference: [Make Buffer modules](https://apps.make.com/buffer-modules). Raw API fallback: [Buffer GraphQL](https://developers.buffer.com) via another **HTTP** module if the app module is too limited.

**After step 7:** DB row is **queued**; Buffer has a **draft**. Still no `confirm`.

---

## 4 — Scenario B — “Confirm posted” (close the loop)

Atelier **Publiés** only updates after **`POST …/confirm`** with `externalUrl` (+ `captionFinal` recommended). Buffer does not call your app by itself.

| Approach | In Make |
|----------|---------|
| **B1 — Webhook (fastest)** | New scenario: trigger **Custom webhook** (from **Webhooks** app). You POST JSON (or use a **Data structure** form) with `oeuvreId`, `platform`, `externalUrl`, `captionFinal` after you publish in Buffer → next module **HTTP POST** `confirm`. |
| **B2 — Buffer → Make** | Only if you have a reliable “published” signal into Make (Buffer feature set / partner integration). Map payload → same **HTTP POST** `confirm`. |
| **B3 — Reconcile** | Scheduled scenario: list recent Buffer posts (GraphQL/API via **HTTP**), **Data store** lookup `oeuvreId`, then **HTTP POST** `confirm`. Heavier setup. |

Start with **B1**.

**HTTP POST** — `{BASE_URL}/api/inventory/broadcast/confirm`  
Body:

```json
{
  "oeuvreId": 1234,
  "platform": "instagram",
  "externalUrl": "https://www.instagram.com/p/…",
  "captionFinal": "final caption text"
}
```

**409** → treat as success path “already recorded” (filter module or router), do not fail the scenario.

---

## 5 — Slack (still inside Make)

Module: **HTTP → Make a request** → `POST` your Slack **Incoming Webhook** URL.

```json
{ "text": "Broadcast: queued #1234 instagram — draft in Buffer" }
```

Useful hooks:

- After successful **queue** (§3 step 5).
- After successful **confirm** (§4).
- **Error handler** on any **HTTP** to your app: include status code + `oeuvreId` if mapped — **never** the secret.

**Atelier Activité mirror:** same place, add **HTTP POST** `{BASE_URL}/api/inventory/broadcast/event` (`eventType`, `priority`, `summary`, …) — fields in [BROADCAST_PHASE3_OPERATIONS.md](./BROADCAST_PHASE3_OPERATIONS.md) §3 Step E.

---

## 6 — Resilience checklist (Make)

- [ ] **401** on feed → Make variable vs Vercel `INVENTORY_BROADCAST_SECRET`.
- [ ] **503** → secret missing on Vercel deployment.
- [ ] Scenario dies after **queue** → item stuck ~30 min then returns to feed; Atelier **Release** on Broadcast tab clears stuck **queue** rows.
- [ ] **409** on **confirm** → idempotent; route to “done” branch.
- [ ] Every Slack line includes **oeuvreId** (and platform) for support.

---

## 7 — Build order (Make)

1. **curl** feed + queue + confirm on prod ([BROADCAST_PHASE3_OPERATIONS.md](./BROADCAST_PHASE3_OPERATIONS.md) §4).  
2. **Scenario A** through Buffer draft only (Schedule off or long interval first).  
3. **Slack** webhook on API errors + optional “queued” ping.  
4. **Scenario B** — B1 webhook → `confirm`.  
5. Optional **HTTP** `event` for VIP-style lines in Atelier.

When stable, note it in [PROJECT_SYNTHESIS.md](./PROJECT_SYNTHESIS.md).
