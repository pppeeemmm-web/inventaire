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

## Related code

| Area | Path |
|------|------|
| UI | `components/atelier/SystemTab.tsx` |
| Ledger screenshot upload | `app/atelier/system/ledger-attachment-actions.ts` |
| Site map checklist PDF | `app/atelier/vault/actions.ts` → `exportSiteMapChecklistPdf` |
| Studio Bible vault | `app/atelier/vault/bible-action.ts` → `vaultStudioBible` |
| Copy (strings) | `lib/i18n/dictionary.ts` (`system_*`, `system_task_type_*`) |
