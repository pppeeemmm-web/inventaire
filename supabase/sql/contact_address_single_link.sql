-- Single custodian address → works (owner 2026-11-12, Kaizen "linkage broken").
--
-- Rule (docs/WORK_CUSTODY_MODEL.md): a custodian with one address gives the work that
-- address automatically. `oeuvre_location_by_stage` applies it only when the WORK row is
-- saved, so a work whose holder already had (or later got) a single address kept
-- `localisation_address_id` null until someone re-saved it — Overview then said
-- "No address set" (#302, #2124, #2162, #2339, #2341 on 2026-11-12).
--
-- This trigger runs the same rule from the address side: after an address is added or
-- removed, if the contact is left with exactly one address, its works without an address
-- get it. Pem (Contact 13) is excluded — Pem's address follows the work's stage.
--
-- security definer: a team member adding an address must not fail on Oeuvres RLS; the
-- update is narrow (works of that contact with no address, to that contact's only address)
-- and still passes the Oeuvres triggers (version snapshot, holder check, stage address).
-- No GRANT/RLS change. Trigger function only: not callable via PostgREST.

create or replace function public.contact_address_link_single()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cid int;
  only_id int;
begin
  cid := coalesce(new.contact_id, old.contact_id);
  if cid is null or cid = 13 then
    return null;
  end if;

  select min(a.id) into only_id
  from contact_addresses a
  where a.contact_id = cid
  having count(*) = 1;

  if only_id is not null then
    update "Oeuvres"
    set localisation_address_id = only_id
    where "LocalisationID" = cid
      and localisation_address_id is null
      and deleted_at is null;
  end if;

  return null;
end;
$$;

revoke execute on function public.contact_address_link_single() from public, anon, authenticated;

drop trigger if exists trg_contact_address_link_single on public.contact_addresses;
create trigger trg_contact_address_link_single
after insert or delete or update of contact_id on public.contact_addresses
for each row execute function public.contact_address_link_single();

-- One-time backfill: works whose non-Pem holder has exactly one address.
update "Oeuvres" o
set localisation_address_id = a.id
from contact_addresses a
where a.contact_id = o."LocalisationID"
  and o."LocalisationID" <> 13
  and o.localisation_address_id is null
  and o.deleted_at is null
  and (select count(*) from contact_addresses b where b.contact_id = o."LocalisationID") = 1;
