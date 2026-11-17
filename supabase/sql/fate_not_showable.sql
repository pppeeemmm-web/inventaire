-- A destroyed / lost work is never « Exposable » (Showable) — Pem 2026-11-17, review checklist:
-- « i turn it off, make this a rule ». APPLIED 2026-11-17, migration fate_not_showable.
--
-- While a work has a fate (an open destruction / loss constat, condition_report_fate.sql), the
-- « Exposable » flag is forced false on every write; it cannot be ticked back. When a lost work is
-- found (fate cleared) the flag stays off until someone ticks it again.
-- Live check before applying: 1 work with a fate (#2112), already Exposable = false.
-- No GRANT/RLS change (trigger on an existing table). Check: work_rules_checks.sql.

create or replace function public.oeuvre_fate_not_showable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fate is not null then
    new."Exposable" := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_fate_not_showable on public."Oeuvres";
create trigger trg_oeuvre_fate_not_showable
  before insert or update of fate, "Exposable" on public."Oeuvres"
  for each row execute function public.oeuvre_fate_not_showable();
