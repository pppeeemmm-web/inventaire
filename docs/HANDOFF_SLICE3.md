# Slice 3 completion handoff

**Cold-start handoff** for the V5 Atelier tab route segmentation slice. Written 2026-05-23 at `9ee3efd` on `main`.

**Slice 3 status:** 16 tab routes ✅ · QR Physical Bridge on `WorkForm` ✅ (saved works only) · `BottomStack` / `@container atelier` / monolith trim still open.

---

## Boot sequence (read in order)

1. [`docs/README.md`](./README.md) — doc index and truth order
2. [`docs/PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md) — **Slice 3** section (all 16 tabs ✅)
3. [`lib/atelier/tab-routes.ts`](../lib/atelier/tab-routes.ts) — `SegmentedAtelierTab`, `ATELIER_SEGMENTED_TAB_ROUTES`, `atelierTabHref`, `legacyTabRedirectPath`
4. [`SITE_MAP.md`](../SITE_MAP.md) — § Atelier routes (segment routes + legacy `?tab=` table)

---

## Decisions locked

| Decision | Detail |
|----------|--------|
| **16 segmented tabs** | Per V5 Slice 3 plan; canonical paths in `ATELIER_SEGMENTED_TAB_ROUTES` |
| **Constellation layout** | `ConstellationCanvas` stays in `components/atelier/`; route folder has thin wrapper `app/atelier/constellation/_components/Constellation.tsx` |
| **Legacy redirects** | `legacyTabRedirectPath` in [`app/atelier/page.tsx`](../app/atelier/page.tsx) — server `redirect()` from `?tab=<segmented>` to segment route (other query params preserved); bare `/atelier?map=` → `/atelier/constellation?map=` |
| **Commit cadence** | One commit/push per tab on `main`; shell git only (not Cursor commit UI) |
| **Release truth** | `pwsh scripts/release-truth.ps1` — branch, HEAD, origin/main match, working tree, checks; **no deploy SHA fields** |

---

## Slice 3 completed routes (16)

| Tab id | Path |
|--------|------|
| inventory | `/atelier/inventory` |
| sales | `/atelier/sales` |
| pipeline | `/atelier/pipeline` |
| production | `/atelier/production` |
| stock-take | `/atelier/stock-take` |
| notes | `/atelier/notes` |
| reports | `/atelier/reports` |
| exhibitions | `/atelier/exhibitions` |
| concepts | `/atelier/concepts` |
| themes | `/atelier/themes` |
| logistics | `/atelier/logistics` |
| vault | `/atelier/vault` |
| fiscal | `/atelier/fiscal` |
| broadcast | `/atelier/broadcast` |
| audit | `/atelier/audit` |
| constellation | `/atelier/constellation` |

Each route: `app/atelier/<tab>/page.tsx` + `_components/<Tab>.tsx`, shared shell via `loadAtelierShellProps` + `TeamPortalClient` with `routeTab`.

---

## Remaining legacy `?tab=` (not segmented)

Still served from `/atelier` via `TeamPortalClient` tab state:

- `overview`
- `map`
- `journal`
- `system`
- `portfolio`
- `contacts`
- `stock`
- **Aliases:** `site`, `analytics` (same panels as other legacy ids where applicable)

Navigation for segmented tabs uses `atelierTabHref()` → segment paths. Unmigrated tabs still use `/atelier?tab=<id>`.

---

## Next work (owner chooses)

**Option A — Post–Slice 3 tab cleanup**

- Segment remaining legacy tabs (overview, map, journal, system, portfolio, contacts, stock) using the inventory template
- Trim dynamic imports / dead tab branches in `TeamPortalClient.tsx` as tabs move out
- ~~QR Physical Bridge on `WorkForm`~~ — done (`WorkFormPhysicalQr`, URL `/atelier/works/:id`, scan via `/atelier/scan`)

**Option B — V5 Slice 4 i18n**

- Wire `defineMessages` precedence in `lib/i18n/context.tsx`
- Remove ESLint `off` overrides for migrated tab components
- See V5 Slice 4 section

---

## Verification

| Check | When |
|-------|------|
| `npm run typecheck` | Required after route/tab changes |
| `npm run lint` | Required before handoff / push |
| `npm run test:e2e:field` | Optional — hub / mobile bar / field launcher (`ATELIER_E2E=1`, logged-in dev session) |
| Per-route 375px smoke | After new segment or chrome change |

---

## Git state at handoff write

```
branch: main
HEAD:   9ee3efd368281858c7dbf563bafa2a80727185e5
origin/main: 9ee3efd368281858c7dbf563bafa2a80727185e5
HEAD == origin/main: yes
working tree: clean (before doc-only edits in this handoff pass)
```

Run `pwsh scripts/release-truth.ps1` before claiming pushed/release truth.

---

## Related docs

- [`docs/TODO.md`](./TODO.md) — backlog including optional legacy tab segments
- [`docs/CONSTELLATION.md`](./CONSTELLATION.md) — constellation feature contract; canonical URL `/atelier/constellation?map=<uuid>`
- [`docs/PROJECT_SYNTHESIS.md`](./PROJECT_SYNTHESIS.md) — stack onboarding
