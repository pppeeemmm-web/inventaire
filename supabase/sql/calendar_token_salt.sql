-- Per-account salt for HKDF when encrypting calendar OAuth refresh tokens.
-- Idempotent: safe to re-run.

alter table calendar_account
  add column if not exists token_salt text;

comment on column calendar_account.token_salt is
  'Random salt (base64) for HKDF-SHA256 key derivation; null means legacy ciphertext (SHA256-only key).';
