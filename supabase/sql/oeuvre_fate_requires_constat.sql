-- Destroyed (9) / Lost (10) only through a condition report (owner 2026-11-12, brief phase 1 D).
--
-- The fate of a work has one source: an open 'destroyed' / 'lost' condition_report, mirrored on
-- Oeuvres (fate, fate_on, fate_precision) by condition_report_fate_sync (condition_report_fate.sql).
-- Until now nothing stopped a direct write of statusId 9 / 10 with fate null (saveWork accepts any
-- status id; only the drawer does not offer them; a version restore could too) — a second notion
-- of fate. This adds the missing check to the existing fate guard: statusId 9 / 10 requires a fate.
--
-- Checked before applying: 0 live rows with statusId in (9, 10) and fate null.
-- condition_report_fate_sync writes fate and statusId in one UPDATE, so it always passes.
-- No GRANT/RLS change (trigger function on an existing table).

create or replace function public.oeuvre_fate_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.fate is not null and coalesce(new."statusId", 1) in (1, 2, 3, 4, 7, 8) then
    if tg_op = 'INSERT' or old."statusId" is null or old."statusId" not in (9, 10) then
      new.status_before_fate := new."statusId";
    end if;
    new."statusId" := case new.fate when 'destroyed' then 9 else 10 end;
  end if;

  if new."statusId" in (9, 10) and new.fate is null then
    raise exception 'fate_requires_constat' using errcode = '23514',
      detail = 'Destroyed / Lost is set by a destruction or loss condition report, never directly.';
  end if;

  return new;
end;
$$;
