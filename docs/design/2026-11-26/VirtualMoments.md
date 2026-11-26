# Moments as a way of reading — the virtual moments stream

Status: **design note, nothing built, no SQL written or applied.** Pem 2026-11-26: « the concept of moments is
extremely valuable… it can encompass everything » · « you may query in a way to realise the moments table virtually » ·
« makes me think of the history field where everything important is written auto ».

## Which kind of thing, which home, what changes
- **Kind:** a read. « On this day, this happened » — one row per thing that happened, each read from its own home.
- **Home:** none new. Every record keeps its table (orders, papers, voice notes, works…); `moment` stays the home of
  touches with no life of their own (People.md §4). The stream is a **database view** over those homes: a view is a
  read, so a change of mind costs a view, never a migration of data (Building principles, last paragraph).
- **What changes:** one place answers « what happened on day X / in month Y / to work N / with person P », instead of
  each screen assembling its own union (the Journal day read, the person timeline, the Mois / Années counts).

## Proof on live (read only, 2026-11-26)
One query over 25 homes, nothing written. 17 hold dated rows:

| Kind (home) | Rows | Since 1 Nov |
|---|---|---|
| Work photo added (`tblImage.DateAdded`) | 1,236 | 18 |
| Work added (`nodes.created_at`, oeuvre) | 1,181 | 10 |
| Remark on a work / idea (`note_line`) | 116 | 8 |
| Creation step (`work_creation_step.on_date`) | 53 | 0 |
| Journal note (`journal_entry.event_on`) | 43 | 24 |
| Création item, old (`kaizen_item`) | 33 | 3 |
| Voice note (`voice_note`) | 24 | 17 |
| Paper (`document.doc_date`) | 18 | 10 |
| Inspiration photo (`inspiration_photo.day`) | 9 | 9 |
| Expense (`expense.date`) | 7 | 0 |
| Production finished (`Oeuvres.production_completed_on`) | 5 | 4 |
| Enquiry (`inquiry`) | 4 | 0 |
| Condition report (`condition_report.examined_on`) | 3 | 1 |
| Work destroyed / lost (`Oeuvres.fate_on`) | 2 | 0 |
| Idea moved / reworked (`concept_change`) | 2 | 2 |
| Order cancelled / signed (`work_order`) | 2 / 1 | 2 / 0 |

Read from it:
- The idea holds: every home already answers « what happened that day »; together they are one stream from April on.
- The catalogue dominates (~2,400 of the rows): works and their photos are shown as **one card per day** (Pem's choice
  for works added).
- Sales-side homes are nearly empty of dates: `payments`, `invoice`, `shipment` have none; one signed order. A year view
  would look quiet on sales until those dates are recorded.
- `moment` itself is empty (no call or visit recorded yet).
- One remark is dated 1999 (`note_line.created_at`), probably an imported date — to look at with Pem, not to change.

## The view (to write after Pem's GO)
`journal_moments` — columns: `day` (Paris date), `kind`, `source` (table), `source_id`, `oeuvre_id` (nullable),
`contact_id` (nullable), `concept_id` (nullable).
- **`security_invoker = true`** (Postgres 15+): the view reads with the reader's rights, so RLS on each home still
  decides what a team member sees (private moments, admin-only work versions, private notebook entries). Without it a
  view would read as its owner and leak.
- Left out on purpose: logs (`system_log`, `page_view`), indexes (`nodes` except « work added »), embeddings, caches,
  link-table housekeeping.
- Corrections rule (Journal): a corrected entry counts once (latest visible correction), as every Journal reader does.
- Proof on the throwaway copy: the same counts as the table above, a team member's counts without private rows.

## Who would read it
1. Journal « Mois / Années » counts and day paging — today `journal_scale` misses moments, works added and
   anything not in its list; the view would make them complete in one move.
2. A work's card: « Tout ce qui lui est arrivé », by date — the view filtered by `oeuvre_id`.
3. The person timeline (`person-timeline.ts`) assembles its own union in code today; it could read the view filtered by
   `contact_id` (later, only if it stays as fast).

## The Historique field (Pem's thought)
`Oeuvres.Historique` is the work's story **written as text by the database** (`trg_zz_oeuvre_history`, ARCHITECTURE
§3 row 10: status lines « Vendu à X », « Réservé — X », destroyed / lost / found, custodian lines; rule 14 of
WORK_RULES). It is the same idea — everything important, written automatically — but stored as a copy, per work, in
words. The view is the read across all homes.
- They do not compete: Historique stays the readable narrative (and `restoreOeuvreVersion` carries it). The view gives
  the dates and links Historique's text cannot (open the paper, the order, the voice note).
- Possible later: the work card shows the view's lines for that work beside Historique; whether Historique's own lines
  then come from the view instead of being written as text is a decision for Pem, not proposed here.

## Open for Pem
1. GO to write the view and prove it on the throwaway copy?
2. First reader: Mois / Années (closes the gap found in review), or the work card « Tout ce qui lui est arrivé »?
3. The 1999 remark: look at it together.
