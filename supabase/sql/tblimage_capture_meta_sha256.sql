-- Optional capture metadata + content hash on tblImage (Verb 1 / field tooling).
-- Run in Supabase SQL Editor.

alter table public."tblImage"
  add column if not exists capture_meta jsonb;

alter table public."tblImage"
  add column if not exists sha256 text;

create index if not exists idx_tblimage_sha256
  on public."tblImage" (sha256)
  where sha256 is not null;

comment on column public."tblImage".capture_meta is 'EXIF / device / session JSON captured at ingest (optional).';
comment on column public."tblImage".sha256 is 'SHA-256 of raw upload bytes when available.';
