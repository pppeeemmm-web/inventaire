# Plan: Wire WorkDrawer into InventoryTab (replace InvPreview)

## Context

WorkDrawer.tsx is already built with visual pipeline bar, anonymity gates, admin override, and image zoom/pan. The DB migration (`admin_override_anonymity` column + trigger update) is already applied. The `actions.ts` already handles the new column.

**Problem**: The real app's `InventoryTab.tsx` still calls the old `InvPreview` function at line 702. The WorkDrawer replacement never took effect because the file copy failed in a previous session. The user sees the old read-only InvPreview with an "EDIT" button instead of the new WorkDrawer with pipeline + visibility + zoom.

---

## Changes Required

### 1. `components/atelier/InventoryTab.tsx`

**a) Add import** (top of file, after existing imports):
```tsx
import { WorkDrawer } from './WorkDrawer'
```

**b) Add `contacts` and `presentations` to props** (line ~192-201):
```tsx
export function InventoryTab({
  oeuvres, tM, sM, cM, pM, locMap, statusLabelMap,
  techniques, supports, formats = [], themes = [], groups = [],
  contacts = [], presentations = [],  // ← ADD
  selection, setSelection, onOpen,
}: SharedProps & {
  techniques: ...
  supports:   ...
  formats?:   ...
  themes?:    ...
  groups?:    ...
  contacts?:  { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  presentations?: { PresentationID: number; Nom: string | null }[]
}) {
```

**c) Replace InvPreview call** (line 701-711) with WorkDrawer:
```tsx
{showPreview && (
  <WorkDrawer
    o={focused}
    mode="panel"
    tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap}
    statusLabelMap={statusLabelMap}
    selection={selection} toggleInSel={toggleInSel}
    onClose={() => setShowPreview(false)}
    onEdit={onOpen}
    thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
    groupNameMap={groupNameMap}
    techniques={techniques} supports={supports} formats={formats}
    themes={themes} contacts={contacts} groups={groups}
    presentations={presentations}
    expanded={previewExpanded}
    setExpanded={setPreviewExpanded}
  />
)}
```

**d) Delete dead `InvPreview` function** (line 1165 to end of function, ~460 lines of dead code).

### 2. `components/atelier/TeamPortalClient.tsx`

**Pass `contacts` and `presentations` to InventoryTab** (line ~415-427):
```tsx
<InventoryTab
  ...existing props...
  contacts={contacts}
  presentations={presentations}
/>
```

### 3. Copy to real app

After editing worktree files, copy both modified files to the real app directory:
- `components/atelier/InventoryTab.tsx`
- `components/atelier/TeamPortalClient.tsx`
- `components/atelier/WorkDrawer.tsx` (already there but re-copy for safety)

---

## Verification

- `npm run dev` (already running from real app at port 3000)
- Open Atelier → Inventory tab → click a work in list view
- Confirm: panel shows WorkDrawer with segmented pipeline bar, visibility gate, image zoom (scroll wheel), filmstrip
- Confirm: NO "EDIT" button — fields are always-on editable
- Confirm: zoom works (mouse wheel on image)
- Confirm: overlay mode still works (double-click image from TeamPortalClient)

---

# DEFERRED: End-of-return-window auto-transition (statusId 6 → 5)

## Context (from automation-train-fixes plan)
After a sale completes (statusId 6 = Vendu), the legal return window must expire
before the work can be moved to "Archive privée" (statusId 5 = out of primary
market, owner's location). Today this transition is fully manual.

## Legal baseline
- **France (B2C distance sales)**: 14 days post-delivery — Code de la consommation L221-18.
- **France (B2B / commercial sales)**: no statutory window; depends on contract.
- **Cross-border sales**: jurisdiction of buyer often controls. Variable.
- **Galleries / auctions**: separate frameworks (e.g. droit de préemption, droit de suite).

This is too varied to bake a single global value into the system.

## What needs building (when picked up)
1. **Per-contract override field** on `sale_order`:
   - `return_window_days int default 14` (FR baseline)
   - `return_window_starts_at date` (defaults to delivered_at or completion_date)
2. **Scheduled job** (Supabase pg_cron OR Next.js route hit by an external cron):
   - Find sale_order rows where `statut='completed'` and `(return_window_starts_at + return_window_days * INTERVAL '1 day') < now()`
   - For each: update linked Oeuvres `statusId 6 → 5` (only if still 6 — don't override gifts or re-sales)
   - Log STATUS_CHANGE with metadata `{ trigger: 'return_window_expired' }`
3. **UI surfacing**:
   - On sale_order detail (SalesTab): show "Return window expires in X days" countdown.
   - On WorkDrawer for statusId=6 works: show same countdown as a passive hint.
4. **Visibility check**: confirm the existing `sync_is_public_from_status` trigger
   excludes statusId 5 from the public set (it does — current public set is
   `[2, 4, 6, 7, 8, 11]`). So a 6→5 flip will automatically hide the work from
   public-facing pages. No additional trigger work needed.

## Open questions before building
- Should statusId 5 also lock down editing of the work (read-only)?
- Should the cron run daily or hourly? (Daily probably fine — 14-day windows.)
- Need a manual "Skip waiting period" button for galleries with their own
  internal acceptance criteria?

## Related files when implementing
- `app/atelier/sales/actions.ts` — add window fields to insert/update flows
- `lib/types/database.ts` — extend SaleOrderRow + Oeuvre
- `components/atelier/SalesTab.tsx` — countdown UI
- New SQL file `supabase/sql/return_window.sql` — schema + cron function
- `supabase/sql/` — pg_cron setup (or external trigger)
