# PEM Hub — TODO

_This checklist is maintained in the repository at `docs/TODO.md`. Prefer editing this file for commits; keep any Desktop `TODO.md` as an optional mirror._

_Consolidated 2026-05-14 from `iphone-se-plan.md`, `STATUS.md`, `PROJECT_SYNTHESIS.md`, `ROADMAP.md`. Cross-checked against DB and `DONE.md`. **Block A/C refresh 2026-05-15** (A1/C4 done; A2/A4/A5; A0 partial; Block C partial — `pipeline-shared` + imports + `ExhibitionsTab` trim; 0.4 dictionary shipped). **Phase 2 B.1/B.2/B.4 + Share Target base** synced to app repo 2026-05-15._

---

## Operations — time-sensitive

- [ ] **O1** Pre-Oct-30 2026 Supabase GRANT audit (deadline 2026-10-30 existing projects; 2026-05-30 new). Run `supabase/sql/grant_audit_queries.sql`, write remediation migrations. *(STATUS O1)*
- [ ] **O2** R2 access key rotation; document rotation date in `CLAUDE.md` Phase D. *(STATUS O2)*
- [ ] **O3** Broadcast Bearer token rotation runbook → `docs/SYSTEM_LEDGER.md`. *(STATUS O3)*
- [ ] **O4** Quarterly DB backup recovery drill (next due per `docs/BACKUP_RECOVERY.md`). *(STATUS O4)*
- [ ] **Vercel `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`** must be set to live origin or metadataBase/OG/sitemap break. *(CLAUDE 📅)*

## Manual Supabase / Cloudflare steps still pending

- [ ] Run `supabase/sql/dead_columns_drop.sql` already applied — but verify any view such as `OeuvresComplete` referencing dropped columns is recreated. *(iphone-se-plan 0.1)*
- [ ] Run `grant_audit_queries.sql` after schema changes. *(iphone-se-plan 0.1)*
- [ ] Confirm GH repo secret `SUPABASE_DB_URL` set for `audit-prune.yml`; manual `select * from audit_log_prune();` sanity check before enabling workflow. *(iphone-se-plan 0.2)*
- [ ] Smoke one image upload on staging after AVIF switch; confirm R2 objects + thumbs. *(iphone-se-plan 0.5)*
- [ ] Cloudflare console: add lifecycle rules — `recycle/` 90d on `paintings` (and `vault` if used), `ledger/` 30d. *(CLAUDE Phase D)*

## Phase 0 remainders (iphone-se-plan)

- [x] **0.4** Dictionary modularization — split into `lib/i18n/dictionary/` + barrel *(shipped in app repo; iphone-se-plan 0.4)*.
- [ ] ESLint allow-list ratchet — clean legacy Atelier tabs opportunistically (SalesTab, FiscalTab, VaultTab, ExhibitionsTab, CurationPanel, PortfolioTab, ContactEditorPanel, WorldMapTab, InventoryTab, AuditTab) and remove from override. *(iphone-se-plan 0.3)*

## Block A — agility (no user-visible change)

- [ ] **A0** Regenerate Supabase types; remove remaining `as any` / `as unknown as` Supabase casts (actions + heavy tabs); atelier loader — *partial 2026-05-15: `app/works/page.tsx` strict `works_modes` / legacy collections; `ThemesTab.tsx` clear.* *(STATUS A0)*
- [x] **A1** Move `ExhibitionsTab` + `CurationPanel` client-side Supabase mutations to server actions (`app/atelier/exhibitions/actions.ts`, `app/atelier/curation/actions.ts`). *(STATUS A1 — shipped; 2026-05-15: constellation graph + `tblrelations` also via `app/atelier/constellation/actions.ts`.)*
- [x] **A2** Switch `/works` from `force-dynamic` to RSC + `revalidateTag('portfolio')` from `savePortfolioConfig`. *(STATUS A2 — 2026-05-15: `loadPortfolioSectionsCached` + tag on save; page still dynamic via `cookies()`.)*
- [ ] **A3** R2 JSON optimistic concurrency (etag / `updated_at` round-trip) on `savePortfolioConfig`. *(STATUS A3)*
- [x] **A4** Server-side sanitize RichEditor HTML in `savePortfolioConfig` before R2 PUT. *(STATUS A4 — `sanitizePortfolioConfigForPersist` in `app/atelier/portfolio/actions.ts`.)*
- [x] **A5** Replace silent `catch {}` with logged variant in `app/page.tsx` + calendar OAuth callbacks. *(STATUS A5 — home + calendar already logged; 2026-05-15: selection PDF cell images + works `r2SoftDelete` paths.)*

## Block C — decomposition (largest files)

- [ ] **C1** `PortfolioTab.tsx` (~1,851 lines) → `PortfolioLandingPanel`, `PortfolioCollectionsPanel`, `PortfolioWorksManager` + orchestrator. *(STATUS C1)*
- [ ] **C2** `PipelineTab.tsx` (~1,877 lines; types live in `pipeline/pipeline-shared.ts`) → `PipelineGanttView`, `PipelineDeadlineSidebar`, `PipelineRemindersPanel`; add `AbortController` to `useEffect` fetches. *(STATUS C2)*
- [ ] **C3** `ExhibitionsTab.tsx` (~1,086 lines; list already `exhibitions/ExhibitionsListPanel.tsx`) → `ExhibitionStepsPanel`, `ExhibitionFloorPlanEditor` + thinner shell. *A1 done.* *(STATUS C3)*
- [x] **C4** Write `docs/CONSTELLATION.md` (purpose, user story, data model) before further investment in the 3,003-line canvas. *(STATUS C4 — canonical copy in app repo `docs/CONSTELLATION.md`; 2026-05-15 updated for server graph bundle + edge actions.)*
- [x] **C-partial (2026-05-15)** Shared `pipeline-shared.ts`; `PipelineTab` / `ExhibitionsListPanel` / `ConceptCard` wired; `ExhibitionsTab` dead wall UI + drag ref cleanup. *(app `STATUS.md` Done table)*
- [ ] WorkDrawer further decomposition — core identity form, themes, images, save/delete lifecycle still dense in `DrawerContent`. *(ROADMAP)*

## Mobile field-tool — Phases 1–8

### Phase 1 — Ring A polish (~6–8 h)

- [ ] Slim top bar on `(max-width: 767px)`: keep ☰ + active tab name; move theme/lang/⌘K into drawer header; `+` → bottom bar; drop `HUB /` breadcrumb. *(iphone-se-plan A.1)*
- [ ] Subset banner → single-line chip (`1000 / 1116 ▾`); tap expands; suppress on Hub/System/Audit/Pending; preserve test ids. *(iphone-se-plan A.2)*
- [ ] Per-tab narrow polish: ProductionTab stack stats vertically; PipelineTab one-row scroll strip + Calendrier default; `/hub` single-column tile stack; landing sticky bottom CTAs with safe-area. *(iphone-se-plan A.3)*

### Phase 2 — Ring B finish (~8–10 h)

- [x] Field Launcher rows full set (8 verbs with emoji + chevron, ~64px tall); "Plus" expander preserves legacy groups. *(iphone-se-plan B.1 — shipped: `components/hub/HubLauncherClient.tsx` `FIELD_ROWS`.)*
- [x] Persistent `MobileActionBar` hidden when WorkDrawer open (`inspected`). *(iphone-se-plan B.2 — shipped: `components/atelier/TeamPortalClient.tsx` `showMobileActionBar`.)*
- [x] PWA manifest: `app/manifest.ts` (`start_url` `/hub`, theme/background, icons 192/512/maskable, `share_target` → `POST` `/atelier/share-receive`); `app/layout.tsx` links `/manifest.webmanifest`. *(iphone-se-plan B.4 — shipped; verify `apple-touch-icon` in `layout` if missing.)*

### Phase 3 — Verb 1 Session (~20–24 h)

_Checklist complete (2026-05-15). Optional polish remains on the route bullet (client `exifr`, pigments, in-browser edits)._

- [x] **Migration:** `supabase/sql/work_session.sql` with RLS, policies, grants, retention clause baked in — **SQL shipped**; operator applies in Supabase then `supabase gen types`. *(iphone-se-plan Verb 1)*
- [x] **Migration:** `supabase/sql/tblimage_capture_meta_sha256.sql` adds `tblImage.capture_meta jsonb` + `tblImage.sha256 text` — **SQL shipped**; operator applies. *(iphone-se-plan Verb 1)*
- [x] Types in `lib/types/database.ts`: `WorkSessionRow` + payload helpers in `lib/work-session-payload.ts`. *(iphone-se-plan Verb 1)*
- [x] Route `/atelier/session/new` — **MVP shipped:** `?work=` prefill, multi-shot upload, metadata form, server SHA-256, admin apply / editor submit-for-review via `work_session` status (not `pending_changes`). **Deferred:** client `exifr`, in-browser edits, pigments/layer count. *(iphone-se-plan Verb 1)*
- [x] `lib/field-context.ts` — geolocation + Open-Meteo current weather via authenticated [`app/api/field-weather/route.ts`](../app/api/field-weather/route.ts); snapshot stored in `work_session.payload.field_context` from [`SessionNewClient`](../components/atelier/session/SessionNewClient.tsx). *(iphone-se-plan Verb 1)*
- [x] Server actions in `app/atelier/session/actions.ts` — draft, upload to R2 staging, `submitWorkSessionForReview` / `applyWorkSessionToOeuvre` / admin reject-delete; **not** `pending_changes` (FK requires existing `Oeuvres` row). *(iphone-se-plan Verb 1)*
- [x] "Sessions" block in `components/atelier/work-drawer/DrawerContent.tsx` (`DrawerWorkSessionsSection`) — list + admin delete. *(iphone-se-plan Verb 1)*

### Phase 4 — Verb 2 Voice notes (~14–16 h)

- [x] **Migration:** `supabase/sql/voice_note.sql` + `supabase/sql/sketchbook.sql` with RLS and grants — **SQL shipped**; operator applies in Supabase then `supabase gen types`. *(iphone-se-plan Verb 2)*
- [x] Types: `VoiceNoteRow`, `SketchbookRow` in `lib/types/database.ts`. *(iphone-se-plan Verb 2)*
- [x] `lib/voice/web-speech.ts` — Web Speech API wrapper + `MediaRecorder` audio capture. *(iphone-se-plan Verb 2)*
- [x] Bottom-sheet voice UI: record/transcribe, kind chips, subject, project bucket, optional œuvre link — [`VoiceNoteSheet`](../components/shared/VoiceNoteSheet.tsx). *(iphone-se-plan Verb 2)*
- [x] Server actions in `app/atelier/notes/actions.ts` — `createVoiceNote`, `listVoiceNotes`, `updateVoiceNoteTranscript`, `deleteVoiceNote`. *(iphone-se-plan Verb 2)*
- [x] `?tab=notes` — [`NotesTab`](../components/atelier/NotesTab.tsx): list + filters + transcript edit + delete + audio playback. *(iphone-se-plan Verb 2)*

### Phase 5 — Verb 3 Doc capture + Share Target full (~10–12 h)

- [ ] In-app camera `/atelier/capture?mode=doc` — multi-shot, perspective correction (`jscanify` or `cv-wasm`), bundle to PDF via existing pdfkit, attach to `document` table with `kind='scan'`. *(iphone-se-plan Verb 3)*
- [ ] Share Target **partial:** `app/atelier/share-receive/route.ts` (auth, R2, `share_inbox`) + `app/atelier/share-triage` + client. **Remaining:** triage chooses attach target across work / contact / process / vault / note (full matrix). *(iphone-se-plan B.3)*

### Phase 6 — Verb 5 Triage (~8–10 h)

- [ ] Survey existing Make/n8n contract for SM queue row shape; verify before adding schema. *(iphone-se-plan Verb 5)*
- [ ] `/atelier/triage` swipe deck: approve/reject/edit; `approveBroadcast`, `rejectBroadcast`, `approveEnquiry`, `archiveEnquiry` actions. *(iphone-se-plan Verb 5)*

### Phase 7 — Verbs 4 / 6 / 7 / 8 (~14–18 h)

- [ ] **Verb 4** Pipeline swipe-nudge: swipe-left on process row → "+ étape" + "✓ done"; `quickAddEtape` action. *(iphone-se-plan Verb 4)*
- [ ] **Verb 6** Business card ingest: `/atelier/capture?mode=card` with Live Text paste + regex extraction; add `Contact.business_card_r2_key`. *(iphone-se-plan Verb 6)*
- [ ] **Verb 6** Website ingest: paste URL → fetch HTML → parse `<title>`/OG/`mailto:` → prefill Contact; `ingestFromUrl` action. *(iphone-se-plan Verb 6)*
- [ ] **Verb 7** Signature capture screen `/atelier/sign/setup`; add `Contact.signature_r2_key` (admin-only). *(iphone-se-plan Verb 7)*
- [ ] **Verb 7** PDF generators: `generateCOA`, `generateConsignment` (with mandatory current-state photo block), `generateInvoice`; each writes to R2 + `document` row. *(iphone-se-plan Verb 7)*
- [ ] **Verb 7** `/atelier/documents/new` screen — type → subjects → preview → generate & email/download. *(iphone-se-plan Verb 7)*
- [ ] **Verb 8** `studio_task` columns: `kind` (default `studio`), `severity`, `photo_r2_key` — needs migration. *(iphone-se-plan Verb 8)*
- [ ] **Verb 8** `/atelier/issue/new` screen (3 fields + photo) + `createStudioTask` action. *(iphone-se-plan Verb 8)*

### Phase 8 — Ring D a11y + i18n + observability (~4–6 h)

- [ ] Body ≥16px on narrow (prevents iOS form-zoom). *(iphone-se-plan Ring D)*
- [ ] `aria-label` from dictionary on every icon button. *(iphone-se-plan Ring D)*
- [ ] Visible focus rings (Bluetooth keyboard check). *(iphone-se-plan Ring D)*
- [ ] `prefers-reduced-motion` honoured on sidebar slide. *(iphone-se-plan Ring D)*
- [ ] Every new action writes `system_log` row. *(iphone-se-plan Ring D)*

## Deferred integrations (explicit "no GO")

- [ ] Background jobs / queues — long-running or retriable work off Server Action path. *(CLAUDE deferred · ROADMAP)*
- [ ] Vision / OCR field capture — human-confirm before commit, EU/data sensitivity. *(CLAUDE deferred · ROADMAP)*
- [ ] Transactional email (Resend/Postmark-class) — when external recipients or offline alerting matter; outbox + idempotency if DB-webhook-triggered. *(CLAUDE deferred · ROADMAP)*

## Roadmap features (no GO without decision)

- [ ] **F1** `/works` legacy mirror cleanup — sunset `works_collections` + `sections` fallback; fold into `works_modes`; remove PDF diagnostic log. *(STATUS F1)*
- [ ] **F2** Public-site staging `?preview=<token>` for landing/about/practice. *(STATUS F2)*
- [ ] **F3** Mobile capture-first quick-add `/atelier/quick` — camera → vision draft → confirm → soft-create. *(STATUS F3)*
- [ ] **F4** Saved searches / smart filter persistence in Inventory (`localStorage` + URL hash). *(STATUS F4)*
- [ ] **F5** Per-collector "share kit" — `/c/<token>` + printable PDF + enquiry CTA. *(STATUS F5)*
- [ ] **F6** Feature flags (`flags.json` in R2 next to portfolio config). *(STATUS F6)*
- [ ] **F7** Daily admin digest email (after transactional email lands). *(STATUS F7)*
- [ ] **F8** Background job outbox (when server actions time out on PDF/geocode/broadcast). *(STATUS F8)*
- [ ] **F9** Vision/OCR field capture (after mobile capture stable). *(STATUS F9)*
- [ ] **F10** Concept–Themes cross-link `concept_themes` junction + UI. *(STATUS F10)*

## Broadcast follow-ups (optional)

- [ ] Platform filter / extra columns (LinkedIn vs Instagram) in Broadcast tab — data model already supports arbitrary slugs. *(PROJECT_SYNTHESIS §3)*
- [ ] Real "unread" cursor for VIP — currently `vipUnseen` counts VIP in fetched window only. *(PROJECT_SYNTHESIS §3)*

## Architecture / scaling (ROADMAP)

- [ ] Per-tab lazy fetch for Atelier reference payloads — first œuvres chunk + keyset shipped; junction + lookup tables still ride RSC `Promise.all`. *(ROADMAP near-term)*
- [ ] Reports / analytics: keep aligned with keyset catalogue totals; heavier server-side reports without unbounded reads. *(ROADMAP near-term)*
- [ ] Overview pipeline pulse off client Supabase — migrate remaining widgets to server + tags. *(ROADMAP near-term)*
- [ ] Status labels via dictionary vs `STATUS_LABEL_MAP` — needs thin shared layer to avoid full dict in client bundle. *(ROADMAP hardening)*

## Necessities to remember (not new work; guardrails)

- Every new public table ships `ENABLE ROW LEVEL SECURITY` + policies + explicit `GRANT` per `supabase/sql/inquiry.sql`. *(CLAUDE 🛂 GRANTS)*
- EU R2 endpoint on every new R2 call: `https://<account_id>.eu.r2.cloudflarestorage.com`. *(CLAUDE)*
- All user-visible strings via `useI18n().t(key)` or `dict[lang][key]`; FR + EN in same edit. *(CLAUDE 🌐)*
- Mobile contract: 375px smoke before shipping any drawer/form change; ≥44px taps; safe-area padding. *(CLAUDE 📱)*
- New append-only audit tables: extend `audit_log_prune()` from day one. *(CLAUDE)*
