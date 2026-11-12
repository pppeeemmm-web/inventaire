-- Journal ✦ link suggestions: stricter rule (owner GO 2026-11-12).
-- Before: top-3 works + top-3 concepts with cosine >= 0.55. All 75 suggestions sat in
-- 0.55–0.66 and two "hub" concepts came up for nearly every entry.
-- Now a target is suggested only when
--   score >= p_min (0.60)  AND  score - target's average closeness to all journal entries >= p_margin (0.03)
-- i.e. this entry is closer to the work/concept than entries usually are (hub correction).
-- Existing unreviewed AI suggestions that fail the rule are marked rejected (rejected_by NULL =
-- system); nothing is deleted (append-only), and clearing rejected_at brings one back.

create or replace function public.journal_propose_links(
  p_limit integer default 50,
  p_k integer default 3,
  p_min double precision default 0.60,
  p_margin double precision default 0.03
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  r record;
  n_done int := 0;
begin
  for r in
    select je.id, n.embedding_status, n.embedding
    from public.journal_entry je
    join public.nodes n on n.node_type = 'journal_entry' and n.source_pk = je.id::text
    where je.ai_links_at is null
      and n.embedding_status in ('ok', 'skipped')
    order by je.id
    limit p_limit
  loop
    if r.embedding_status = 'ok' and r.embedding is not null then
      insert into public.journal_entry_link (entry_id, oeuvre_id, relation, proposed_by, created_by)
      select r.id, s.oid, 'about', 'ai', null
      from (
        select w.source_pk::int as oid, w.embedding as emb, 1 - (w.embedding <=> r.embedding) as score
        from public.nodes w
        join public."Oeuvres" o on o."OeuvreID"::text = w.source_pk and o.deleted_at is null
        where w.node_type = 'oeuvre' and w.embedding is not null
        order by w.embedding <=> r.embedding
        limit p_k
      ) s
      where s.score >= p_min
        and s.score - (
          select avg(1 - (s.emb <=> e.embedding))
          from public.nodes e
          where e.node_type = 'journal_entry' and e.embedding is not null
        ) >= p_margin
      on conflict do nothing;

      insert into public.journal_entry_link (entry_id, concept_id, relation, proposed_by, created_by)
      select r.id, s.cid, 'about', 'ai', null
      from (
        select c.source_pk::uuid as cid, c.embedding as emb, 1 - (c.embedding <=> r.embedding) as score
        from public.nodes c
        where c.node_type = 'concept' and c.embedding is not null
        order by c.embedding <=> r.embedding
        limit p_k
      ) s
      where s.score >= p_min
        and s.score - (
          select avg(1 - (s.emb <=> e.embedding))
          from public.nodes e
          where e.node_type = 'journal_entry' and e.embedding is not null
        ) >= p_margin
      on conflict do nothing;
    end if;

    update public.journal_entry set ai_links_at = now() where id = r.id;
    n_done := n_done + 1;
  end loop;
  return n_done;
end;
$function$;

revoke execute on function public.journal_propose_links(integer, integer, double precision, double precision) from public, anon, authenticated;
grant execute on function public.journal_propose_links(integer, integer, double precision, double precision) to service_role;
-- The old 3-argument signature is replaced, not overloaded.
drop function if exists public.journal_propose_links(integer, integer, double precision);

-- Retire existing unreviewed AI suggestions that fail the new rule.
with scored as (
  select l.id,
         1 - (t.embedding <=> e.embedding) as score,
         (select avg(1 - (t.embedding <=> e2.embedding))
            from public.nodes e2
           where e2.node_type = 'journal_entry' and e2.embedding is not null) as tavg
  from public.journal_entry_link l
  join public.nodes e on e.node_type = 'journal_entry' and e.source_pk = l.entry_id::text
  join public.nodes t on t.node_type = case when l.oeuvre_id is not null then 'oeuvre' else 'concept' end
                     and t.source_pk = coalesce(l.oeuvre_id::text, l.concept_id::text)
  where l.proposed_by = 'ai' and l.validated_at is null and l.rejected_at is null
)
update public.journal_entry_link l
set rejected_at = now(), rejected_by = null
from scored s
where l.id = s.id and (s.score < 0.60 or s.score - s.tavg < 0.03);
