# Slice 3 completion handoff

**Cold-start handoff** for the V5 Atelier tab route segmentation slice.

**Slice 3 status:** **Complete** (2026-05-23) — 16 tab routes · QR Physical Bridge · `BottomStack` · `@container atelier` portal chrome · `TeamPortalClient` monolith trim (segment panels + legacy-only branches).

---

## Boot sequence (read in order)

1. [`docs/README.md`](./README.md) — doc index and truth order
2. [`docs/PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md) — **Slice 3** section
3. [`lib/atelier/tab-routes.ts`](../lib/atelier/tab-routes.ts) — `SegmentedAtelierTab`, `ATELIER_SEGMENTED_TAB_ROUTES`, `atelierTabHref`, `legacyTabRedirectPath`
4. [`SITE_MAP.md`](../SITE_MAP.md) — § Atelier routes

---

## Decisions locked

| Decision | Detail |
|----------|--------|
| **16 segmented tabs** | Canonical paths in `ATELIER_SEGMENTED_TAB_ROUTES` |
| **Constellation layout** | `ConstellationCanvas` in `components/atelier/`; thin route wrapper |
| **Legacy redirects** | `legacyTabRedirectPath` in [`app/atelier/page.tsx`](../app/atelier/page.tsx); client also replaces segmented `pem_team_tab` / `?tab=` on `/atelier` |
| **Segment panels** | [`components/atelier/team-portal-segment-panel.tsx`](../components/atelier/team-portal-segment-panel.tsx) — lazy imports; rendered only when `routeTab` is set |
| **Bottom chrome** | [`components/shared/BottomStack.tsx`](../components/shared/BottomStack.tsx) + `PEM_Z_INDEX` (mobile bar 50, drawer 60, dock 75, modals 80, voice 155) |
| **Narrow shell** | `.atelier-portal-root` + `useAtelierNarrow(portalRef)` (`lib/atelier/use-atelier-narrow.ts`) |

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

Each route: `app/atelier/<tab>/page.tsx` + `_components/<Tab>.tsx`, shell via `loadAtelierShellProps` + `TeamPortalClient` with `routeTab`.

---

## Remaining legacy `?tab=` (not segmented)

Served from `/atelier` only (no segment panel mount on legacy shell):

- `overview`, `map`, `journal`, `system`, `portfolio`, `contacts`, `stock`
- Aliases: `site`, `analytics`

---

## Next work (owner chooses)

**Option A — Legacy tab segments** — overview, map, journal, system, portfolio, contacts, stock (+ site/analytics)

**Option B — V5 Slice 4 i18n** — `defineMessages` precedence in `lib/i18n/context.tsx`

**Deferred (not Slice 3):** per-route bundle ≤250 kB audit · drawer sticky save bars in `BottomStack` (z-index documented; drawer footers stay local) · Slice 4 / Qdrant / SW

---

## Verification

| Check | When |
|-------|------|
| `npm run typecheck` | After route/tab changes |
| `npm run lint` | Before push |
| `npm run i18n:check` | UI/chrome changes |
| `npm run test:e2e:field` | Optional — hub / mobile bar (`ATELIER_E2E=1`) |

---

## Related docs

- [`docs/TODO.md`](./TODO.md)
- [`docs/CONSTELLATION.md`](./CONSTELLATION.md)

Run `pwsh scripts/release-truth.ps1 -Checks` before claiming pushed/release truth.
