-- Retire the old free-text « Commentaires » field on works (Pem 2026-11-18, form: « Empty the 94, move the 8
-- into a line, hide the field »). Notes on a work are note lines now (note_line, target 'work', R1 step 7,
-- scripts/old-notes-to-lines.mjs, 2026-11-17).
--
-- Live on 2026-11-18, 102 works had text in "Oeuvres"."Commentaires":
--   94 — the same text is already in a note line of that work (compared with spaces / line breaks folded,
--        3 of them differ only by \r\n or a trailing word added in the line, e.g. #2381) → emptied.
--    6 — « ? » only (#286, 349, 351, 366, 370, 1303): a placeholder, which Pem's 2026-11-17 rule 4 drops
--        rather than makes a line → emptied.
--    2 — works in the bin (#2343 « test », #2398): the line move skips the bin → left as they are.
-- So no new line is needed. Every emptied value stays in oeuvre_versions (the BEFORE UPDATE snapshot), so a
-- work can be restored from Audit. Today's Journal (admin, « Attributs modifiés ») lists these works once.
--
-- Search: oeuvre_search_text read the old field; it now reads the work's note lines instead (all lines,
-- oldest first), and a note line added / edited / removed re-marks its work for the semantic index, like
-- themes and sources do (oeuvre_search_text_wider.sql). Run `npm run embed:worker` on the PC afterwards.
--
-- The app stops showing the field (components/atelier/work-drawer/DrawerContent.tsx). The column stays.

do $$
declare
  v_def text;
  v_old text := 'nullif(btrim(o."Commentaires"), ''''),';
  v_new text := '(select string_agg(btrim(nl.body), ''. '' order by nl.created_at, nl.id)
       from public.note_line nl
      where nl.target_kind = ''work'' and nl.oeuvre_id = o."OeuvreID" and nullif(btrim(nl.body), '''') is not null),';
begin
  select pg_get_functiondef('public.oeuvre_search_text(integer)'::regprocedure) into v_def;
  if position(v_old in v_def) = 0 then
    raise exception 'oeuvre_search_text: expected Commentaires expression not found';
  end if;
  execute replace(v_def, v_old, v_new);
end;
$$;

drop trigger if exists graph_note_line_text_dirty on public.note_line;
create trigger graph_note_line_text_dirty
after insert or delete or update of body, oeuvre_id on public.note_line
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

-- Data: empty the 94 already in a line + the 6 « ? » placeholders. Expect 100 rows.
with w as (
  select o."OeuvreID" as id, regexp_replace(btrim(o."Commentaires"), '\s+', ' ', 'g') as c
    from public."Oeuvres" o
   where nullif(btrim(o."Commentaires"), '') is not null
)
update public."Oeuvres" o
   set "Commentaires" = null
  from w
 where o."OeuvreID" = w.id
   and (
     exists (select 1 from public.note_line n
              where n.target_kind = 'work' and n.oeuvre_id = w.id
                and position(w.c in regexp_replace(n.body, '\s+', ' ', 'g')) > 0)
     or (w.c = '?' and o.deleted_at is null)
   );

-- Works whose lines were never part of their index text: re-mark them once.
select public.graph_mark_nodes_pending('oeuvre', n.oeuvre_id::text)
  from (select distinct oeuvre_id from public.note_line where target_kind = 'work' and oeuvre_id is not null) n;
