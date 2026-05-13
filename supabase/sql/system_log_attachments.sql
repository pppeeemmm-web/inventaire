-- System Ledger: optional image attachments (R2 keys) per manual row.
-- Run in Supabase SQL editor. App stores JSON array of { "key": "ledger/..." }.

alter table system_log
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column system_log.attachments is
  'Ledger screenshots: [{ "key": "ledger/L_<uuid>_<hash8>.<ext>" }]. R2 lifecycle: delete prefix ledger/ after 30 days.';
