# Slice 4 — i18n handoff

**Cold-start handoff** for V5 bilingual copy: `defineMessages` precedence, segment-tab migration, and CI enforcement.

**Slice 4 status (2026-05-23):** **Core shipped** — `resolveMessage` + `t()` / `routeMetadata` precedence · five segment tabs migrated (Exhibitions, Fiscal, Inventory, Sales, Vault) · **CI ratchet** (`i18n:check` fails on blocking hardcoded copy; GitHub `ci.yml`). **Remaining:** four allowlisted panels + incremental legacy surfaces.

---

## Boot sequence (read in order)

1. [`docs/README.md`](./README.md) — doc index
2. [`docs/PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md) — § Slice 4
3. [`lib/i18n/resolve-message.ts`](../lib/i18n/resolve-message.ts) — feature messages → legacy dict → dev warn
4. [`lib/i18n/context.tsx`](../lib/i18n/context.tsx) — client `t()`
5. [`scripts/i18n-check.mjs`](../scripts/i18n-check.mjs) + [`scripts/i18n-check-allowlist.json`](../scripts/i18n-check-allowlist.json)
6. [`.eslintrc.json`](../.eslintrc.json) — `pem-i18n/no-hardcoded-jsx-text` (must stay synced with allowlist)
7. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `typecheck` · `lint` · `i18n:check`

Prior slice (routes): [`HANDOFF_SLICE3.md`](./HANDOFF_SLICE3.md).

---

## Decisions locked

| Decision | Detail |
|----------|--------|
| **New copy** | `lib/i18n/messages/*.messages.ts` via `defineMessages()` (FR + EN in one object). Do **not** add new feature keys to `keys.ts` / `fr.ts` / `en.ts`. |
| **Runtime precedence** | `defineMessages` keys win over legacy dictionary in `t()` and `resolveMessage`. |
| **Server / RSC** | Merged `dict[lang]` in [`lib/i18n/dictionary/index.ts`](../lib/i18n/dictionary/index.ts); export HTML/actions pass `lang` and use `dict[lang][key]` where needed. |
| **ESLint** | `pem-i18n/no-hardcoded-jsx-text` = **error** on `app/**`, `components/**`, `hooks/**` except allowlisted paths. |
| **CI** | `npm run i18n:check` **exits 1** on blocking hardcoded UI strings (regex: JSX text, `title`/`placeholder`/`aria-*`, `alert`/`confirm`/`prompt`). Allowlisted paths are reported but do not fail. |
| **Allowlist sync** | Same five files in `scripts/i18n-check-allowlist.json` and `.eslintrc.json` overrides. Removing a path from either requires **zero** hotspots there first. |

---

## Feature message modules (`lib/i18n/messages/`)

Registered in [`lib/i18n/messages/index.ts`](../lib/i18n/messages/index.ts) → `featureMessages`. `i18n-check` auto-discovers all `*.messages.ts` files.

| Module | Typical surface |
|--------|-----------------|
| `atelier.messages.ts` | Atelier chrome |
| `hub.messages.ts` | `/hub` |
| `public.messages.ts` | Public site |
| `work-form.messages.ts` | Work form / drawer |
| `system.messages.ts` | System / ledger |
| `exhibitions-ui.messages.ts` | `/atelier/exhibitions` |
| `fiscal-ui.messages.ts` | `/atelier/fiscal` |
| `inventory-ui.messages.ts` | `/atelier/inventory` |
| `sales-ui.messages.ts` | `/atelier/sales` |
| `vault-ui.messages.ts` | `/atelier/vault` |
| `portfolio-pdf.messages.ts` | Portfolio PDF + config rows |
| `site-blocks.messages.ts` | Site editor blocks |
| `mobile-sale.messages.ts` | Mobile sale flow |

---

## Allowlisted debt (9 hotspots, 2026-05-23)

Migrate copy → remove path from **both** allowlist and ESLint override:

| File | Notes |
|------|--------|
| `components/atelier/CurationPanel.tsx` | 7 strings |
| `components/atelier/PortfolioConfigShell.tsx` | 1 string |
| `components/atelier/WorldMapTab.tsx` | 1 string |

(`PortfolioTab.tsx` and `ContactEditorPanel.tsx` are ESLint-off but had no regex hotspots at last scan.)

---

## Next work (owner chooses)

1. **Slice 4 panels** — migrate allowlisted files; drop from allowlist + ESLint overrides.
2. **Legacy `?tab=` segments** — overview, map, journal, system, portfolio, contacts, stock ([`HANDOFF_SLICE3.md`](./HANDOFF_SLICE3.md)).
3. **Slice 5** — graph foundation ([`PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md)).

**Deferred:** atelier shell reload per segment tab hop (post–V5 backlog in V5 plan).

---

## Verification

| Check | When |
|-------|------|
| `npm run i18n:check` | **Required** for any UI copy / JSX string change; must pass (0 blocking hotspots). |
| `npm run lint` | Before push |
| `npm run typecheck` | Data flow / server action signature changes |
| `npm run test:e2e:field` | Optional — hub / mobile (`ATELIER_E2E=1`) |

Manual: toggle FR ↔ EN on exhibitions + inventory after copy edits.

Run `pwsh scripts/release-truth.ps1 -Checks` before claiming pushed/release truth.

---

## Related docs

- [`docs/TODO.md`](./TODO.md) — Slice 4 checkboxes
- [`docs/HANDOFF_SLICE3.md`](./HANDOFF_SLICE3.md) — route segmentation
