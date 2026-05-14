# Agent Instructions

- **Frameworks:** Next.js 15, Tailwind, Prisma (where applicable).
- **Testing:** Write Playwright tests for new UI components. Hub / mobile bar / field launcher specs are gated on `ATELIER_E2E=1`; run **`npm run test:e2e:field`** (see `scripts/run-atelier-e2e.mjs`) with a logged-in dev session, or `npm run test:e2e` for the full suite.
- **Style:** Functional components; avoid `any` in TypeScript.
- **Verification:** Before finishing a task, run `npm run lint`.

## Working agreement (repo owner)

- **Parallelize** independent reads, searches, and edits until the current slice is complete.
- **No artificial deadlines** — ship when the slice is right, not when a clock says so.
- **Good job = fast job** — speed comes from parallelism and tight diffs, not from skipping RLS, auth, bilingual copy rules, or data-safety checks.
