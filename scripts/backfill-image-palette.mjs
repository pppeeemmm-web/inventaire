#!/usr/bin/env node
// One-off: compute `tblImage.palette` for images that have none (supabase/sql/image_palette.sql).
// New images get theirs in `commitWorkImage`; this covers the existing archive.
//
//   node scripts/backfill-image-palette.mjs            # all images without a palette
//   node scripts/backfill-image-palette.mjs --limit=20 # trial run
//   node scripts/backfill-image-palette.mjs --all      # recompute every image (after tuning the algorithm)
//
// Reads the public 400px AVIF thumb (`thumbs/<name>.avif`) and reuses lib/image-palette.ts
// directly (Node >= 23.6 strips TypeScript types). Safe to re-run: only null palettes are touched.

import { extractPalette } from '../lib/image-palette.ts'
import { supabaseAdmin, requireEnv } from './embed-worker/supabase-admin.mjs'

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity
const recomputeAll = process.argv.includes('--all')
const CONCURRENCY = 6

const supabase = supabaseAdmin()
const base = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL').replace(/\/$/, '')

function thumbUrl(key) {
  const stem = key.replace(/\.[^.]+$/, '')
  return `${base}/thumbs/${stem.split('/').map(encodeURIComponent).join('/')}.avif`
}

async function pending() {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('tblImage')
      .select('ImageID, txtImageNameLink')
      .not('txtImageNameLink', 'is', null)
    if (!recomputeAll) q = q.is('palette', null)
    const { data, error } = await q
      .order('ImageID')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows.slice(0, limit)
}

const rows = await pending()
console.log(`[palette] ${rows.length} image(s) to compute${recomputeAll ? ' (--all)' : ' (no palette yet)'}`)
let ok = 0
let failed = 0
for (let i = 0; i < rows.length; i += CONCURRENCY) {
  await Promise.all(rows.slice(i, i + CONCURRENCY).map(async (row) => {
    try {
      const res = await fetch(thumbUrl(row.txtImageNameLink))
      if (!res.ok) throw new Error(`thumb ${res.status}`)
      const palette = await extractPalette(Buffer.from(await res.arrayBuffer()))
      const { error } = await supabase.from('tblImage').update({ palette }).eq('ImageID', row.ImageID)
      if (error) throw new Error(error.message)
      ok += 1
    // eslint-disable-next-line pem-i18n/no-silent-catch -- CLI script: counted and printed below
    } catch (e) {
      failed += 1
      console.warn(`[palette] ${row.ImageID} ${row.txtImageNameLink}: ${e.message}`)
    }
  }))
  if ((i / CONCURRENCY) % 20 === 0) console.log(`[palette] ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`)
}
console.log(`[palette] done: ${ok} ok, ${failed} failed`)
