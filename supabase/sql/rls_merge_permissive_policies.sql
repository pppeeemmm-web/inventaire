-- Supabase linter: multiple_permissive_policies (lint 0006)
-- Merge overlapping permissive policies (same table + role + action) via OR.
-- https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
--
-- Run in Supabase SQL editor after rls_auth_initplan_fix.sql. Idempotent.

-- ── Helpers (dropped at end) ───────────────────────────────────────────────

create or replace function public._pem_policy_qual(
  p_table text,
  p_policy text
)
returns text
language sql
stable
as $$
  select qual
  from pg_policies
  where schemaname = 'public'
    and tablename = p_table
    and policyname = p_policy;
$$;

create or replace function public._pem_policy_with_check(
  p_table text,
  p_policy text
)
returns text
language sql
stable
as $$
  select with_check
  from pg_policies
  where schemaname = 'public'
    and tablename = p_table
    and policyname = p_policy;
$$;

-- Split "public read" (SELECT) + "team …" FOR ALL into one SELECT + team mutates.
create or replace function public._pem_split_public_read_team_all(
  p_table text,
  p_public_policy text,
  p_team_policy text,
  p_prefix text
)
returns void
language plpgsql
as $$
declare
  pub_qual text;
  tbl_sql text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = p_table
      and policyname = p_prefix || ': select'
  ) then
    return;
  end if;

  pub_qual := coalesce(
    public._pem_policy_qual(p_table, p_public_policy),
    'true'
  );
  tbl_sql := format('%I', p_table);

  execute format('drop policy if exists %I on public.%s', p_public_policy, tbl_sql);
  execute format('drop policy if exists %I on public.%s', p_team_policy, tbl_sql);

  execute format(
    'create policy %I on public.%s for select to public using ((%s) or is_team())',
    p_prefix || ': select',
    tbl_sql,
    pub_qual
  );
  execute format(
    'create policy %I on public.%s for insert to public with check (is_team())',
    p_prefix || ': team insert',
    tbl_sql
  );
  execute format(
    'create policy %I on public.%s for update to public using (is_team()) with check (is_team())',
    p_prefix || ': team update',
    tbl_sql
  );
  execute format(
    'create policy %I on public.%s for delete to public using (is_team())',
    p_prefix || ': team delete',
    tbl_sql
  );
end;
$$;

-- Merge two DELETE policies into one OR expression.
create or replace function public._pem_merge_delete_policies(
  p_table text,
  p_policy_a text,
  p_policy_b text,
  p_merged_name text
)
returns void
language plpgsql
as $$
declare
  qual_a text;
  qual_b text;
  tbl_sql text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table and policyname = p_merged_name
  ) then
    return;
  end if;

  qual_a := public._pem_policy_qual(p_table, p_policy_a);
  qual_b := public._pem_policy_qual(p_table, p_policy_b);
  if qual_a is null or qual_b is null then
    return;
  end if;
  tbl_sql := format('%I', p_table);

  execute format('drop policy if exists %I on public.%s', p_policy_a, tbl_sql);
  execute format('drop policy if exists %I on public.%s', p_policy_b, tbl_sql);
  execute format(
    'create policy %I on public.%s for delete to authenticated using ((%s) or (%s))',
    p_merged_name,
    tbl_sql,
    qual_a,
    qual_b
  );
end;
$$;

-- Merge two SELECT policies (authenticated) into one OR expression.
create or replace function public._pem_merge_select_policies(
  p_table text,
  p_policy_a text,
  p_policy_b text,
  p_merged_name text,
  p_roles text default 'authenticated'
)
returns void
language plpgsql
as $$
declare
  qual_a text;
  qual_b text;
  tbl_sql text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table and policyname = p_merged_name
  ) then
    return;
  end if;

  qual_a := public._pem_policy_qual(p_table, p_policy_a);
  qual_b := public._pem_policy_qual(p_table, p_policy_b);
  if qual_a is null or qual_b is null then
    return;
  end if;
  tbl_sql := format('%I', p_table);

  execute format('drop policy if exists %I on public.%s', p_policy_a, tbl_sql);
  execute format('drop policy if exists %I on public.%s', p_policy_b, tbl_sql);
  execute format(
    'create policy %I on public.%s for select to %s using ((%s) or (%s))',
    p_merged_name,
    tbl_sql,
    p_roles,
    qual_a,
    qual_b
  );
end;
$$;

-- ── broadcast_events (in repo) ─────────────────────────────────────────────

select public._pem_merge_select_policies(
  'broadcast_events',
  'broadcast_events_admin_select',
  'broadcast_events_team_select',
  'broadcast_events_select'
);

-- ── Oeuvres / tblImage DELETE (in repo) ────────────────────────────────────

select public._pem_merge_delete_policies(
  'Oeuvres',
  'oeuvres: team delete',
  'oeuvres_admin_delete',
  'oeuvres: delete'
);

-- ── Oeuvres SELECT: public works + team read ───────────────────────────────

do $oeuvres_select$
declare
  pub_qual text;
  team_qual text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'Oeuvres' and policyname = 'oeuvres: select'
  ) then
    return;
  end if;

  pub_qual := public._pem_policy_qual('Oeuvres', 'oeuvres: public reads public works');
  team_qual := public._pem_policy_qual('Oeuvres', 'oeuvres: team read all');
  if pub_qual is null or team_qual is null then
    raise exception 'Oeuvres SELECT merge: expected public + team read policies';
  end if;

  drop policy if exists "oeuvres: public reads public works" on public."Oeuvres";
  drop policy if exists "oeuvres: team read all" on public."Oeuvres";

  execute format(
    'create policy "oeuvres: select" on public."Oeuvres" for select to public using ((%s) or (%s))',
    pub_qual,
    team_qual
  );
end;
$oeuvres_select$;

-- ── tblImage: anon public SELECT + team mutates + admin/team DELETE ────────

do $tblimage$
declare
  anon_qual text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tblImage' and policyname = 'tblImage: select'
  ) then
    return;
  end if;

  anon_qual := public._pem_policy_qual('tblImage', 'tblimage: anon read public works');
  if anon_qual is null then
    raise exception 'tblImage merge: missing tblimage: anon read public works';
  end if;

  drop policy if exists "tblimage: anon read public works" on public."tblImage";
  drop policy if exists "tblImage: team all" on public."tblImage";
  drop policy if exists "tblimage_admin_delete" on public."tblImage";

  execute format(
    'create policy "tblImage: select" on public."tblImage" for select to public using ((%s) or is_team())',
    anon_qual
  );
  execute '
    create policy "tblImage: team insert" on public."tblImage"
    for insert to public with check (is_team())';
  execute '
    create policy "tblImage: team update" on public."tblImage"
    for update to public using (is_team()) with check (is_team())';
  execute '
    create policy "tblImage: delete" on public."tblImage"
    for delete to public using (is_admin() or is_team())';
end;
$tblimage$;

-- ── oeuvre_theme: drop duplicate + merge SELECT ───────────────────────────

drop policy if exists "oeuvreTheme: team all" on public.oeuvre_theme;

do $oeuvre_theme$
declare
  pub_qual text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'oeuvre_theme' and policyname = 'oeuvre_theme: select'
  ) then
    return;
  end if;

  pub_qual := coalesce(
    public._pem_policy_qual('oeuvre_theme', 'public read OeuvreTheme'),
    'true'
  );

  drop policy if exists "public read OeuvreTheme" on public.oeuvre_theme;
  drop policy if exists "oeuvre_theme: team all" on public.oeuvre_theme;

  execute format(
    'create policy "oeuvre_theme: select" on public.oeuvre_theme for select to public using ((%s) or is_team())',
    pub_qual
  );
  execute '
    create policy "oeuvre_theme: team insert" on public.oeuvre_theme
    for insert to public with check (is_team())';
  execute '
    create policy "oeuvre_theme: team update" on public.oeuvre_theme
    for update to public using (is_team()) with check (is_team())';
  execute '
    create policy "oeuvre_theme: team delete" on public.oeuvre_theme
    for delete to public using (is_team())';
end;
$oeuvre_theme$;

-- ── Reference tables: public read + team write (FOR ALL) ───────────────────

select public._pem_split_public_read_team_all('Format', 'format: public read', 'format: team write', 'format');
select public._pem_split_public_read_team_all('OeuvreStatus', 'oeuvrestatus: public read', 'oeuvrestatus: team write', 'oeuvrestatus');
select public._pem_split_public_read_team_all('Support', 'support: public read', 'support: team write', 'support');
select public._pem_split_public_read_team_all('Technique', 'technique: public read', 'technique: team write', 'technique');
select public._pem_split_public_read_team_all('theme', 'public read tblTheme', 'tbltheme: team write', 'theme');
select public._pem_split_public_read_team_all('tblPresentation', 'public read tblPresentation', 'tblPresentation: team all', 'tblPresentation');
select public._pem_split_public_read_team_all('tblrelations', 'Allow public read access', 'tblrelations: team all', 'tblrelations');
select public._pem_split_public_read_team_all('tblRole', 'Anon read', 'tblRole: team all', 'tblRole');
select public._pem_split_public_read_team_all('work_action', 'Anon read', 'work_action: team all', 'work_action');
select public._pem_split_public_read_team_all('work_action_type', 'Anon read', 'work_action_type: team all', 'work_action_type');

-- ── Contact: admin all + team * + anon public read ─────────────────────────

do $contact$
declare
  anon_select_qual text;
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'Contact' and policyname = 'contact: select'
  ) then
    return;
  end if;

  anon_select_qual := public._pem_policy_qual('Contact', 'contact: anon read public');

  drop policy if exists "contact: admin all" on public."Contact";
  drop policy if exists "contact: team select" on public."Contact";
  drop policy if exists "contact: team insert" on public."Contact";
  drop policy if exists "contact: team update" on public."Contact";
  drop policy if exists "contact: team delete" on public."Contact";
  drop policy if exists "contact: anon read public" on public."Contact";

  if anon_select_qual is not null then
    execute format(
      'create policy "contact: select" on public."Contact" for select to public
       using (is_admin() or is_team() or (%s))',
      anon_select_qual
    );
  else
    create policy "contact: select" on public."Contact"
      for select to public
      using (is_admin() or is_team());
  end if;

  create policy "contact: insert" on public."Contact"
    for insert to public
    with check (is_admin() or is_team());

  create policy "contact: update" on public."Contact"
    for update to public
    using (is_admin() or is_team())
    with check (is_admin() or is_team());

  create policy "contact: delete" on public."Contact"
    for delete to public
    using (is_admin() or is_team());
end;
$contact$;

-- ── Cleanup helpers ────────────────────────────────────────────────────────

drop function if exists public._pem_split_public_read_team_all(text, text, text, text);
drop function if exists public._pem_merge_delete_policies(text, text, text, text);
drop function if exists public._pem_merge_select_policies(text, text, text, text, text);
drop function if exists public._pem_policy_qual(text, text);
drop function if exists public._pem_policy_with_check(text, text);
