-- Work rule checks — docs/WORK_RULES.md §2, one query per rule (2–10, 12–14, 17). READ ONLY: every statement is a
-- SELECT; nothing here writes, creates or grants. Each query returns the works that break its rule
-- (columns: rule, oeuvre_id, titre, detail) and must come back EMPTY.
--
-- Run: Supabase SQL editor / MCP execute_sql / psql, one statement at a time or the whole file.
-- The Audit « Règles » panel runs the same checks (lib/work-rules-checks.ts) — keep both in step:
-- a rule changed here is changed there in the same commit.
-- Deleted works (deleted_at set) are left out everywhere.
--
-- Rules with no state to check (they are about a move, or about code):
--   1  the stage may go back — a move, not a state.
--   11 « a gift is status 11 » — the duplicate flag is being dropped (work_state_drop_duplicates.sql);
--      status 11 itself is checked by rules 9 / 10.
--   15 deleting a sold / given work is admin only — a guard on the act (oeuvre_soft_delete_gate).
--   16 « in production » means one thing — one function in the code (lib/production-scope.ts).
--
-- Known and accepted (not breaks, the day is unknown — WORK_RULES §2):
--   7  95 tasks ticked before 2026-11-17 keep no date: only tasks created since are checked.
--   8  1 076 Prêt works with no end date: only an end date on a work NOT Prêt is a break.

-- ── Rule 2: Catalogué needs at least one photo ──────────────────────────────────────────────
select '2' as rule, o."OeuvreID" as oeuvre_id, o."Titre" as titre, 'catalogué, aucune photo' as detail
  from public."Oeuvres" o
 where o.deleted_at is null and coalesce(o."Catalogué", false)
   and not exists (select 1 from public."tblImage" i where i."OeuvreID" = o."OeuvreID")
 order by 2;

-- ── Rule 3: Disponible needs the photo validated (catalogued, photo done) ───────────────────
select '3' as rule, o."OeuvreID", o."Titre", 'Disponible sans photo validée'
  from public."Oeuvres" o
 where o.deleted_at is null and o."statusId" = 2
   and (not coalesce(o."Catalogué", false) or coalesce(o."NeedsPhotograph", false))
 order by 2;

-- ── Rule 4: Archive = catalogued, tasks paused ──────────────────────────────────────────────
select '4' as rule, o."OeuvreID", o."Titre",
       case when not coalesce(o."Catalogué", false) then 'archivée sans être cataloguée'
            else 'archivée avec une tâche ouverte non mise en pause' end
  from public."Oeuvres" o
 where o.deleted_at is null and o."statusId" = 3
   and (not coalesce(o."Catalogué", false)
        or exists (select 1 from public.work_action a
                    where a.oeuvre_id = o."OeuvreID" and not a.done and a.paused_at is null))
 order by 2;

-- ── Rule 5: in the studio (1 / 2, no fate) the status follows the stage ────────────────────
select '5' as rule, o."OeuvreID", o."Titre",
       'statut ' || o."statusId" || ' alors que l''étape donne '
         || case when coalesce(o."Catalogué", false) and not coalesce(o."NeedsPhotograph", false) then 2 else 1 end
  from public."Oeuvres" o
 where o.deleted_at is null and o.fate is null and o."statusId" in (1, 2)
   and o."statusId" <> case when coalesce(o."Catalogué", false) and not coalesce(o."NeedsPhotograph", false)
                            then 2 else 1 end
 order by 2;

-- ── Rule 6: tasks follow the stage (9 = Cataloguer, 6 = Photographier; open = not done) ─────
select '6' as rule, o."OeuvreID", o."Titre", d.detail
  from public."Oeuvres" o
  cross join lateral (
    select case
      when not coalesce(o."Catalogué", false)
           and not exists (select 1 from public.work_action a
                            where a.oeuvre_id = o."OeuvreID" and a.action_type_id = 9 and not a.done)
        then 'non cataloguée, pas de tâche Cataloguer ouverte'
      when coalesce(o."Catalogué", false)
           and exists (select 1 from public.work_action a
                        where a.oeuvre_id = o."OeuvreID" and a.action_type_id = 9 and not a.done)
        then 'cataloguée, tâche Cataloguer encore ouverte'
      when coalesce(o."Catalogué", false) and coalesce(o."NeedsPhotograph", false)
           and not exists (select 1 from public.work_action a
                            where a.oeuvre_id = o."OeuvreID" and a.action_type_id = 6 and not a.done)
        then 'photo à faire, pas de tâche Photographier ouverte'
      when not (coalesce(o."Catalogué", false) and coalesce(o."NeedsPhotograph", false))
           and exists (select 1 from public.work_action a
                        where a.oeuvre_id = o."OeuvreID" and a.action_type_id = 6 and not a.done)
        then 'tâche Photographier ouverte hors de l''étape photo'
    end as detail
  ) d
 where o.deleted_at is null and d.detail is not null
 order by 2;

-- ── Rule 7: a ticked task keeps the day it was ticked (tasks created since 2026-11-17) ──────
select '7' as rule, o."OeuvreID", o."Titre", 'tâche #' || a.id || ' cochée sans date'
  from public.work_action a
  join public."Oeuvres" o on o."OeuvreID" = a.oeuvre_id
 where o.deleted_at is null and a.done and a.done_at is null
   and a.created_at >= timestamptz '2026-11-17 00:00 Europe/Paris'
 order by 2;

-- ── Rule 8: an end of production only on a Prêt work ────────────────────────────────────────
select '8' as rule, o."OeuvreID", o."Titre",
       'fin ' || to_char(o.production_completed_on, 'YYYY-MM-DD') || ' sur une œuvre pas Prête'
  from public."Oeuvres" o
 where o.deleted_at is null and o.production_completed_on is not null
   and not (coalesce(o."Catalogué", false) and not coalesce(o."NeedsPhotograph", false))
 order by 2;

-- ── Rule 9: owner / custodian / address follow the stage (WORK_CUSTODY_MODEL.md, 13 = Pem) ──
select '9' as rule, o."OeuvreID", o."Titre", d.detail
  from public."Oeuvres" o
  cross join lateral (
    select case
      when o."statusId" in (1, 2, 3, 4) and coalesce(o."ContactID", 13) <> 13
        then 'à l''atelier / réservée mais propriétaire ≠ Pem'
      when o."statusId" in (1, 2, 3) and coalesce(o."LocalisationID", 13) <> 13
           and not public.oeuvre_order_exists(o."OeuvreID", 'entrusted', o."LocalisationID")
        then 'à l''atelier mais détenue ailleurs sans ordre « Confié »'
      when o."statusId" in (7, 8) and coalesce(o."ContactID", 13) <> 13
        then 'consignée / prêtée mais propriétaire ≠ Pem'
      when o."statusId" in (7, 8) and coalesce(o."LocalisationID", 13) = 13
        then 'consignée / prêtée sans dépositaire'
      when o."statusId" in (6, 11) and coalesce(o."ContactID", 13) = 13
        then 'vendue / donnée mais propriétaire = Pem'
      when o.localisation_address_id is not null
           and not exists (select 1 from public.contact_addresses ca
                            where ca.id = o.localisation_address_id and ca.contact_id = o."LocalisationID")
        then 'adresse qui n''est pas celle du détenteur'
    end as detail
  ) d
 where o.deleted_at is null and d.detail is not null
 order by 2;

-- ── Rule 10: a work leaves Pem only through an order ────────────────────────────────────────
select '10' as rule, o."OeuvreID", o."Titre", d.detail
  from public."Oeuvres" o
  cross join lateral (
    select case
      when o."statusId" in (7, 8)
           and not public.oeuvre_order_exists(o."OeuvreID", 'custody', o."LocalisationID")
        then 'consignée / prêtée sans ordre actif au dépositaire'
      when o."statusId" = 6
           and not public.oeuvre_order_exists(o."OeuvreID", 'paid', o."ContactID")
        then 'vendue sans vente payée à l''acheteur'
      when o."statusId" = 11
           and not exists (select 1 from public.work_order wo
                             join public.work_order_work l on l.order_id = wo.id
                            where wo.kind = 'gift' and wo.party_id = o."ContactID"
                              and l.oeuvre_id = o."OeuvreID" and wo.status not in ('cancelled'))
        then 'donnée sans ordre de don au bénéficiaire'
    end as detail
  ) d
 where o.deleted_at is null and d.detail is not null
 order by 2;

-- ── Rule 12: destroyed / lost only through a constat; destroyed closes, lost pauses tasks ───
select '12' as rule, o."OeuvreID", o."Titre", d.detail
  from public."Oeuvres" o
  cross join lateral (
    select case
      when o."statusId" in (9, 10) and o.fate is null
        then 'statut détruite / perdue sans constat'
      when o.fate is not null
           and not exists (select 1 from public.condition_report r
                            where r.oeuvre_id = o."OeuvreID" and r.kind = o.fate and r.resolved_on is null)
        then 'sort « ' || o.fate || ' » sans constat ouvert'
      when o.fate is not null
           and exists (select 1 from public.work_action a
                        where a.oeuvre_id = o."OeuvreID" and not a.done and a.paused_at is null)
        then 'détruite / perdue avec une tâche encore active'
      when o.fate is not null
           and exists (select 1 from public.work_order wo
                         join public.work_order_work l on l.order_id = wo.id
                        where l.oeuvre_id = o."OeuvreID" and l.line_status = 'active'
                          and ((wo.kind = 'sale' and wo.status in ('draft', 'signed', 'deposit_paid'))
                            or (wo.kind = 'gift' and wo.status in ('draft', 'signed'))
                            or (wo.kind in ('consignment', 'loan') and wo.status in ('draft', 'signed', 'out'))
                            or (wo.kind = 'entrusted' and wo.status in ('draft', 'out'))))
        then 'détruite / perdue avec un ordre encore ouvert'
    end as detail
  ) d
 where o.deleted_at is null and d.detail is not null
 order by 2;

-- ── Rule 13: public = Disponible, Réservé, Vendu, Consigné, Prêt, Don, with no fate ────────
select '13' as rule, o."OeuvreID", o."Titre",
       case when o.is_public then 'publique à tort' else 'devrait être publique' end
  from public."Oeuvres" o
 where o.deleted_at is null
   and coalesce(o.is_public, false) <> (o."statusId" in (2, 4, 6, 7, 8, 11) and o.fate is null)
 order by 2;

-- ── Rule 14: every status change since 2026-11-18 has its dated line in Historique ─────────
-- (From 18 Nov: the 17 Nov repair of #2381 put its Historique back to its first line on purpose.)
-- Status events written by the database (source 'db'); a destroyed / lost / found change is
-- dated at the event, not the day, so those are left out.
select '14' as rule, o."OeuvreID", o."Titre",
       'changement de statut du ' || to_char((e.created_at at time zone 'Europe/Paris')::date, 'YYYY-MM-DD')
         || ' sans ligne datée dans Historique'
  from public.system_log e
  join public."Oeuvres" o on o."OeuvreID"::text = e.row_id
 where e.event_type = 'STATUS_CHANGE' and e.table_name = 'Oeuvres'
   and e.metadata->>'source' = 'db'
   and e.created_at >= timestamptz '2026-11-18 00:00 Europe/Paris'
   and o.deleted_at is null
   and coalesce(e.old_value::text, '') not in ('9', '10') and coalesce(e.new_value::text, '') not in ('9', '10')
   and position(to_char((e.created_at at time zone 'Europe/Paris')::date, 'YYYY/MM/DD')
                in coalesce(o."Historique", '')) = 0
 order by 2;

-- ── Rule 17: a destroyed / lost work is never « Exposable » (Pem 2026-11-17) ─────────────────
-- Enforced by trg_oeuvre_fate_not_showable (fate_not_showable.sql).
select '17' as rule, o."OeuvreID", o."Titre", 'détruite / perdue mais « Exposable »'
  from public."Oeuvres" o
 where o.deleted_at is null and o.fate is not null and coalesce(o."Exposable", false)
 order by 2;
