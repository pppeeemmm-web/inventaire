# TODO — refused / dropped

_Items taken off the list on purpose, with the reason, so they are not proposed again by accident. Reopen only with the owner's GO._

## 2026-11-13 (owner: "if it hasn't been done, drop it")

- **Mobile rationalization 2.2** — share-triage as canonical photo funnel. Blocked on: 2–3 owner painting sessions with friction notes.
- **Phase 3 decision (owner)** — regroup hub tiles by verb, or keep 10-tile layout?
- Follow-ups from 2.x (Commentaires ungated, reorder/replace image gating, `attachShareInboxFilesToWork` audit) — tracked in the plan doc.
- **E2E suites fail against a DEV_AUTO_LOGIN dev server** (2026-07-30). `playwright.config.ts` has `reuseExistingServer: true`, so a running `npm run dev` with `DEV_AUTO_LOGIN_*` set makes `/` and `/login` render the authenticated shell — 7 public-shell specs fail (public-seo, login-i18n ×3, landing-mobile-nav ×2, command-palette). `test:e2e:field` fails 10 more (hub-field-launcher ×7, atelier-shell-tab-hop, atelier-mobile-action-bar, hub-mobile-capture, session-new). `session-new.spec.ts` fails at line 17 with `session-new-root` visible but no `session-date-input` — i.e. the `!sessionId` branch, session never opened. Needs a clean run (auto-login off, or a dedicated Playwright server) to separate real regressions from environment. Not attributed to the 2026-07-30 session refactor: 9 of the 10 field failures are in specs that refactor never touched.

Reason: not done in four months, the field workflow moved on (the Journal day is the field tab since 2026-11-12, Hub rows changed); the E2E note describes a test-environment problem, not an app bug.
