-- Verb 7 — admin signature on Contact (run in Supabase, then npm run gen:types).

alter table public."Contact"
  add column if not exists signature_r2_key text;

comment on column public."Contact".signature_r2_key is 'R2 key for captured signature PNG (admin setup).';
