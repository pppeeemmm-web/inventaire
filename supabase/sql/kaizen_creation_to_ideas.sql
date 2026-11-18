-- Kaizen « Création » → Idées / work lines / Opérations (R1). Pem 2026-11-18: « OK as written » on the per-entry
-- table in docs/design/2026-11-18/KaizenCreation_to_Ideas.notes.md. DATA ONLY — no schema change, nothing deleted.
--   6 entries → `concept` (Idées; weight petite / recherche; the author and the date in its notes)
--  10 entries → `note_line` on their works (18 lines: some entries name several works); title ideas flagged for Pem
--   2 entries → Kaizen « Business » (Opérations & Stratégie), still open
--  every Création row is kept, marked done (the Fil stops showing it); the text is copied by the database,
--  never retyped. Stops if it already ran or if the 20 entries changed.
-- APPLIED LIVE 2026-11-18 (migration kaizen_creation_to_ideas), after a rolled-back dry run. Checked after: 6 ideas,
-- 18 work lines (4 flagged), #27 and #32 in « business », 0 Création entries open.

do $move$
declare
  n integer;
  pem uuid := (select auth_user_id from "Contact" where "ContactID" = 13);
begin
  if exists (select 1 from concept where notes like 'Venue de Kaizen Création #%')
     or exists (select 1 from note_line where body like '%(Kaizen Création #%') then
    raise exception 'kaizen_creation_to_ideas: already moved';
  end if;
  select count(*) into n from kaizen_item where section = 'creation';
  if n <> 20 then raise exception 'kaizen_creation_to_ideas: expected 20 Création entries, found %', n; end if;

  -- 1. Six ideas
  insert into concept (titre, description, oeuvre_id, statut, category, weight, maturity, notes, created_at, updated_at)
  select btrim(k.title), nullif(btrim(coalesce(k.body, '')), ''), m.oeuvre, 'idee', 'artistic', m.weight, 'graine',
         'Venue de Kaizen Création #' || k.id || ' — '
           || coalesce(nullif(btrim(coalesce(a.who, '')), ''), 'équipe') || ', '
           || to_char(k.created_at at time zone 'Europe/Paris', 'YYYY-MM-DD')
           || case when cardinality(k.work_ids) > 1
                   then ' — œuvres ' || array_to_string(array(select '#' || w from unnest(k.work_ids) w), ', ')
                   else '' end,
         k.created_at, now()
    from kaizen_item k
    join (values (3, 'recherche', 2313), (4, 'recherche', 2313), (15, 'recherche', null::int),
                 (11, 'petite', 2074), (5, 'petite', 2161), (28, 'petite', null::int)) m(id, weight, oeuvre) on m.id = k.id
    left join lateral (
      select coalesce(nullif(c."NomInstitution", ''), concat_ws(' ', c."Prénom", c."Nom")) as who
        from "Contact" c where c.auth_user_id = k.author_id limit 1
    ) a on true;

  -- 2. Lines on the works (title ideas flagged for Pem)
  insert into note_line (target_kind, oeuvre_id, body, author_id, flagged_for_pem, created_at)
  select 'work', w.oeuvre,
         btrim(concat_ws(E'\n', nullif(btrim(k.title), ''), nullif(btrim(coalesce(k.body, '')), ''))) || E'\n(Kaizen Création #' || k.id || ')',
         k.author_id, w.flag, k.created_at
    from kaizen_item k
    join (values (1, 2313, false), (2, 2313, false), (10, 2074, false),
                 (6, 2057, false), (6, 2058, false), (6, 2059, false), (6, 2060, false), (6, 2061, false), (6, 2062, false), (6, 2063, false),
                 (13, 2356, false), (17, 2205, true), (19, 219, true), (18, 1565, true), (18, 1567, true),
                 (23, 2382, false), (25, 2384, false), (25, 2383, false)) w(id, oeuvre, flag) on w.id = k.id;

  -- 3. Kaizen: two to Opérations (Business, still open); every other Création entry done
  update kaizen_item set section = 'business' where id in (27, 32) and section = 'creation';
  update kaizen_item set done_at = now(), done_by = pem where section = 'creation' and done_at is null;
end
$move$;
