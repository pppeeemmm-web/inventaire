-- Journal entries in the semantic index + AI link proposals (journal build step 5, owner GO 2026-11-12).
-- docs/JOURNAL_PROPOSAL.md, docs/ARCHITECTURE.md §6b/§8.
--
-- * Each journal entry gets a `nodes` row (node_type 'journal_entry'); the embed worker embeds its body
--   with the same model as everything else (nomic-embed-text). Hidden or private entries have no text
--   → `skipped`, and their vector is dropped.
-- * `journal_propose_links()` (service role, called by the embed worker after each pass) proposes up to
--   3 works and 3 concepts per entry by vector similarity: `journal_entry_link` rows with
--   proposed_by 'ai', validated_at null. Only an admin's validation makes a proposal a link
--   (validated_at); a rejection sets rejected_at. Nothing is deleted (link guard).
-- * Each entry is proposed for once (`journal_entry.ai_links_at`).

-- 1. Node type
alter table public.nodes drop constraint if exists nodes_node_type_check;
alter table public.nodes add constraint nodes_node_type_check
  check (node_type in ('oeuvre', 'contact', 'theme', 'concept', 'working_group', 'exhibition', 'journal_entry'));

-- 2. Markers
alter table public.journal_entry add column if not exists ai_links_at timestamptz;
alter table public.journal_entry_link add column if not exists rejected_at timestamptz;
alter table public.journal_entry_link add column if not exists rejected_by uuid;
alter table public.journal_entry_link drop constraint if exists journal_entry_link_decided_ck;
alter table public.journal_entry_link add constraint journal_entry_link_decided_ck
  check (not (validated_at is not null and rejected_at is not null));

-- 3. Register a node per entry (entries are never deleted: no unregister trigger)
create or replace function public.graph_trg_register_journal_entry_node()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.graph_register_node('journal_entry', new.id::text);
  return new;
end;
$$;

drop trigger if exists graph_register_journal_entry_node on public.journal_entry;
create trigger graph_register_journal_entry_node
  after insert on public.journal_entry
  for each row execute function public.graph_trg_register_journal_entry_node();

-- 4. Hide / visibility change → re-embed (hidden or private: no text → skipped; vector dropped now)
create or replace function public.graph_trg_journal_entry_embedding_dirty()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.hidden_at is not null or new.visibility <> 'team' then
    update public.nodes set embedding = null
    where node_type = 'journal_entry' and source_pk = new.id::text;
  end if;
  perform public.graph_mark_nodes_pending('journal_entry', new.id::text);
  return new;
end;
$$;

drop trigger if exists graph_journal_entry_embedding_dirty on public.journal_entry;
create trigger graph_journal_entry_embedding_dirty
  after update of hidden_at, visibility on public.journal_entry
  for each row execute function public.graph_trg_journal_entry_embedding_dirty();

revoke execute on function public.graph_trg_register_journal_entry_node() from public, anon, authenticated;
revoke execute on function public.graph_trg_journal_entry_embedding_dirty() from public, anon, authenticated;

-- 5. Index text (same function, one more branch)
create or replace function public.node_search_text(p_node_id uuid)
returns text
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT nullif(
    trim(
      CASE n.node_type
        WHEN 'oeuvre' THEN (
          SELECT concat_ws(
            '. ',
            o."Titre",
            o."Commentaires",
            tech."Technique"
          )
          FROM public."Oeuvres" o
          LEFT JOIN public."Technique" tech ON tech."TechniqueID" = o."Technique"
          WHERE o."OeuvreID"::text = n.source_pk
        )
        WHEN 'contact' THEN (
          SELECT concat_ws(
            '. ',
            concat_ws(' ', c."Prénom", c."Nom"),
            c."NomInstitution",
            c."Notes"
          )
          FROM public."Contact" c
          WHERE c."ContactID"::text = n.source_pk
        )
        WHEN 'theme' THEN (
          SELECT t.name FROM public.theme t WHERE t.id::text = n.source_pk
        )
        WHEN 'concept' THEN (
          SELECT concat_ws('. ', cp.titre, cp.description)
          FROM public.concept cp
          WHERE cp.id::text = n.source_pk
        )
        WHEN 'working_group' THEN (
          SELECT concat_ws('. ', wg.name, wg.note)
          FROM public.working_group wg
          WHERE wg.id::text = n.source_pk
        )
        WHEN 'exhibition' THEN (
          SELECT concat_ws(
            '. ',
            sp.nom,
            sp.localisation,
            concat_ws(' – ', sp.date_debut::text, sp.date_fin::text),
            sp.notes
          )
          FROM public.suivi_process sp
          WHERE sp.id::text = n.source_pk AND sp.type = 'exposition'
        )
        WHEN 'journal_entry' THEN (
          SELECT je.body
          FROM public.journal_entry je
          WHERE je.id::text = n.source_pk AND je.hidden_at IS NULL AND je.visibility = 'team'
        )
        ELSE NULL
      END
    ),
    ''
  )
  FROM public.nodes n
  WHERE n.node_id = p_node_id;
$function$;

revoke execute on function public.node_search_text(uuid) from public, anon, authenticated;
grant execute on function public.node_search_text(uuid) to service_role;

-- 6. AI link proposals (service role only; embed worker)
create or replace function public.journal_propose_links(p_limit int default 50, p_k int default 3, p_min double precision default 0.55)
returns int
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
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
        select w.source_pk::int as oid, 1 - (w.embedding <=> r.embedding) as score
        from public.nodes w
        join public."Oeuvres" o on o."OeuvreID"::text = w.source_pk and o.deleted_at is null
        where w.node_type = 'oeuvre' and w.embedding is not null
        order by w.embedding <=> r.embedding
        limit p_k
      ) s
      where s.score >= p_min
      on conflict do nothing;

      insert into public.journal_entry_link (entry_id, concept_id, relation, proposed_by, created_by)
      select r.id, s.cid, 'about', 'ai', null
      from (
        select c.source_pk::uuid as cid, 1 - (c.embedding <=> r.embedding) as score
        from public.nodes c
        where c.node_type = 'concept' and c.embedding is not null
        order by c.embedding <=> r.embedding
        limit p_k
      ) s
      where s.score >= p_min
      on conflict do nothing;
    end if;

    update public.journal_entry set ai_links_at = now() where id = r.id;
    n_done := n_done + 1;
  end loop;
  return n_done;
end;
$$;

revoke execute on function public.journal_propose_links(int, int, double precision) from public, anon, authenticated;
grant execute on function public.journal_propose_links(int, int, double precision) to service_role;

-- 7. Backfill nodes for existing entries
select public.graph_register_node('journal_entry', je.id::text) from public.journal_entry je;
