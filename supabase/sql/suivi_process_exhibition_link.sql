-- Optional link: any pipeline row → exhibition-hub row (same table).
-- Deleting the exhibition project nulls the pointer on other processes instead of blocking or cascading.
ALTER TABLE suivi_process
  ADD COLUMN IF NOT EXISTS exhibition_process_id uuid REFERENCES suivi_process (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS suivi_process_exhibition_process_id_idx
  ON suivi_process (exhibition_process_id)
  WHERE exhibition_process_id IS NOT NULL;
