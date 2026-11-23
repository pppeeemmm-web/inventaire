-- People: touches (« moments »), archive instead of delete, team changes reported to Pem's Fil
-- (People.md §3, §4, §10 step 5). Pem GO 2026-11-23 (« run the job »). Re-runnable.
--
-- A. `moment` + `moment_person` + `moment_work`: a dated fact with no life of its own (a call, a studio visit, a
--    meeting elsewhere, a mail…), naming several people with roles and works. Door `save_moment` (anyone in the
--    team records; private only by an admin; all or nothing; a correction keeps the original: the new row points
--    to it with `corrects_id`, the old one gets `replaced_by`). Reads go through RLS (private moments: admin only).
-- B. Archive: `Contact.archived_at` / `archived_by`. Door `archive_contact(id, archive)`: the person leaves lists and
--    pickers, everything they touched stays; « Rappeler » = archive false. The one inactive card (Actif = false)
--    is archived once here.
-- C. Team changes to a person reach Pem's Fil: `save_contact` now writes one `system_log` row
--    (event_type 'contact_team_change') for a team member's save of an existing card, fields before → after
--    (the list kinds changed are named). `archive_contact` does the same. The Fil marks a row « Vu » in its own state table.

-- ───────────────────────── A. Moments ─────────────────────────
create table if not exists public.moment (
  id bigint generated always as identity primary key,
  happened_on date not null,
  precision text not null default 'day' check (precision in ('day', 'month', 'year')),
  kind text not null check (kind in ('call', 'studio_visit', 'meeting', 'mail_in', 'mail_out', 'introduction',
                                     'press', 'thanks', 'other')),
  channel text,
  summary text not null default '' check (length(summary) <= 4000),
  is_private boolean not null default false,
  document_id uuid references public.document(id) on delete set null,
  source text,
  external_id text,
  corrects_id bigint references public.moment(id) on delete set null,
  replaced_by bigint references public.moment(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists moment_source_external_uniq on public.moment (source, external_id)
  where source is not null and external_id is not null;
create index if not exists moment_happened_idx on public.moment (happened_on desc, id desc);
comment on table public.moment is 'A touch: a dated fact between people and works (People.md §4). Written only by save_moment.';

create table if not exists public.moment_person (
  moment_id bigint not null references public.moment(id) on delete cascade,
  contact_id integer not null references public."Contact"("ContactID") on delete cascade,
  role text,
  primary key (moment_id, contact_id)
);
create index if not exists moment_person_contact_idx on public.moment_person (contact_id);

create table if not exists public.moment_work (
  moment_id bigint not null references public.moment(id) on delete cascade,
  oeuvre_id integer not null references public."Oeuvres"("OeuvreID") on delete cascade,
  primary key (moment_id, oeuvre_id)
);
create index if not exists moment_work_oeuvre_idx on public.moment_work (oeuvre_id);

alter table public.moment enable row level security;
alter table public.moment_person enable row level security;
alter table public.moment_work enable row level security;

drop policy if exists "moment: team read" on public.moment;
create policy "moment: team read" on public.moment for select to authenticated
  using (public.is_team() and (not is_private or public.is_admin()));
drop policy if exists "moment_person: team read" on public.moment_person;
create policy "moment_person: team read" on public.moment_person for select to authenticated
  using (exists (select 1 from public.moment m where m.id = moment_id));
drop policy if exists "moment_work: team read" on public.moment_work;
create policy "moment_work: team read" on public.moment_work for select to authenticated
  using (exists (select 1 from public.moment m where m.id = moment_id));

grant select on public.moment, public.moment_person, public.moment_work to authenticated;
revoke insert, update, delete on public.moment, public.moment_person, public.moment_work from authenticated, anon;

-- p: { corrects?: id, happened_on: 'YYYY-MM-DD', precision?, kind, channel?, summary, is_private?, document_id?,
--      people: [{ contact_id, role? }], works: [oeuvre_id] }
create or replace function public.save_moment(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_corrects bigint := nullif(p->>'corrects', '')::bigint;
  v_private boolean := coalesce((p->>'is_private')::boolean, false);
  v_day date;
  v_id bigint;
  v_old public.moment;
  v_bad text;
  v_people jsonb := coalesce(p->'people', '[]'::jsonb);
  v_works jsonb := coalesce(p->'works', '[]'::jsonb);
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  if v_private and not v_admin then
    return jsonb_build_object('refused', 'admin_only', 'detail', 'is_private');
  end if;
  begin
    v_day := (p->>'happened_on')::date;
  exception when others then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'happened_on');
  end;
  if v_day is null or v_day > current_date + 1 then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'happened_on');
  end if;
  if coalesce(p->>'kind', '') not in ('call', 'studio_visit', 'meeting', 'mail_in', 'mail_out', 'introduction', 'press', 'thanks', 'other') then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'kind');
  end if;
  if coalesce(p->>'precision', 'day') not in ('day', 'month', 'year') then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'precision');
  end if;
  if jsonb_typeof(v_people) <> 'array' or jsonb_typeof(v_works) <> 'array'
     or jsonb_array_length(v_people) + jsonb_array_length(v_works) = 0 then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'people');
  end if;
  -- Every person named must exist and be visible to the caller (a private card only for an admin).
  select x->>'contact_id' into v_bad from jsonb_array_elements(v_people) x
   where not exists (select 1 from public."Contact" c
                      where c."ContactID" = nullif(x->>'contact_id', '')::int
                        and (v_admin or not coalesce(c.is_private, false)))
   limit 1;
  if found then
    return jsonb_build_object('refused', 'not_found', 'detail', 'contact ' || coalesce(v_bad, '?'));
  end if;
  select x #>> '{}' into v_bad from jsonb_array_elements(v_works) x
   where not exists (select 1 from public."Oeuvres" o where o."OeuvreID" = nullif(x #>> '{}', '')::int and o.deleted_at is null)
   limit 1;
  if found then
    return jsonb_build_object('refused', 'not_found', 'detail', 'work ' || coalesce(v_bad, '?'));
  end if;

  if v_corrects is not null then
    select * into v_old from public.moment where id = v_corrects for update;
    if not found or (v_old.is_private and not v_admin) then
      return jsonb_build_object('refused', 'not_found', 'detail', 'corrects');
    end if;
    if v_old.replaced_by is not null then
      return jsonb_build_object('refused', 'stale', 'detail', 'corrects');
    end if;
  end if;

  insert into public.moment (happened_on, precision, kind, channel, summary, is_private, document_id, corrects_id)
  values (v_day, coalesce(p->>'precision', 'day'), p->>'kind', nullif(p->>'channel', ''),
          coalesce(left(p->>'summary', 4000), ''), v_private, nullif(p->>'document_id', '')::uuid, v_corrects)
  returning id into v_id;
  insert into public.moment_person (moment_id, contact_id, role)
    select distinct on ((x->>'contact_id')::int) v_id, (x->>'contact_id')::int, nullif(x->>'role', '')
    from jsonb_array_elements(v_people) x;
  insert into public.moment_work (moment_id, oeuvre_id)
    select distinct v_id, (x #>> '{}')::int from jsonb_array_elements(v_works) x;
  if v_corrects is not null then
    update public.moment set replaced_by = v_id where id = v_corrects;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.save_moment(jsonb) from public, anon;
grant execute on function public.save_moment(jsonb) to authenticated;

-- ───────────────────────── B. Archive ─────────────────────────
alter table public."Contact" add column if not exists archived_at timestamptz;
alter table public."Contact" add column if not exists archived_by uuid;
create index if not exists contact_archived_idx on public."Contact" (archived_at) where archived_at is not null;
update public."Contact" set archived_at = now() where "Actif" = false and archived_at is null;

create or replace function public.archive_contact(p_contact integer, p_archive boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_row public."Contact";
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  select * into v_row from public."Contact" where "ContactID" = p_contact for update;
  if not found or (coalesce(v_row.is_private, false) and not v_admin) then
    return jsonb_build_object('refused', 'not_found');
  end if;
  if coalesce(v_row.is_team_member, false) and p_archive then
    return jsonb_build_object('refused', 'team_member');
  end if;
  if (v_row.archived_at is not null) = p_archive then
    return jsonb_build_object('unchanged', true);
  end if;
  update public."Contact"
     set archived_at = case when p_archive then now() end,
         archived_by = case when p_archive then auth.uid() end
   where "ContactID" = p_contact;
  if not v_admin then
    insert into public.system_log (action, event_type, table_name, row_id, old_value, new_value, author_id, user_id)
    values (case when p_archive then 'Contact archivé' else 'Contact rappelé' end, 'contact_team_change', 'Contact',
            p_contact::text, jsonb_build_object('archived', not p_archive), jsonb_build_object('archived', p_archive),
            auth.uid(), auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'archived', p_archive);
end $$;
revoke all on function public.archive_contact(integer, boolean) from public, anon;
grant execute on function public.archive_contact(integer, boolean) to authenticated;

-- ───────────────────────── C. Team changes → Fil ─────────────────────────
-- (A door team_change_seen stood here; the Fil keeps its own state — see fil_contact_change_kind.sql.)

-- save_contact logs a team member's save of an existing card (patched in place from its live text, guarded).
do $patch$
declare
  v_def text;
  c_anchor constant text := $a$  return jsonb_build_object('ok', true, 'created', p->>'id' is null or p->>'id' = '',$a$;
  c_add constant text := $a$  if not v_admin and nullif(p->>'id', '') is not null then
    insert into public.system_log (action, event_type, table_name, row_id, old_value, new_value, author_id, user_id)
    values ('Contact modifié', 'contact_team_change', 'Contact', v_id::text,
            coalesce((select jsonb_object_agg(u.fld, v_oldj->u.fld) from unnest(v_changed) as u(fld)), '{}'::jsonb),
            coalesce((select jsonb_object_agg(u.fld, v_write->u.fld) from unnest(v_changed) as u(fld)), '{}'::jsonb)
              || case when cardinality(v_kinds_changed) > 0 then jsonb_build_object('_lists', to_jsonb(v_kinds_changed)) else '{}'::jsonb end,
            auth.uid(), auth.uid());
  end if;
$a$;
  -- A first draft of this block used « k » (a variable of save_contact): ambiguous. Tried only on the throwaway
  -- copy; if found, it is cut out before the good block goes in.
  c_bad_start constant text := $a$  if not v_admin and nullif(p->>'id', '') is not null then
    insert into public.system_log$a$;
begin
  -- Line ends normalised (the file may carry CRLF): compare and insert on bare LF text.
  v_def := replace(pg_get_functiondef('public.save_contact(jsonb)'::regprocedure), E'\r', '');
  if position('unnest(v_changed) as u(fld)' in v_def) = 0 then
    -- Cut any earlier draft block: from its first line up to the return line.
    if position(replace(c_bad_start, E'\r', '') in v_def) > 0 then
      v_def := substr(v_def, 1, position(replace(c_bad_start, E'\r', '') in v_def) - 1)
            || substr(v_def, position(replace(c_anchor, E'\r', '') in v_def));
    end if;
    if (length(v_def) - length(replace(v_def, replace(c_anchor, E'\r', ''), ''))) / length(c_anchor) <> 1 then
      raise exception 'save_contact: return anchor not unique, patch by hand';
    end if;
    execute replace(v_def, replace(c_anchor, E'\r', ''), replace(c_add, E'\r', '') || replace(c_anchor, E'\r', ''));
  end if;
end
$patch$;
