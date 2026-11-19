-- merge_contacts(p_keep, p_lose): merge contact p_lose into p_keep in ONE transaction (TODO §1 « Data safety »).
-- Applied 2026-11-19 (Pem OK: admin only, « do what's best and what preserves data »).
--
-- Replaces the ~20 separate service-role writes of `mergeContacts` (app/atelier/(portal)/contacts/actions.ts):
-- a failure half-way used to leave a split pair. Here any error rolls back everything.
--
-- Same rules as the server action today:
--   * refuse when both contacts have different logins (auth_user_id);
--   * refuse when the lost contact has invoices (issued invoices never change hands): « merge_invoices »,
--     or « merge_both_invoiced » when the kept one has some too;
--   * Contact columns: kept value wins, empty kept columns (NULL or '') take the lost value; skipped:
--     ContactID, auth_user_id (moved only when the kept one has none), the dead link columns
--     Website / Instagram / LinkedIn / Facebook / Twitter; is_team_member / IsTeamMember = OR of both;
--     is_private = OR of both (new, Pem 2026-11-19: a private contact stays private once merged);
--     is_admin = kept value unless NULL;
--   * orders move BEFORE works (oeuvre_holder_check needs the kept contact to hold the orders first);
--   * emails / phones / websites / socials / event roles: moved, duplicates of what the kept contact already
--     has (or of an earlier moved row) are dropped — email lower+trim, phone digits only,
--     url lower+trim without http(s):// and one trailing « / », social platform|handle lower+trim,
--     event role = same event + role.
-- New vs today:
--   * ai_job « card » rows (target_id = contact id as text, Bureau IA card readings) follow the kept contact;
--     an open card job of the lost contact that would clash with an open one of the kept contact is closed
--     as failed (« merged into #keep ») instead of blocking the merge;
--   * contact_conflicts step dropped (table does not exist in the live DB).
-- Not moved: ai_job kind « web » (nothing queues it with a target today); contact ids inside JSON of
-- pending_changes and oeuvre_versions (approve / restore of such a row then fails on the FK — TODO §1).
-- The PC agent's card check (scripts/ai-agent/card.mjs checkCardKey) trusts the moved `document` row, not the id
-- inside the key, so a waiting card job still runs after a merge.
--
-- Security: SECURITY DEFINER (must see and move rows RLS hides, like the service role does today), admin only
-- (is_admin() inside — auth.uid() stays the caller, so the Contact protect_admin_flags trigger accepts the
-- is_team_member merge), search_path pinned to '', every name schema-qualified.
-- Grants: EXECUTE for authenticated only (revoked from public / anon).
--
-- Errors raise (whole merge rolled back). Messages the app maps: merge_invalid, merge_forbidden, merge_not_found,
-- merge_two_logins, merge_invoices, merge_both_invoiced.
--
-- After apply: npm run gen:types; server action → one rpc('merge_contacts', { p_keep, p_lose }); docs/ARCHITECTURE.md
-- §5 / §7.

create or replace function public.merge_contacts(p_keep integer, p_lose integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep      public."Contact"%rowtype;
  v_lose      public."Contact"%rowtype;
  v_keep_j    jsonb;
  v_lose_j    jsonb;
  v_patch     jsonb := '{}'::jsonb;
  v_key       text;
  v_val       jsonb;
  v_set       text;
  v_lose_inv  integer;
  v_keep_inv  integer;
begin
  if p_keep is null or p_lose is null or p_keep = p_lose then
    raise exception 'merge_invalid';
  end if;
  if not public.is_admin() then
    raise exception 'merge_forbidden';
  end if;

  -- Lock both rows in id order (two merges touching the same pair cannot deadlock).
  perform 1 from public."Contact" where "ContactID" in (p_keep, p_lose) order by "ContactID" for update;
  select * into v_keep from public."Contact" where "ContactID" = p_keep;
  select * into v_lose from public."Contact" where "ContactID" = p_lose;
  if v_keep."ContactID" is null or v_lose."ContactID" is null then
    raise exception 'merge_not_found';
  end if;

  if v_keep.auth_user_id is not null and v_lose.auth_user_id is not null
     and v_keep.auth_user_id <> v_lose.auth_user_id then
    raise exception 'merge_two_logins';
  end if;

  select count(*) into v_lose_inv from public.invoice where party_id = p_lose;
  if v_lose_inv > 0 then
    select count(*) into v_keep_inv from public.invoice where party_id = p_keep;
    raise exception '%', case when v_keep_inv > 0 then 'merge_both_invoiced' else 'merge_invoices' end;
  end if;

  -- ── 1. Contact columns: fill the kept contact's empty columns ──────────────────────────────────
  v_keep_j := to_jsonb(v_keep);
  v_lose_j := to_jsonb(v_lose);
  for v_key, v_val in select key, value from jsonb_each(v_lose_j) loop
    continue when v_key in ('ContactID', 'auth_user_id', 'Website', 'Instagram', 'LinkedIn', 'Facebook', 'Twitter');
    if v_key in ('is_team_member', 'IsTeamMember', 'is_private') then
      if not coalesce((v_keep_j ->> v_key)::boolean, false) and coalesce((v_lose_j ->> v_key)::boolean, false) then
        v_patch := v_patch || jsonb_build_object(v_key, true);
      end if;
      continue;
    end if;
    continue when v_val = 'null'::jsonb or v_val = '""'::jsonb;
    if (v_keep_j -> v_key) = 'null'::jsonb or (v_keep_j -> v_key) = '""'::jsonb then
      v_patch := v_patch || jsonb_build_object(v_key, v_val);
    end if;
  end loop;

  -- The login moves only when the kept contact has none (unique index: clear it on the lost one first).
  if v_keep.auth_user_id is null and v_lose.auth_user_id is not null then
    update public."Contact" set auth_user_id = null where "ContactID" = p_lose;
    v_patch := v_patch || jsonb_build_object('auth_user_id', v_lose.auth_user_id);
  end if;

  if v_patch <> '{}'::jsonb then
    select string_agg(format('%1$I = r.%1$I', k), ', ') into v_set from jsonb_object_keys(v_patch) k;
    execute format(
      'update public."Contact" t set %s from jsonb_populate_record(null::public."Contact", $1) r where t."ContactID" = $2',
      v_set
    ) using v_patch, p_keep;
  end if;

  -- ── 2. References (orders first: oeuvre_holder_check) ───────────────────────────────────────────
  update public.work_order     set party_id        = p_keep where party_id        = p_lose;
  update public."Oeuvres"      set "ContactID"     = p_keep where "ContactID"     = p_lose;
  update public."Oeuvres"      set "LocalisationID"= p_keep where "LocalisationID"= p_lose;
  update public."Oeuvres"      set "AcheteurID"    = p_keep where "AcheteurID"    = p_lose;
  update public.suivi_process  set contact_id      = p_keep where contact_id      = p_lose;
  update public.document       set contact_id      = p_keep where contact_id      = p_lose;
  update public.expense        set contact_id      = p_keep where contact_id      = p_lose;
  update public.shipment       set to_contact_id   = p_keep where to_contact_id   = p_lose;
  update public.stock_item     set supplier_id     = p_keep where supplier_id     = p_lose;
  update public.supply_order   set supplier_id     = p_keep where supplier_id     = p_lose;
  update public.private_link   set contact_id      = p_keep where contact_id      = p_lose;
  update public.page_view      set team_contact_id = p_keep where team_contact_id = p_lose;
  update public.contact_addresses set contact_id   = p_keep where contact_id      = p_lose;

  -- Event roles: unique (process_id, contact_id, role) — drop the ones the kept contact already has.
  delete from public.event_contact l
   where l.contact_id = p_lose
     and exists (select 1 from public.event_contact k
                  where k.contact_id = p_keep and k.process_id = l.process_id and k.role = l.role);
  update public.event_contact set contact_id = p_keep where contact_id = p_lose;

  -- ── 3. Emails / phones / websites / socials: move, drop duplicates ─────────────────────────────
  delete from public.contact_emails l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_emails k where k.contact_id = p_keep
                   and lower(btrim(k.email)) = lower(btrim(l.email)))
       or exists (select 1 from public.contact_emails e where e.contact_id = p_lose and e.id < l.id
                   and lower(btrim(e.email)) = lower(btrim(l.email))));
  update public.contact_emails set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_phones l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_phones k where k.contact_id = p_keep
                   and regexp_replace(k.phone, '\D', '', 'g') = regexp_replace(l.phone, '\D', '', 'g'))
       or exists (select 1 from public.contact_phones e where e.contact_id = p_lose and e.id < l.id
                   and regexp_replace(e.phone, '\D', '', 'g') = regexp_replace(l.phone, '\D', '', 'g')));
  update public.contact_phones set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_websites l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_websites k where k.contact_id = p_keep
                   and regexp_replace(regexp_replace(lower(btrim(k.url)), '^https?://', ''), '/$', '')
                     = regexp_replace(regexp_replace(lower(btrim(l.url)), '^https?://', ''), '/$', ''))
       or exists (select 1 from public.contact_websites e where e.contact_id = p_lose and e.id < l.id
                   and regexp_replace(regexp_replace(lower(btrim(e.url)), '^https?://', ''), '/$', '')
                     = regexp_replace(regexp_replace(lower(btrim(l.url)), '^https?://', ''), '/$', '')));
  update public.contact_websites set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_socials l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_socials k where k.contact_id = p_keep
                   and lower(btrim(coalesce(k.platform, ''))) = lower(btrim(coalesce(l.platform, '')))
                   and lower(btrim(coalesce(k.handle, '')))   = lower(btrim(coalesce(l.handle, ''))))
       or exists (select 1 from public.contact_socials e where e.contact_id = p_lose and e.id < l.id
                   and lower(btrim(coalesce(e.platform, ''))) = lower(btrim(coalesce(l.platform, '')))
                   and lower(btrim(coalesce(e.handle, '')))   = lower(btrim(coalesce(l.handle, '')))));
  update public.contact_socials set contact_id = p_keep where contact_id = p_lose;

  -- ── 4. Bureau IA card readings (ai_job.target_id = contact id as text, no FK) ──────────────────
  update public.ai_job l
     set status = 'failed', error = format('merged into #%s', p_keep), done_at = now()
   where l.kind = 'card' and l.target_id = p_lose::text and l.status in ('waiting', 'running')
     and exists (select 1 from public.ai_job k
                  where k.kind = 'card' and k.target_id = p_keep::text and k.status in ('waiting', 'running'));
  update public.ai_job set target_id = p_keep::text where kind = 'card' and target_id = p_lose::text;

  -- ── 5. Delete the lost contact (graph node unregistered by its trigger; any reference left → FK error → rollback)
  delete from public."Contact" where "ContactID" = p_lose;

  return p_keep;
end;
$$;

revoke all on function public.merge_contacts(integer, integer) from public, anon;
grant execute on function public.merge_contacts(integer, integer) to authenticated;

comment on function public.merge_contacts(integer, integer) is
  'Admin only. Merge contact p_lose into p_keep in one transaction (columns, references, emails/phones/links, event roles, card jobs), then delete p_lose. See supabase/sql/merge_contacts_fn.sql.';
