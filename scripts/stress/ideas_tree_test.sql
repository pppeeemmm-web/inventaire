-- Proof of supabase/sql/ideas_tree.sql on the throwaway copy ONLY (refuses anything but the stress accounts).
-- Run: Get-Content scripts/stress/ideas_tree_test.sql | docker exec -i supabase_db_stress psql -U postgres
-- Everything runs in one transaction and is rolled back at the end. Each line prints PASS / FAIL.
\set ON_ERROR_STOP 0
\set ON_ERROR_ROLLBACK on
\pset tuples_only on
begin;

do $$ begin
  if not exists (select 1 from auth.users where email = 'pem.stress@example.test') then
    raise exception 'not the stress copy';
  end if;
end $$;

create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated, anon;
create or replace function pg_temp.who(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
end $$;
create temp table t_out (n serial, line text);
grant all on t_out to authenticated, anon; grant usage on sequence t_out_n_seq to authenticated, anon;

-- ── TEAM plants an idea in the tab (no moment given) ────────────────────────────────────
select pg_temp.who('team.stress@example.test');
set local role authenticated;
insert into t_ids select 'team_plant', idea_plant('Lumière rasante', 'La lumière du matin sur le mur', null, null)::text;
reset role;
insert into t_out(line)
select case when c.created_by = (select id from auth.users where email='team.stress@example.test')
             and c.maturity = 'graine' and e.event_on = (now() at time zone 'Europe/Paris')::date
             and e.body = 'La lumière du matin sur le mur'
             and exists (select 1 from journal_entry_link l where l.entry_id = e.id and l.concept_id = c.id and l.validated_at is not null)
             and exists (select 1 from journal_entry_label b where b.entry_id = e.id and b.label = 'idea')
             and exists (select 1 from concept_change h where h.concept_id = c.id and h.what = 'planted')
       then 'PASS team plants in the tab: idea + moment today + link + label + history' else 'FAIL team plant' end
from t_ids t, concept c, journal_entry e
where t.k = 'team_plant' and c.id = (t.v::jsonb->>'concept_id')::uuid and e.id = (t.v::jsonb->>'entry_id')::bigint;

-- ── ADMIN plants from an existing moment, and a branch under it ─────────────────────────
select pg_temp.who('pem.stress@example.test');
set local role authenticated;
insert into journal_entry (kind, body) values ('note', 'Des coquillages pris dans le sel') returning id \gset e_
insert into t_ids select 'pem_plant', idea_plant('Coquillages dans le sel', 'ignored', :e_id, null)::text;
insert into t_ids select 'branch', idea_plant('La croûte de sel', null, null, (select (v::jsonb->>'concept_id')::uuid from t_ids where k='pem_plant'))::text;
reset role;
insert into t_out(line)
select case when (t.v::jsonb->>'entry_id')::bigint = :e_id
             and (select count(*) from journal_entry where body = 'Des coquillages pris dans le sel') = 1
       then 'PASS plant from a moment: the moment is reused, nothing copied' else 'FAIL plant from moment' end
from t_ids t where t.k = 'pem_plant';
insert into t_out(line)
select case when c.parent_id = (select (v::jsonb->>'concept_id')::uuid from t_ids where k='pem_plant')
       then 'PASS branch grows on its idea' else 'FAIL branch' end
from t_ids t join concept c on c.id = (t.v::jsonb->>'concept_id')::uuid where t.k = 'branch';

-- ── Loops refused ───────────────────────────────────────────────────────────────────────
select pg_temp.who('pem.stress@example.test');
set local role authenticated;
do $$ declare r uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='pem_plant');
              b uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='branch');
begin
  begin update concept set parent_id = b where id = r;
        insert into t_out(line) values ('FAIL loop (graft on own branch) accepted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'idea_loop' then 'PASS graft on own branch refused: idea_loop' else 'FAIL loop: '||sqlerrm end); end;
  begin update concept set parent_id = r where id = r;
        insert into t_out(line) values ('FAIL self-parent accepted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'idea_loop' then 'PASS self-parent refused' else 'FAIL self: '||sqlerrm end); end;
end $$;
reset role;

-- ── Stage: author yes, other team member no, admin yes ──────────────────────────────────
select pg_temp.who('team.stress@example.test');
set local role authenticated;
do $$ declare mine uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='team_plant');
              pems uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='pem_plant');
begin
  update concept set maturity = 'pousse' where id = mine;
  insert into t_out(line) values ('PASS team moves the stage of its own idea');
  begin update concept set maturity = 'mure' where id = pems;
        insert into t_out(line) values ('FAIL team moved Pem''s stage');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'idea_stage_not_allowed' then 'PASS team cannot move the stage of Pem''s idea' else 'FAIL stage: '||sqlerrm end); end;
  update concept set description = 'Texte écrit par l''équipe' where id = pems;
  insert into t_out(line) values ('PASS team writes the text of Pem''s idea');
  begin update concept set created_by = auth.uid() where id = pems;
        insert into t_out(line) values ('FAIL author changed');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'idea_author_frozen' then 'PASS author frozen' else 'FAIL author: '||sqlerrm end); end;
  delete from concept where id = mine;
  insert into t_out(line) select case when exists (select 1 from concept where id = mine) then 'PASS team delete removes nothing (RLS)' else 'FAIL team deleted an idea' end;
end $$;
reset role;

select pg_temp.who('pem.stress@example.test');
set local role authenticated;
do $$ declare other uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='team_plant');
              pems uuid := (select (v::jsonb->>'concept_id')::uuid from t_ids where k='pem_plant');
begin
  update concept set maturity = 'mure' where id = other;
  insert into t_out(line) values ('PASS admin moves the stage of a team idea (until Pem decides)');
  begin delete from concept where id = pems;
        insert into t_out(line) values ('FAIL admin deleted an idea that has moments');
  exception when others then insert into t_out(line) values ('PASS admin delete refused while moments / branches point to it ('||sqlstate||')'); end;
end $$;
reset role;

insert into t_out(line)
select case when string_agg(what||':'||coalesce(to_value,''), ',' order by id) like '%stage:pousse%stage:mure%'
             and bool_or(what = 'text') then 'PASS history lines: planted, stage, text' else 'FAIL history '||string_agg(what, ',') end
from concept_change where concept_id in (select (v::jsonb->>'concept_id')::uuid from t_ids);

-- ── Refusals of the door ────────────────────────────────────────────────────────────────
select pg_temp.who('pem.stress@example.test');
set local role authenticated;
do $$ begin
  begin perform idea_plant('   ');
        insert into t_out(line) values ('FAIL empty title accepted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'empty' then 'PASS empty title refused' else 'FAIL empty: '||sqlerrm end); end;
  begin perform idea_plant('x', null, -1);
        insert into t_out(line) values ('FAIL missing entry accepted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'not_found' then 'PASS missing moment refused' else 'FAIL entry: '||sqlerrm end); end;
  begin perform idea_plant('x', null, null, gen_random_uuid());
        insert into t_out(line) values ('FAIL missing parent accepted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'not_found' then 'PASS missing parent refused' else 'FAIL parent: '||sqlerrm end); end;
end $$;
reset role;

select pg_temp.who('outsider.stress@example.test');
set local role authenticated;
do $$ begin
  begin perform idea_plant('intrus');
        insert into t_out(line) values ('FAIL outsider planted');
  exception when others then insert into t_out(line) values (case when sqlerrm = 'not_allowed' then 'PASS outsider refused' else 'FAIL outsider: '||sqlerrm end); end;
  insert into t_out(line) select case when count(*) = 0 then 'PASS outsider sees no idea' else 'FAIL outsider sees ideas' end from concept;
end $$;
reset role;

set local role anon;
do $$ begin
  begin perform idea_plant('anon');
        insert into t_out(line) values ('FAIL anon planted');
  exception when others then insert into t_out(line) values ('PASS anon cannot call the door ('||sqlstate||')'); end;
  begin perform * from idea_list();
        insert into t_out(line) values ('FAIL anon read the list');
  exception when others then insert into t_out(line) values ('PASS anon cannot read the list ('||sqlstate||')'); end;
end $$;
reset role;

-- ── The list ────────────────────────────────────────────────────────────────────────────
select pg_temp.who('pem.stress@example.test');
set local role authenticated;
insert into t_out(line)
select case when l.moments = 1 and l.days = 1 and l.branches = 1 and l.last_at is not null
       then 'PASS idea_list counts (1 moment, 1 day, 1 branch)' else 'FAIL list '||row(l.*)::text end
from idea_list(null, 50, 0) l where l.titre = 'Coquillages dans le sel';
insert into t_out(line)
-- (inside one transaction now() is one instant, so check the order holds rather than which row wins a tie)
select case when bool_and(prev is null or prev >= last_at) and count(*) = (select count(*) from concept)
       then 'PASS idea_list sorted by last moment, newest first, all ideas' else 'FAIL order' end
from (select last_at, lag(last_at) over (order by ord) prev from idea_list(null, 200, 0) with ordinality as x(id, titre, maturity, parent_id, created_by, oeuvre_id, created_at, moments, days, works, documents, branches, last_at, ord)) s;
reset role;

select line from t_out order by n;
rollback;
