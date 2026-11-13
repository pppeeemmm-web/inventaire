-- Wider index text for works (owner GO 2026-11-13).
--
-- Before: Titre + Commentaires + Technique. 912 of 1 176 works have no title and 1 077 no
-- comments, so most works were indexed on their technique alone (61 had no text at all).
-- Now: title. comments. technique, support, year. themes. period. sources (+ note). colours
-- (families covering >= 8 % of the cover image, up to 4, largest first).
--
-- Period = manual override, else the period containing the year (Année, else production start
-- year); overlaps: latest start, then shortest — same rule as lib/work-periods.ts.
--
-- Themes named like a working code (start with a year + "_" or "-", e.g. "2026_W32-6_BN",
-- 578 links on 2026-11-13) are left out: they group selections, they do not describe the work.
--
-- Re-index marks: a work is re-embedded when its title, comments, technique, support, year or
-- production start change, or its themes, sources, period override or cover palette change.
-- Renaming a theme / period / source does not re-mark its works: run
-- `npm run embed:worker -- --reembed-all` after a rename that matters.

create or replace function public.oeuvre_search_text(p_oid integer)
returns text
language sql
stable
set search_path to 'public'
as $$
  select concat_ws(
    '. ',
    nullif(btrim(o."Titre"), ''),
    nullif(btrim(o."Commentaires"), ''),
    nullif(concat_ws(', ', tech."Technique", sup."Support", y.yr::text), ''),
    (select string_agg(t.name, ', ' order by t.name)
       from public.oeuvre_theme ot join public.theme t on t.id = ot.theme_id
      where ot.oeuvre_id = o."OeuvreID" and t.name !~ '^\d{4}[_-]'),
    case
      when ov.oeuvre_id is not null then (select wp.name from public.work_period wp where wp.id = ov.period_id)
      else (select wp.name from public.work_period wp
             where y.yr is not null and wp.start_year <= y.yr and (wp.end_year is null or wp.end_year >= y.yr)
             order by wp.start_year desc, coalesce(wp.end_year, 9999) - wp.start_year asc
             limit 1)
    end,
    (select string_agg(concat_ws(' — ', ws.name, nullif(btrim(wsl.note), '')), ', ' order by ws.name)
       from public.work_source_link wsl join public.work_source ws on ws.id = wsl.source_id
      where wsl.oeuvre_id = o."OeuvreID"),
    (select 'colours: ' || string_agg(replace(f.family, '_', ' '), ', ' order by f.share desc)
       from (
         select p ->> 'family' as family, (p ->> 'share')::numeric as share
           from public."tblImage" i, jsonb_array_elements(i.palette) p
          where i."OeuvreID" = o."OeuvreID" and i.is_cover and jsonb_typeof(i.palette) = 'array'
            and (p ->> 'share')::numeric >= 0.08
          order by 2 desc
          limit 4
       ) f)
  )
  from public."Oeuvres" o
  left join public."Technique" tech on tech."TechniqueID" = o."Technique"
  left join public."Support" sup on sup."SupportID" = o."Support"
  left join public.work_period_override ov on ov.oeuvre_id = o."OeuvreID"
  cross join lateral (
    select coalesce(extract(year from o."Année"), extract(year from o.production_started_on))::int as yr
  ) y
  where o."OeuvreID" = p_oid;
$$;

revoke execute on function public.oeuvre_search_text(integer) from public, anon, authenticated;

create or replace function public.node_search_text(p_node_id uuid)
returns text
language sql
stable security definer
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
          SELECT je.body
          FROM public.journal_entry je
          WHERE je.id::text = n.source_pk AND je.hidden_at IS NULL AND je.visibility = 'team'
        )
        ELSE NULL
      END
    ),
    ''
  )
  FROM public.nodes n
  WHERE n.node_id = p_node_id;
$function$;

-- node_search_text keeps its grants (service role only, security_definer_revoke_anon.sql).

-- ── Re-index marks ───────────────────────────────────────────────────────────────────────────
drop trigger if exists graph_oeuvre_embedding_dirty on public."Oeuvres";
create trigger graph_oeuvre_embedding_dirty
after update of "Titre", "Commentaires", "Technique", "Support", "Année", production_started_on
on public."Oeuvres"
for each row execute function graph_trg_oeuvre_embedding_dirty();

-- Child rows: TG_ARGV[0] = the column holding the work id.
create or replace function public.graph_trg_oeuvre_child_dirty()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old text := case when tg_op <> 'INSERT' then to_jsonb(old) ->> tg_argv[0] end;
  v_new text := case when tg_op <> 'DELETE' then to_jsonb(new) ->> tg_argv[0] end;
begin
  if v_new is not null then perform public.graph_mark_nodes_pending('oeuvre', v_new); end if;
  if v_old is not null and v_old is distinct from v_new then
    perform public.graph_mark_nodes_pending('oeuvre', v_old);
  end if;
  return null;
end;
$$;

revoke execute on function public.graph_trg_oeuvre_child_dirty() from public, anon, authenticated;

drop trigger if exists graph_oeuvre_theme_text_dirty on public.oeuvre_theme;
create trigger graph_oeuvre_theme_text_dirty
after insert or delete on public.oeuvre_theme
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

drop trigger if exists graph_work_source_text_dirty on public.work_source_link;
create trigger graph_work_source_text_dirty
after insert or update or delete on public.work_source_link
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

drop trigger if exists graph_work_period_text_dirty on public.work_period_override;
create trigger graph_work_period_text_dirty
after insert or update or delete on public.work_period_override
for each row execute function public.graph_trg_oeuvre_child_dirty('oeuvre_id');

drop trigger if exists graph_image_palette_text_dirty on public."tblImage";
create trigger graph_image_palette_text_dirty
after insert or delete or update of palette, is_cover on public."tblImage"
for each row execute function public.graph_trg_oeuvre_child_dirty('OeuvreID');

-- ── One-time: re-index every work with the wider text ────────────────────────────────────────
update public.nodes
   set embedding_status = 'pending', embedding_dirty_at = now()
 where node_type = 'oeuvre';
