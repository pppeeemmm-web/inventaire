# PEM Hub — roadmap (non-binding)

**Purpose:** consolidate **future** work mentioned in [`CLAUDE.md`](../CLAUDE.md) (deferred integrations, scaling notes), [`architecture.md`](../architecture.md) (ruthless audit / potentialities), and [`docs/SITE_MAP.md`](SITE_MAP.md) (surface inventory). This is **not** a commitment order; pick items by risk and studio need.

---

## Near-term product and data loading

| Item | Source | Notes |
|------|--------|--------|
| **Per-tab lazy fetch** for Atelier reference payloads | architecture §2, §5 | First œuvres chunk + keyset “load more” shipped; junction + lookup tables still ride the RSC `Promise.all`. Splitting reduces TTI and coupling. |
| **Reports / analytics** aligned with paging primitives | architecture §5.10 | **Rapports** tab ships (XLSX + PDF on loaded batch via [`ReportsTab`](../components/atelier/ReportsTab.tsx) + [`app/atelier/reports/actions.ts`](../app/atelier/reports/actions.ts)). Remaining: avoid drift vs keyset catalogue totals, heavier server-side reports without duplicating unbounded reads. |
| **Overview pipeline pulse** off client Supabase | architecture §4 | Historical smell; migrate remaining widgets to server + tags where feasible. |
| **Full ruthless UX pass** | architecture §3 | Mobile contract, coherence, discoverability, bilingual leaks — incremental fixes only so far. |

---

## Deferred integrations (explicit “no GO” in CLAUDE)

| Item | Pointer |
|------|---------|
| **Background jobs / queues** (portfolio PDF at scale, bulk R2/geocode, long retries) | [`app/atelier/portfolio/pdf-action.ts`](../app/atelier/portfolio/pdf-action.ts); `app/api/inventory/broadcast/` stays **external** only. Prefer **outbox + idempotency** if DB webhooks trigger side effects. |
| **Vision / OCR** field capture | Human confirm before commit; EU/data sensitivity; align with **📱 MOBILE FIELD-TOOL**. |
| **Transactional email** (Resend/Postmark-class) | When external recipients or offline alerting matter. |

---

## Security and architecture hardening

| Item | Source | Notes |
|------|--------|--------|
| **Regenerated Supabase types** + remove loader `(as any)` / `unknown` casts | architecture §2 | Full type alignment with `select()` lists. |
| **WorkDrawer** further decomposition | architecture §2 | Core identity form, themes, images, save/delete lifecycle still dense in `DrawerContent`. |
| **Status labels** via `dictionary` vs `STATUS_LABEL_MAP` | architecture §2 | Blocked historically by client bundle importing full dict — needs a thin shared layer if revisited. |

---

## Mobile field-tool and operator UX

| Item | Source | Notes |
|------|--------|--------|
| **Mobile-primary** polish (`TeamPortalClient`, `WorkForm`, capture inputs) | architecture §5.4, CLAUDE **📱 MOBILE FIELD-TOOL** | Golden path: iPhone SE / ~360px. |
| **Subset disclosure** follow-through | Atelier shell | When new tabs show catalogue-wide KPIs, reuse the same “loaded vs total” pattern (`oeuvresPaging.totalCount`) so numbers stay honest. |
| **Bilingual sweep** | architecture §5.6 | Grep for JSX literals / `alert` / placeholders outside `dictionary.ts`. |

---

## Operations and documentation

| Item | Notes |
|------|--------|
| **Quarterly** DB backup recovery drill | [`CLAUDE.md`](../CLAUDE.md) Phase E |
| **R2 key rotation** (annual) | Document rotation date in CLAUDE Phase D |
| Keep **[`docs/SITE_MAP.md`](SITE_MAP.md)** and **[`docs/SYSTEM_LEDGER.md`](SYSTEM_LEDGER.md)** aligned when routes or System-tab behaviour change. |
| **QA checklist PDF** (Atelier → System) before claiming large releases | architecture Verification |

---

## Suggested sequencing (opinion only)

1. Per-tab / lazy Atelier reads where they hurt most (large DBs).  
2. WorkDrawer + types cleanup in the same effort window (fewer regressions).  
3. Background job outbox once server actions regularly time out on heavy work.  
4. Vision/OCR after mobile capture paths feel stable.

---

*Last updated: 2026-05-13 — doc sync (reports tab shipped wording, world map pin rules in CLAUDE/SITE_MAP).*
