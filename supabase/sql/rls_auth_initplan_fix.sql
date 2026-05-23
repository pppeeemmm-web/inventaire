-- Supabase linter: auth_rls_initplan (lint 0003)
-- Wrap auth.*() in (select …) so RLS plans evaluate once per query, not per row.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Apply in Supabase SQL editor after deploy. Idempotent (DROP + CREATE).

-- Helper: one-shot auth.uid() → initplan subquery (avoid double-wrap).
create or replace function public._pem_rls_initplan_expr(expr text)
returns text
language plpgsql
immutable
as $$
declare
  out text := expr;
begin
  if out is null then
    return null;
  end if;
  out := replace(out, '(select auth.uid())', E'\x01');
  out := replace(out, '(select auth.jwt())', E'\x02');
  out := replace(out, '(select auth.role())', E'\x03');
  out := regexp_replace(out, '\mauth\.uid\(\)', '(select auth.uid())', 'g');
  out := regexp_replace(out, '\mauth\.jwt\(\)', '(select auth.jwt())', 'g');
  out := regexp_replace(out, '\mauth\.role\(\)', '(select auth.role())', 'g');
  out := replace(out, E'\x01', '(select auth.uid())');
  out := replace(out, E'\x02', '(select auth.jwt())');
  out := replace(out, E'\x03', '(select auth.role())');
  return out;
end;
$$;

-- is_admin() is used inside many policies; initplan inside the function too.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "Contact"
    where auth_user_id = (select auth.uid())
      and is_admin = true
  );
$$;

-- ── calendar_account / calendar_event_link ──

drop policy if exists calendar_account_owner_select on public.calendar_account;
create policy calendar_account_owner_select
  on public.calendar_account for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_insert on public.calendar_account;
create policy calendar_account_owner_insert
  on public.calendar_account for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_update on public.calendar_account;
create policy calendar_account_owner_update
  on public.calendar_account for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_delete on public.calendar_account;
create policy calendar_account_owner_delete
  on public.calendar_account for delete to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_select on public.calendar_event_link;
create policy calendar_event_link_owner_select
  on public.calendar_event_link for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_insert on public.calendar_event_link;
create policy calendar_event_link_owner_insert
  on public.calendar_event_link for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_update on public.calendar_event_link;
create policy calendar_event_link_owner_update
  on public.calendar_event_link for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_delete on public.calendar_event_link;
create policy calendar_event_link_owner_delete
  on public.calendar_event_link for delete to authenticated
  using (auth_user_id = (select auth.uid()));

-- ── user_record_done ──

drop policy if exists "user_record_done_select_own" on public.user_record_done;
create policy "user_record_done_select_own"
  on public.user_record_done for select
  using ((select auth.uid()) = user_id);

drop policy if exists "user_record_done_insert_own" on public.user_record_done;
create policy "user_record_done_insert_own"
  on public.user_record_done for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_record_done_update_own" on public.user_record_done;
create policy "user_record_done_update_own"
  on public.user_record_done for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_record_done_delete_own" on public.user_record_done;
create policy "user_record_done_delete_own"
  on public.user_record_done for delete
  using ((select auth.uid()) = user_id);

-- ── constellation_map ──

drop policy if exists "constellation_map_select_own" on public.constellation_map;
create policy "constellation_map_select_own"
  on public.constellation_map for select
  using ((select auth.uid()) = auth_user_id);

drop policy if exists "constellation_map_insert_own" on public.constellation_map;
create policy "constellation_map_insert_own"
  on public.constellation_map for insert
  with check ((select auth.uid()) = auth_user_id);

drop policy if exists "constellation_map_update_own" on public.constellation_map;
create policy "constellation_map_update_own"
  on public.constellation_map for update
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

drop policy if exists "constellation_map_delete_own" on public.constellation_map;
create policy "constellation_map_delete_own"
  on public.constellation_map for delete
  using ((select auth.uid()) = auth_user_id);

-- ── pending_changes ──

drop policy if exists "pending_changes_select" on public.pending_changes;
create policy "pending_changes_select"
  on public.pending_changes for select to authenticated
  using (author_id = (select auth.uid()) or is_admin());

-- ── share_inbox ──

drop policy if exists "share_inbox_own_select" on public.share_inbox;
create policy "share_inbox_own_select"
  on public.share_inbox for select to authenticated
  using (user_id = (select auth.uid()) and expires_at > timezone('utc', now()));

drop policy if exists "share_inbox_own_insert" on public.share_inbox;
create policy "share_inbox_own_insert"
  on public.share_inbox for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "share_inbox_own_delete" on public.share_inbox;
create policy "share_inbox_own_delete"
  on public.share_inbox for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── work_session ──

drop policy if exists "work_session_team_delete" on public.work_session;
create policy "work_session_team_delete"
  on public.work_session for delete to authenticated
  using (
    is_team()
    and (
      is_admin()
      or (user_id = (select auth.uid()) and status in ('draft', 'abandoned', 'rejected'))
    )
  );

-- ── sketchbook ──

drop policy if exists "sketchbook_team_select" on public.sketchbook;
create policy "sketchbook_team_select"
  on public.sketchbook for select to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "sketchbook_team_insert" on public.sketchbook;
create policy "sketchbook_team_insert"
  on public.sketchbook for insert to authenticated
  with check (is_team() and user_id = (select auth.uid()));

drop policy if exists "sketchbook_team_update" on public.sketchbook;
create policy "sketchbook_team_update"
  on public.sketchbook for update to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "sketchbook_team_delete" on public.sketchbook;
create policy "sketchbook_team_delete"
  on public.sketchbook for delete to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

-- ── voice_note ──

drop policy if exists "voice_note_team_select" on public.voice_note;
create policy "voice_note_team_select"
  on public.voice_note for select to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "voice_note_team_insert" on public.voice_note;
create policy "voice_note_team_insert"
  on public.voice_note for insert to authenticated
  with check (is_team() and user_id = (select auth.uid()));

drop policy if exists "voice_note_team_update" on public.voice_note;
create policy "voice_note_team_update"
  on public.voice_note for update to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (user_id = (select auth.uid()) or is_admin()));

drop policy if exists "voice_note_team_delete" on public.voice_note;
create policy "voice_note_team_delete"
  on public.voice_note for delete to authenticated
  using (is_team() and (user_id = (select auth.uid()) or is_admin()));

-- ── studio_task ──

drop policy if exists "studio_task_team_read" on public.studio_task;
create policy "studio_task_team_read"
  on public.studio_task for select
  using ((select auth.uid()) is not null);

drop policy if exists "studio_task_team_insert" on public.studio_task;
create policy "studio_task_team_insert"
  on public.studio_task for insert
  with check ((select auth.uid()) is not null);

drop policy if exists "studio_task_team_update" on public.studio_task;
create policy "studio_task_team_update"
  on public.studio_task for update
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- ── Contact (policies live in DB only — recreate from pg_policies) ──

do $contact$
declare
  pol record;
  new_qual text;
  new_check text;
  role_clause text;
  cmd_clause text;
begin
  for pol in
    select *
    from pg_policies
    where schemaname = 'public'
      and tablename = 'Contact'
      and policyname in ('contact: team select', 'contact: team update')
  loop
    new_qual := public._pem_rls_initplan_expr(pol.qual);
    new_check := public._pem_rls_initplan_expr(pol.with_check);

    select string_agg(quote_ident(r), ', ')
    into role_clause
    from unnest(pol.roles) as r;

    cmd_clause := case pol.cmd
      when 'SELECT' then 'for select'
      when 'INSERT' then 'for insert'
      when 'UPDATE' then 'for update'
      when 'DELETE' then 'for delete'
      when 'ALL' then 'for all'
      else 'for ' || lower(pol.cmd)
    end;

    execute format('drop policy if exists %I on public."Contact"', pol.policyname);

    execute format(
      'create policy %I on public."Contact" %s to %s%s%s',
      pol.policyname,
      cmd_clause,
      coalesce(role_clause, 'public'),
      case when new_qual is not null then format(' using (%s)', new_qual) else '' end,
      case when new_check is not null then format(' with check (%s)', new_check) else '' end
    );
  end loop;
end;
$contact$;

drop function if exists public._pem_rls_initplan_expr(text);

comment on function public.is_admin() is
  'True when auth user is linked Contact with is_admin. Uses initplan-safe auth.uid().';
