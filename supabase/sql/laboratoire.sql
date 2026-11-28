-- Laboratoire — database part (docs/design/2026-11-28/Laboratoire.md, build step 2; Pem « GO lab build » 2026-11-28).
-- Applied on live 2026-11-28 on Pem's « apply lab », after the throwaway test (laboratoire.test.sql, 14/14).
--
-- 1. concept: lab_role (champ · chapitre · but · conjecture · regle · recette · matiere · terme), position (order in a
--    chapter), lab_version (a recipe's version number). An idea with no lab_role is an ordinary idea.
-- 2. recipe_ingredient, recipe_step, lab_assessment: a recipe's lines, its ordered steps, its grid of limits (13
--    criteria × literature / trials, sign + score 1–5 + note). Team reads; nobody writes them directly.
-- 3. save_recipe(p): the one door — ingredients + steps + limits of one recipe (or limits of a conjecture), all or
--    nothing, stale-checked on concept.updated_at, admin only (Pem: « Only me »).
-- 4. Guards: only an admin creates, changes or deletes a Laboratoire idea (lab_role set, or under one), or links a
--    Journal entry to one (trials). A session without a user (service maintenance) passes.
-- 5. The three ideas already in (« Laboratoire », the oil and Temperone conjectures) get their roles.
-- Journal « essai » is a label (journal_entry_label), no schema change.

begin;

-- ── 1. Roles on ideas ─────────────────────────────────────────────────────────────────────────────────────────────
alter table public.concept add column if not exists lab_role text;
alter table public.concept add column if not exists position integer;
alter table public.concept add column if not exists lab_version smallint;
alter table public.concept drop constraint if exists concept_lab_role_ck;
alter table public.concept add constraint concept_lab_role_ck
  check (lab_role is null or lab_role in ('champ', 'chapitre', 'but', 'conjecture', 'regle', 'recette', 'matiere', 'terme'));
alter table public.concept drop constraint if exists concept_lab_version_ck;
alter table public.concept add constraint concept_lab_version_ck check (lab_version is null or lab_version >= 1);
create index if not exists concept_lab_role_idx on public.concept (lab_role) where lab_role is not null;

-- ── 2. Recipe lines, steps, grid of limits ────────────────────────────────────────────────────────────────────────
create table if not exists public.recipe_ingredient (
  id            bigint generated always as identity primary key,
  recipe_id     uuid not null references public.concept(id) on delete cascade,
  position      integer not null,
  stock_item_id bigint references public.stock_item(id) on delete set null,
  label         text,
  amount        numeric,
  unit          text,
  ratio_pct     numeric,
  note          text,
  constraint recipe_ingredient_what_ck check (stock_item_id is not null or nullif(btrim(label), '') is not null),
  constraint recipe_ingredient_ratio_ck check (ratio_pct is null or (ratio_pct >= 0 and ratio_pct <= 100))
);
create index if not exists recipe_ingredient_recipe_idx on public.recipe_ingredient (recipe_id, position);

create table if not exists public.recipe_step (
  id                     bigint generated always as identity primary key,
  recipe_id              uuid not null references public.concept(id) on delete cascade,
  position               integer not null,
  body                   text not null check (length(btrim(body)) > 0),
  duration               text,
  equipment_stock_item_id bigint references public.stock_item(id) on delete set null,
  warning                text
);
create index if not exists recipe_step_recipe_idx on public.recipe_step (recipe_id, position);

create table if not exists public.lab_assessment (
  id               bigint generated always as identity primary key,
  subject_id       uuid not null references public.concept(id) on delete cascade,
  criterion        text not null check (criterion in ('adhesion', 'flexibility', 'ageing', 'compatibility', 'layering',
                     'max_thickness', 'supports', 'drying', 'optical', 'solubility', 'handling', 'batch_life', 'health_cost')),
  source           text not null check (source in ('literature', 'trials')),
  sign             text not null check (sign in ('ok', 'condition', 'no', 'unknown')),
  score            smallint check (score is null or score between 1 and 5),
  note             text,
  source_ref       text,
  journal_entry_id bigint references public.journal_entry(id) on delete set null,
  unique (subject_id, criterion, source)
);

alter table public.recipe_ingredient enable row level security;
alter table public.recipe_step enable row level security;
alter table public.lab_assessment enable row level security;
drop policy if exists recipe_ingredient_select on public.recipe_ingredient;
drop policy if exists recipe_step_select on public.recipe_step;
drop policy if exists lab_assessment_select on public.lab_assessment;
create policy recipe_ingredient_select on public.recipe_ingredient for select to authenticated using (public.is_team());
create policy recipe_step_select on public.recipe_step for select to authenticated using (public.is_team());
create policy lab_assessment_select on public.lab_assessment for select to authenticated using (public.is_team());
revoke all on public.recipe_ingredient, public.recipe_step, public.lab_assessment from public, anon, authenticated;
grant select on public.recipe_ingredient, public.recipe_step, public.lab_assessment to authenticated;

-- ── 3. The door ───────────────────────────────────────────────────────────────────────────────────────────────────
-- p = { id: uuid, read_updated_at?: timestamptz (stale check), version?: int,
--       ingredients?: [{stock_item_id?, label?, amount?, unit?, ratio_pct?, note?}],   -- recipes only, in order
--       steps?: [{body, duration?, equipment_stock_item_id?, warning?}],               -- recipes only, in order
--       assessments?: [{criterion, source, sign, score?, note?, source_ref?, journal_entry_id?}] }
-- A kind left out is not touched; a kind sent replaces that kind's rows.
create or replace function public.save_recipe(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_c public.concept;
  v_changed text[] := '{}';
  v_bad text;
begin
  if not public.is_admin() then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  select * into v_c from public.concept where id = v_id for update;
  if not found or v_c.lab_role is null then
    return jsonb_build_object('refused', 'not_found');
  end if;
  if v_c.lab_role <> 'recette' and (p ? 'ingredients' or p ? 'steps' or p ? 'version') then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'recipe_only');
  end if;
  if v_c.lab_role not in ('recette', 'conjecture') and p ? 'assessments' then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'assessments');
  end if;
  if p ? 'read_updated_at' and (p->>'read_updated_at')::timestamptz is distinct from v_c.updated_at then
    return jsonb_build_object('refused', 'stale');
  end if;

  if p ? 'ingredients' then
    select x->>'label' into v_bad from jsonb_array_elements(p->'ingredients') x
     where nullif(x->>'stock_item_id', '') is null and nullif(btrim(coalesce(x->>'label', '')), '') is null limit 1;
    if found then return jsonb_build_object('refused', 'bad_field', 'detail', 'ingredient'); end if;
    delete from public.recipe_ingredient where recipe_id = v_id;
    insert into public.recipe_ingredient (recipe_id, position, stock_item_id, label, amount, unit, ratio_pct, note)
    select v_id, i::int, nullif(x->>'stock_item_id', '')::bigint, nullif(btrim(x->>'label'), ''), nullif(x->>'amount', '')::numeric,
           nullif(btrim(x->>'unit'), ''), nullif(x->>'ratio_pct', '')::numeric, nullif(btrim(x->>'note'), '')
      from jsonb_array_elements(p->'ingredients') with ordinality t(x, i);
    v_changed := v_changed || 'ingredients'::text;
  end if;
  if p ? 'steps' then
    delete from public.recipe_step where recipe_id = v_id;
    insert into public.recipe_step (recipe_id, position, body, duration, equipment_stock_item_id, warning)
    select v_id, i::int, btrim(x->>'body'), nullif(btrim(x->>'duration'), ''), nullif(x->>'equipment_stock_item_id', '')::bigint,
           nullif(btrim(x->>'warning'), '')
      from jsonb_array_elements(p->'steps') with ordinality t(x, i);
    v_changed := v_changed || 'steps'::text;
  end if;
  if p ? 'assessments' then
    delete from public.lab_assessment where subject_id = v_id;
    insert into public.lab_assessment (subject_id, criterion, source, sign, score, note, source_ref, journal_entry_id)
    select v_id, x->>'criterion', x->>'source', x->>'sign', nullif(x->>'score', '')::smallint, nullif(btrim(x->>'note'), ''),
           nullif(btrim(x->>'source_ref'), ''), nullif(x->>'journal_entry_id', '')::bigint
      from jsonb_array_elements(p->'assessments') x;
    v_changed := v_changed || 'assessments'::text;
  end if;
  if p ? 'version' then
    update public.concept set lab_version = (p->>'version')::smallint where id = v_id;
    v_changed := v_changed || 'version'::text;
  end if;
  if cardinality(v_changed) = 0 then
    return jsonb_build_object('unchanged', true);
  end if;
  update public.concept set updated_at = now() where id = v_id returning updated_at into v_c.updated_at;
  return jsonb_build_object('ok', true, 'changed', to_jsonb(v_changed), 'updated_at', v_c.updated_at);
end;
$$;
revoke execute on function public.save_recipe(jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb) to authenticated;

-- ── 4. Guards: the Laboratoire is Pem's (admin) ───────────────────────────────────────────────────────────────────
create or replace function public.concept_lab_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_lab boolean;
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;
  v_lab := (tg_op <> 'INSERT' and old.lab_role is not null)
        or (tg_op <> 'DELETE' and new.lab_role is not null)
        or (tg_op <> 'DELETE' and new.parent_id is not null
            and exists (select 1 from public.concept c where c.id = new.parent_id and c.lab_role is not null));
  if v_lab then
    raise exception 'lab_admin_only' using errcode = '42501', detail = 'Only an admin writes in the Laboratoire.';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.concept_lab_guard() from public, anon, authenticated;
drop trigger if exists trg_concept_lab_guard on public.concept;
create trigger trg_concept_lab_guard before insert or update or delete on public.concept
  for each row execute function public.concept_lab_guard();

create or replace function public.journal_link_lab_guard()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.concept_id is not null and auth.uid() is not null and not public.is_admin()
     and exists (select 1 from public.concept c where c.id = new.concept_id and c.lab_role is not null) then
    raise exception 'lab_admin_only' using errcode = '42501', detail = 'Only an admin links a Journal entry to the Laboratoire.';
  end if;
  return new;
end;
$$;
revoke execute on function public.journal_link_lab_guard() from public, anon, authenticated;
drop trigger if exists trg_journal_link_lab_guard on public.journal_entry_link;
create trigger trg_journal_link_lab_guard before insert on public.journal_entry_link
  for each row execute function public.journal_link_lab_guard();

-- ── 5. The ideas already in ───────────────────────────────────────────────────────────────────────────────────────
update public.concept set lab_role = 'champ' where id = '6943645e-ff9b-46eb-96cc-69048b503699' and lab_role is null;
update public.concept set lab_role = 'conjecture', position = 1
 where id = '0e8d1bac-39c1-470c-99c6-74865f478cb4' and lab_role is null;
update public.concept set lab_role = 'conjecture', position = 2
 where id = 'a81d7d90-a2ca-4bf5-87cc-b677988cf4c2' and lab_role is null;

commit;
