-- Found-work flow, database part (FoundWorkFlow.md, decided by Pem 2026-11-27; build GO « Ok i like the todo list
-- sequence go »). PROPOSAL — not applied; live only on Pem's own OK, after the throwaway test
-- (found_work_history_line.test.sql).
--
-- 1. oeuvre_history (Historique lines are written by the database, WORK_RULES rule 14) gains one branch: when a work's
--    production_origin changes to 'found', « [date] Retrouvée — œuvre oubliée, jamais cataloguée (année) ».
--    The rest of the function is unchanged (body = work_state_rules.sql, checked equal to live 2026-11-27).
--    Trigger unchanged (trg_zz_oeuvre_history, BEFORE UPDATE). At creation the app writes the first line (saveWork).
-- 2. One-off (separate statement below, run once with the same OK): #2410–#2412, entered 2026/11/24 as « Atelier »,
--    get the found line in place of that first line.
-- No GRANT / RLS / column change.

create or replace function public.oeuvre_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d text := to_char((now() at time zone 'Europe/Paris')::date, 'YYYY/MM/DD');
  lines text[] := '{}';
  ln text;
  hist text;
  v_exam date;
  v_found date;
  old_loc integer := coalesce(old."LocalisationID", old."ContactID");
  new_loc integer := coalesce(new."LocalisationID", new."ContactID");
  st_fr text[] := array['En production', 'Disponible', 'Archive artiste', 'Réservé', 'statut 5',
                        'Vendu', 'Consigné', 'Prêt', 'Détruite', 'Perdue', 'Don'];
begin
  if new.fate is distinct from old.fate then
    if new.fate is not null then
      -- Destroyed / lost: dated at the event; the report day follows when it differs.
      select r.examined_on into v_exam
        from condition_report r
       where r.oeuvre_id = new."OeuvreID" and r.kind = new.fate and r.resolved_on is null
       order by coalesce(r.event_on, r.examined_on) desc, r.id desc
       limit 1;
      ln := '[' || case coalesce(new.fate_precision, 'day')
                     when 'year'  then to_char(coalesce(new.fate_on, v_exam), 'YYYY')
                     when 'month' then to_char(coalesce(new.fate_on, v_exam), 'YYYY/MM')
                     else to_char(coalesce(new.fate_on, v_exam), 'YYYY/MM/DD') end
            || '] ' || case new.fate when 'destroyed' then 'Détruite' else 'Perdue' end
            || case when v_exam is not null and new.fate_on is not null and new.fate_on <> v_exam
                    then ' — constat du ' || to_char(v_exam, 'YYYY/MM/DD') else '' end;
      lines := lines || ln;
    else
      -- Fate gone: a lost work found (its report closed just now), or the report removed.
      select r.resolved_on into v_found
        from condition_report r
       where r.oeuvre_id = new."OeuvreID" and r.kind = 'lost' and r.resolved_on is not null
         and old.fate = 'lost' and r.updated_at >= now() - interval '1 minute'
       order by r.updated_at desc, r.id desc
       limit 1;
      if v_found is not null then
        lines := lines || ('[' || to_char(v_found, 'YYYY/MM/DD') || '] Retrouvée');
      else
        lines := lines || ('[' || d || '] Constat de '
                           || case old.fate when 'destroyed' then 'destruction' else 'perte' end || ' supprimé');
      end if;
    end if;
  elsif new."statusId" is distinct from old."statusId" and new."statusId" is not null then
    ln := '[' || d || '] ' || case new."statusId"
      when 11 then 'Don à ' || oeuvre_contact_label(new."ContactID")
      when 6  then 'Vendu à ' || oeuvre_contact_label(new."ContactID")
      when 4  then 'Réservé — ' || oeuvre_contact_label(coalesce(new."AcheteurID", new."ContactID"))
      when 7  then 'Consigné — ' || oeuvre_contact_label(new."LocalisationID")
      when 8  then 'Prêt — ' || oeuvre_contact_label(new."LocalisationID")
      else case
        when new."statusId" = 2 and old."statusId" in (7, 8) then 'Retour atelier'
        else coalesce(st_fr[old."statusId"], '?') || ' → ' || coalesce(st_fr[new."statusId"], 'statut ' || new."statusId")
      end
    end;
    lines := lines || ln;
  end if;

  -- An old work entered now (production_origin becomes 'found' — FoundWorkFlow.md, Pem 2026-11-27): one dated line,
  -- distinct from « Retrouvée » alone (a lost work found again, fate branch above). The year only when known.
  if new.production_origin = 'found' and old.production_origin is distinct from 'found' then
    lines := lines || ('[' || d || '] Retrouvée — œuvre oubliée, jamais cataloguée'
                       || case when new."Année" is not null then ' (' || to_char(new."Année", 'YYYY') || ')' else '' end);
  end if;

  if new_loc is not null and new_loc is distinct from old_loc then
    lines := lines || (d || ' - ' || oeuvre_contact_label(new_loc, true));
  end if;

  if cardinality(lines) = 0 then
    return new;
  end if;

  hist := nullif(new."Historique", '');
  foreach ln in array lines loop
    -- Skip a line already there (an older screen may have written it in the same save).
    if position(E'\n' || ln || E'\n' in E'\n' || replace(coalesce(hist, ''), E'\r', '') || E'\n') = 0 then
      hist := concat_ws(E'\n', hist, ln);
    end if;
  end loop;
  new."Historique" := hist;
  return new;
end;
$$;


-- ── One-off: #2410–#2412 (Maroselli, found in Madrid; first line written as « Atelier » on 2026/11/24) ─────────────
update public."Oeuvres"
   set "Historique" = regexp_replace("Historique", '^\[2026/11/24\] Atelier', '[2026/11/24] Retrouvée — œuvre oubliée, jamais cataloguée (' || to_char("Année", 'YYYY') || ')')
 where "OeuvreID" in (2410, 2411, 2412)
   and production_origin = 'found'
   and "Historique" like '[2026/11/24] Atelier%';
