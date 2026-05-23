-- Slice 5 — run after 04_tblrelations_node_fks.sql if 05 fails on tblrelations_uid_pair_type_uniq.
-- Keeps oldest row per (source_uid, target_uid, relation_type); deletes duplicates.

DELETE FROM public.tblrelations r
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY source_uid, target_uid, relation_type
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.tblrelations
    WHERE source_uid IS NOT NULL
      AND target_uid IS NOT NULL
      AND relation_type IS NOT NULL
  ) ranked
  WHERE rn > 1
) dup
WHERE r.id = dup.id;

-- Then re-run from CREATE UNIQUE INDEX in 05_relation_sync_triggers.sql (or run full 05).
