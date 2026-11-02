-- Colour palette per photo (S6 / pic 9 "colour dropper", owner GO 2026-11-01).
--
-- `palette` = up to 6 main colours of the image, largest first:
--   [{ "hex": "#8fb2b4", "share": 0.346 }, ...]   (share = fraction of the image)
-- Computed server-side by `lib/image-palette.ts` (k-means in CIELAB on the 400px thumb) when an
-- image is committed (`commitWorkImage`), and for existing images by
-- `scripts/backfill-image-palette.mjs`. A work's palette = its cover image's.
--
-- Accuracy = the photo's own colours (white balance/exposure from Lightroom); background, margin
-- or frame in the shot count too. Not paint-accurate (no colour card).
--
-- No GRANT/RLS change: a column on an existing table, covered by `tblImage` policies.
-- After applying: npm run gen:types

alter table public."tblImage"
  add column if not exists palette jsonb;

comment on column public."tblImage".palette is
  'Main colours of the photo, largest first: [{hex, share}]. Written by lib/image-palette.ts; null = not computed yet.';
