-- Fate « stolen » / « Volée » (Pem 2026-11-18: « add it »). APPLIED LIVE 2026-11-18 (Pem: « Apply it »), migration
-- fate_stolen (run without the begin / commit lines — the migration tool wraps it). Checked live after: both checks and
-- the index list 'stolen'; the three functions carry the new words; a stolen constat on #4 in a rolled-back
-- transaction gave fate stolen, status 10, not Exposable, not public, history « Volée », then « Retrouvée » and
-- status 2 once resolved.
--
-- A stolen work behaves exactly like a lost one: status 10, tasks paused, open orders closed, off the
-- public site, and it can come back (constat resolved → « Retrouvée »). Only the word changes:
--   Oeuvres.fate           'destroyed' | 'lost' | 'stolen'
--   condition_report.kind  'examination' | 'destroyed' | 'lost' | 'stolen'
--   history line « Volée », order note « volée », removed constat « Constat de vol supprimé ».
-- No new OeuvreStatus row: status 10 stays « Perdue / Lost » in the DB; the app shows « Volée » when the
-- fate is stolen (WorkStateChip). Every trigger already maps « not destroyed » → status 10.
--
-- The three functions are patched in place from their live definition (one exact text replacement each,
-- the block stops if a pattern is not found), so nothing else in them can drift.
-- After applying: set FATE_STOLEN_LIVE = true in lib/condition.ts, `npm run gen:types`, `npm run typecheck`.
-- Checked before writing (2026-11-18, live): 1 work with a fate (destroyed); constats: 1 examination, 1 destroyed.
-- The function patches read the live text — dry-run it inside a transaction that ends in ROLLBACK first.

begin;

alter table public."Oeuvres" drop constraint if exists oeuvres_fate_ck;
alter table public."Oeuvres" add constraint oeuvres_fate_ck check (
  (fate is null or fate in ('destroyed', 'lost', 'stolen'))
  and (fate_precision is null or fate_precision in ('year', 'month', 'day'))
);

alter table public.condition_report drop constraint if exists condition_report_kind_ck;
alter table public.condition_report add constraint condition_report_kind_ck
  check (kind in ('examination', 'destroyed', 'lost', 'stolen'));

drop index if exists public.condition_report_fate_idx;
create index condition_report_fate_idx
  on public.condition_report (oeuvre_id) where kind in ('destroyed', 'lost', 'stolen') and resolved_on is null;

do $patch$
declare
  v text;
  n text;
begin
  -- 1. Constat → work fate: a stolen constat counts like the other two.
  v := pg_get_functiondef('public.condition_report_fate_sync()'::regprocedure);
  n := replace(v, $q$r.kind in ('destroyed', 'lost')$q$, $q$r.kind in ('destroyed', 'lost', 'stolen')$q$);
  if n = v then raise exception 'fate_stolen: pattern not found in condition_report_fate_sync'; end if;
  execute n;

  -- 2. History lines: « Volée », « Retrouvée » after a theft too, « Constat de vol supprimé ».
  v := pg_get_functiondef('public.oeuvre_history()'::regprocedure);
  n := replace(v, $q$case new.fate when 'destroyed' then 'Détruite' else 'Perdue' end$q$,
                  $q$case new.fate when 'destroyed' then 'Détruite' when 'stolen' then 'Volée' else 'Perdue' end$q$);
  if n = v then raise exception 'fate_stolen: fate word not found in oeuvre_history'; end if;
  v := n;
  n := replace(v, $q$r.kind = 'lost' and r.resolved_on is not null$q$, $q$r.kind = old.fate and r.resolved_on is not null$q$);
  if n = v then raise exception 'fate_stolen: found-again kind not found in oeuvre_history'; end if;
  v := n;
  n := replace(v, $q$old.fate = 'lost' and$q$, $q$old.fate in ('lost', 'stolen') and$q$);
  if n = v then raise exception 'fate_stolen: found-again fate not found in oeuvre_history'; end if;
  v := n;
  n := replace(v, $q$case old.fate when 'destroyed' then 'destruction' else 'perte' end$q$,
                  $q$case old.fate when 'destroyed' then 'destruction' when 'stolen' then 'vol' else 'perte' end$q$);
  if n = v then raise exception 'fate_stolen: removed-report word not found in oeuvre_history'; end if;
  execute n;

  -- 3. Note written on the orders a stolen work leaves.
  v := pg_get_functiondef('public.oeuvre_fate_close_orders(integer, text, date)'::regprocedure);
  n := replace(v, $q$case p_kind when 'destroyed' then ' détruite' else ' perdue' end$q$,
                  $q$case p_kind when 'destroyed' then ' détruite' when 'stolen' then ' volée' else ' perdue' end$q$);
  if n = v then raise exception 'fate_stolen: word not found in oeuvre_fate_close_orders'; end if;
  execute n;
end
$patch$;

commit;
