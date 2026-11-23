-- ✦ suggestions from the text shown (Pem 2026-11-23: « the idea is to get one text from which you can
-- trigger AI suggestions »). Until now an entry was embedded and given its link proposals once, from the
-- text it was written with — for a voice note, the phone's words or a placeholder — and a correction (the
-- PC transcript, Pem's own words) never fed the suggestions.
--   1. node_search_text: a journal entry's text = its latest visible correction, else its own body; a
--      correction has no text of its own (one node per entry); a placeholder has none.
--   2. When a visible correction is written, the entry's node is marked to embed again and its
--      `ai_links_at` cleared, so journal_propose_links runs again on the new text (works AND ideas, as
--      before). A suggestion already accepted or rejected is never made again (unique entry × target).
-- Hidden corrections (a PC transcript kept as a proposal beside Pem's words) change nothing.
-- Proven on the throwaway copy first, then live with Pem's OK.

begin;

create or replace function public.node_search_text(p_node_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT nullif(
    trim(
      CASE n.node_type
        WHEN 'oeuvre' THEN (
          SELECT public.oeuvre_search_text(o."OeuvreID")
          FROM public."Oeuvres" o
          WHERE o."OeuvreID"::text = n.source_pk
        )
        WHEN 'contact' THEN (
          SELECT concat_ws(
            '. ',
            concat_ws(' ', c."Prénom", c."Nom"),
            c."NomInstitution",
            c."Notes"
          )
          FROM public."Contact" c
          WHERE c."ContactID"::text = n.source_pk
        )
        WHEN 'theme' THEN (
          SELECT t.name FROM public.theme t WHERE t.id::text = n.source_pk
        )
        WHEN 'concept' THEN (
          SELECT concat_ws('. ', cp.titre, cp.description)
          FROM public.concept cp
          WHERE cp.id::text = n.source_pk
        )
        WHEN 'working_group' THEN (
          SELECT concat_ws('. ', wg.name, wg.note)
          FROM public.working_group wg
          WHERE wg.id::text = n.source_pk
        )
        WHEN 'exhibition' THEN (
          SELECT concat_ws(
            '. ',
            sp.nom,
            sp.localisation,
            concat_ws(' – ', sp.date_debut::text, sp.date_fin::text),
            sp.notes
          )
          FROM public.suivi_process sp
          WHERE sp.id::text = n.source_pk AND sp.type = 'exposition'
        )
        WHEN 'journal_entry' THEN (
          -- The text shown: the latest visible correction, else the entry's own body. A correction is never
          -- a node of its own; a placeholder (« (rien entendu) », « (transcription à venir) ») has no text.
          SELECT CASE WHEN shown.t IN ('(rien entendu)', '(transcription à venir)') THEN NULL ELSE shown.t END
          FROM public.journal_entry je
          CROSS JOIN LATERAL (
            SELECT coalesce((
              SELECT fx.body FROM public.journal_entry fx
              WHERE fx.corrects_id = je.id AND fx.hidden_at IS NULL
              ORDER BY fx.created_at DESC
              LIMIT 1
            ), je.body) AS t
          ) shown
          WHERE je.id::text = n.source_pk AND je.corrects_id IS NULL AND je.hidden_at IS NULL AND je.visibility = 'team'
        )
        ELSE NULL
      END
    ),
    ''
  )
  FROM public.nodes n
  WHERE n.node_id = p_node_id;
$function$;

-- A visible correction written → its entry is embedded again and given suggestions again.
create or replace function public.journal_correction_resuggest()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.corrects_id is not null and new.hidden_at is null then
    update public.journal_entry set ai_links_at = null where id = new.corrects_id and ai_links_at is not null;
    perform public.graph_mark_nodes_pending('journal_entry', new.corrects_id::text);
  end if;
  return new;
end;
$$;
revoke execute on function public.journal_correction_resuggest() from public, anon, authenticated;

drop trigger if exists trg_journal_correction_resuggest on public.journal_entry;
create trigger trg_journal_correction_resuggest after insert on public.journal_entry
  for each row execute function public.journal_correction_resuggest();

commit;
