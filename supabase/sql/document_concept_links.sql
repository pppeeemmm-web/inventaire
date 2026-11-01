-- Documents for concepts: a Vault document can belong to a concept, and a document can be
-- a FILE (stored in the R2 `vault` bucket), a LINK (Google Drive, Proton Drive, a web page)
-- or a LOCAL MENTION (only says where the file lives on one of the owner's machines).
--
-- Owner's request (2026-11-01): attach research material — exported AI discussions, PDFs,
-- references — to concepts. Large or private files stay in Drive / Proton / on disk and are
-- recorded as a link or a local mention, so R2 holds only what the app must open itself.
--
-- `source` defaults to 'file' so every existing row keeps its meaning (28 of the 42 existing
-- rows are file records with no stored file yet — still 'file', storage_path null).
--
-- No GRANT/RLS changes: columns on an existing table, already covered by `document_team_all`.
-- After applying: npm run gen:types

alter table public.document
  add column if not exists concept_id uuid
    references public.concept(id) on delete set null,
  add column if not exists source text not null default 'file'
    check (source in ('file', 'link', 'local')),
  add column if not exists external_url text,
  add column if not exists local_location text;

comment on column public.document.concept_id is
  'Optional concept this document belongs to (Concepts tab). ON DELETE SET NULL: the document survives in the Vault.';
comment on column public.document.source is
  '''file'' = stored in R2 (storage_path); ''link'' = external_url (Drive, Proton, web); ''local'' = local_location, a plain-text note of where the file lives.';
comment on column public.document.external_url is
  'http(s) URL for source = link.';
comment on column public.document.local_location is
  'Free text for source = local, e.g. "PC atelier — C:\\Recherche\\x.pdf". Never a clickable link: browsers block file://.';

alter table public.document
  drop constraint if exists document_source_fields;
alter table public.document
  add constraint document_source_fields check (
    case source
      when 'link'  then external_url ~* '^https?://' and storage_path is null
      when 'local' then nullif(btrim(local_location), '') is not null and storage_path is null
      else true
    end
  );

create index if not exists document_concept_id_idx
  on public.document (concept_id)
  where concept_id is not null;
