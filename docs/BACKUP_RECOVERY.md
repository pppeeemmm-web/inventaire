# Backup & Recovery Playbook (Phase E)

Daily off-site backup of the Supabase Postgres database.

## Schedule
- GitHub Actions workflow `.github/workflows/backup.yml`
- Cron: `17 3 * * *` (03:17 UTC daily)
- Also triggerable manually from the Actions tab (`workflow_dispatch`)

## What gets backed up
- Full `pg_dump` of the Supabase project — schema + data, all tables.
- Excludes `pg_*` and `information_schema` (system noise).
- Gzipped, named `art-db-<ISO-timestamp>.sql.gz`, uploaded to
  `s3://${R2_BACKUP_BUCKET}/daily/`.

## One-time setup

### 1. Create the backup R2 bucket
Cloudflare dashboard → R2 → **Create bucket** named e.g. `art-db-backups`.

Add an Object Lifecycle Rule on the bucket:
- Prefix: `daily/`
- Action: Delete objects after **90 days** (or longer if you prefer)

This prunes old backups so cost stays bounded.

Optional second lifecycle rule (Slice 7):
- Prefix: `weekly/`
- Action: Delete after **365 days** (or match your retention policy)

### 2. Create a scoped R2 API token
R2 → **Manage R2 API Tokens** → Create:
- Permission: **Object Read & Write**
- Scope: **only** the `art-db-backups` bucket
- TTL: long (1 year, rotate yearly)

Copy the Access Key ID and Secret Access Key — you won't see them again.

### 3. Get the Supabase DB URL
Supabase dashboard → Project → **Project Settings → Database**
- Section **Connection string** → choose `URI` mode
- It looks like `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres`
- Copy it whole.

### 4. Add GitHub repo secrets
GitHub → repo → **Settings → Secrets and variables → Actions → New repo secret**:

| Name | Value |
| --- | --- |
| `SUPABASE_DB_URL`       | from step 3 |
| `R2_BACKUP_ACCOUNT_ID`  | your Cloudflare account ID |
| `R2_BACKUP_ACCESS_KEY`  | from step 2 |
| `R2_BACKUP_SECRET_KEY`  | from step 2 |
| `R2_BACKUP_BUCKET`      | `art-db-backups` (or whatever you named it) |

### 5. First run
Actions tab → **Daily Supabase backup** → **Run workflow** → check it completes green.
Open R2 → `art-db-backups/daily/` → confirm the `.sql.gz` is there and the size looks reasonable.

## Images and the readable archive (2026-11-13)

The daily job above covers the **database only**. Images and documents live in R2 and had no second copy.

`npm run archive` ([`scripts/archive-export.mjs`](../scripts/archive-export.mjs)) makes one on this PC — `%USERPROFILE%\PEM-Archive`, or `-- --out "E:\PEM-Archive"`:

- `images/` and `vault/`: every R2 object except `recycle/`, `share-inbox/`, `ledger/`. Repeat runs download only new or changed files.
- `index.html`: every work, searchable, with its journal entries — opens in a browser with no app and no network.
- `works.csv`, `journal/YYYY.md`, `data/json/*.json` (every table), `private/` (contacts).

It only reads. Prices, notes and contacts are inside: keep the folder private. This is a copy to read and to hand over, not a restore path for the database (use the pg_dump above for that); the images in it are what a restore would re-upload.

Weekly, automatic: `pwsh scripts/register-archive-task.ps1` (once; Windows scheduled task, Sunday 10:00, log in `%USERPROFILE%\PEM-Archive-last-run.log`; `-Out`, `-Day`, `-At`, `-Unregister`). A copy on a second disk or with a trusted person is still a manual step.

## Graph CSV exports (Slice 7 Phase 2)

**Workflow:** `.github/workflows/graph-csv-backup.yml`  
**Script:** `scripts/backup-graph-csv.sh`  
**Schedule:** Sundays 04:30 UTC (manual: Actions → **Weekly graph CSV backup**)

Exports `public.entity` and `public.edge_fact` with the same columns as admin `GET /api/export/csv` (UTF-8 BOM, CSV header row). Uploads to:

- `weekly/pem_entity_YYYY-MM-DD.csv`
- `weekly/pem_edge_fact_YYYY-MM-DD.csv`

Uses the **same** `SUPABASE_DB_URL` and `R2_BACKUP_*` secrets as the daily dump. No app deploy or admin session required.

**Recovery use:** open in Excel / LibreOffice / Google Sheets for catalogue relationships when Postgres or the app is unavailable. Not a substitute for `pg_dump` — no row-level restore, no images.

## Recovery — full restore

When you need to restore (test or real incident):

1. Download the latest dump from the Cloudflare R2 dashboard (or `aws s3 cp ... --endpoint-url=https://<account>.r2.cloudflarestorage.com`).
2. Decompress: `gunzip art-db-<stamp>.sql.gz`.
3. Spin up a **fresh** Supabase project (or local Postgres) — never restore into the live project unless you're sure.
4. Restore: `psql "<NEW_PROJECT_CONNECTION_STRING>" < art-db-<stamp>.sql`
5. Sanity-check row counts:
   ```sql
   select count(*) from "Oeuvres";
   select count(*) from "Contact";
   select count(*) from pending_changes;
   select count(*) from oeuvre_versions;
   ```
6. Image files are NOT in this backup — they live in R2 `paintings`/`vault` buckets and are protected by the Phase D `recycle/` soft-delete pattern.

## Recovery — single row / table

Faster than a full restore for a one-off "I just deleted the wrong row":

1. Download + gunzip the dump.
2. Extract just the table you need: `pg_restore` doesn't work on plain-text dumps, but you can grep for the COPY block:
   ```bash
   awk '/^COPY public\."Oeuvres"/,/^\\\.$/' art-db-<stamp>.sql > oeuvres-rows.sql
   ```
3. Load into a scratch DB, query for the row, then re-INSERT into prod.

## Recovery drill schedule
Once per quarter, do steps 1–5 of "full restore" into a throwaway project to confirm the dumps are actually readable. A backup you never test is wishful thinking, not a backup.

**Archive reminder (2026-11-13):** each `npm run archive` run inserts a `system_log` row (`event_type = 'ARCHIVE_RUN'`); Overview → Local jobs shows the age of the last copy and turns red after 14 days.
