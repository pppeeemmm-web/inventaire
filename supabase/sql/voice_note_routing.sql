-- Voice-note triage: route a note to where it belongs (link, never copy — the note stays).
-- `concept_id` links a note to a Recherche concept; `oeuvre_id` / `process_id` already exist.
-- `routed_at` marks a note as sorted (set when routed, or when kept as a plain note);
-- NULL = "à trier". Existing RLS on voice_note (owner or admin) covers the new columns.

alter table public.voice_note
  add column if not exists concept_id uuid references public.concept(id) on delete set null,
  add column if not exists routed_at timestamptz;

create index if not exists voice_note_concept_id_idx on public.voice_note (concept_id);

comment on column public.voice_note.concept_id is 'Recherche concept this note was routed to (link only).';
comment on column public.voice_note.routed_at is 'When the note was triaged; NULL = still to sort.';
