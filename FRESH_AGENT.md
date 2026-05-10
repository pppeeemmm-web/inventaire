# Fresh agent — `/works` alternative layouts

Use this file as context when opening a **new chat**. Paste or `@`-attach it so the agent knows how editorial sequences and layout modes work.

## What “alternative layouts” means here

Public **`/works`** can render the same Diffusion data (`works_modes` → collections) in **four presentation modes** (`WorksUxMode`). Implementation: `lib/worksUx.ts` → `resolveWorksUx()` → props on **`WorksClient`** (`components/public/WorksClient.tsx`). Page wiring: **`app/works/page.tsx`** (`searchParams` + `NEXT_PUBLIC_WORKS_UX_MODE`).

## Modes

| Mode | Query | Env override | Behaviour (summary) |
|------|--------|--------------|----------------------|
| **`default`** | _(omit flag)_ | unset or invalid | Full linear sequence: collections in **`sort_order`**, intro/closing per collection, optional global outro. No bridge strips between collections; bottom **chapter pills hidden**. |
| **`bridge`** | `?worksUx=bridge` | `NEXT_PUBLIC_WORKS_UX_MODE=bridge` | Inserts a **bridge slide** before each collection **after the first** (title handoff). Good for multi-sequence editorial flow. |
| **`intro`** | `?worksUx=intro` | same | **Sequence logic is the same as `default`** (only `bridge` / `chapters` change the graph). The label is for previews; **intro copy still comes from collection `intro_fr` / `intro_en` whenever filled**, in any mode. |
| **`chapters`** | `?worksUx=chapters` | same | Shows **one collection at a time**; **bottom pills** switch chapter (only mode that shows those pills). |

Preview on localhost without redeploy:

```text
http://localhost:3000/works?worksUx=bridge
http://localhost:3000/works?worksUx=chapters
```

Production default stays **`default`** unless `NEXT_PUBLIC_WORKS_UX_MODE` is set on the host.

## Where content order comes from (Atelier)

- **Site public → Website** tab in **`PortfolioTab`**: each works mode has **collections** with **`sort_order`**, titles, optional **`intro_fr` / `intro_en`**, closing **`description_*`**, theme, manual work order.
- Vertical order on **`/works`** follows **collection block order** and **`manual_work_order`** / theme rules inside **`buildWorksSequence`** in **`WorksClient.tsx`**.

## Code map

| Piece | Location |
|-------|-----------|
| Mode type + resolver | `lib/worksUx.ts` |
| Sequence construction + scroll UX | `components/public/WorksClient.tsx` (`buildWorksSequence`, constants `WORKS_STEP`, opacity gates) |
| Pass `worksUxMode` into client | `app/works/page.tsx` (`dynamic = 'force-dynamic'` so query is not cached away) |

## Optional next-session goals _(edit below)_

-
