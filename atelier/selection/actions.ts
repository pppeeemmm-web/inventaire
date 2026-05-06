'use server'

// Selection actions — batch edit and export (HTML / PDF).
// Called from BatchEditModal and ExportModal via useTransition.

import { createClient } from '@/lib/supabase/server'
import { createHash }   from 'crypto'
import { revalidatePath } from 'next/cache'
import sharp from 'sharp'

// ── Types ────────────────────────────────────────────────────────────────

export type BatchResult  = { error: string } | { ok: true; updated: number }
export type ExportResult = { error: string } | { ok: true; content: string; filename: string; mime: string }

export interface BatchChanges {
  Titre?:             string | null
  statusId?:          number | null
  Technique?:         number | null
  Support?:           number | null
  Format?:            number | null
  ContactID?:         number | null
  Exposable?:         boolean
  Montee?:            boolean
  Encadree?:          boolean
  'Catalogué'?:       boolean
  is_public?:         boolean
  IsCommission?:      boolean
  Prix?:              number | null
  Discount?:          number | null
  PrixFinal?:         number | null
  Année?:             string | null
  LocalisationDetail?: string | null
  Commentaires?:      string | null
  // Theme junction — add and/or remove theme IDs across OeuvreTheme
  addThemeIds?:       number[]
  removeThemeIds?:    number[]
  // Group junction — add and/or remove group IDs across working_group_work
  addGroupIds?:       string[]
  removeGroupIds?:    string[]
  is_gift?:           boolean
  is_paid?:           boolean
  NeedsPhotograph?:   boolean
}


export interface ExportConfig {
  format:       'html' | 'pdf'
  layout:       'cards' | 'grid' | 'list'
  columns:      2 | 3 | 4 | 6 | 8 | 10 | 12
  cardsPerPage: 1 | 2 | 3 | 4 | 5 | 6   // fiches layout only
  rowsPerPage:  number                  // grid layout only (0 = auto)
  fields:       ExportFields
  imageSize:    'large' | 'small' | 'none'
  imageEmbed:   'linked' | 'embedded'
  imageCrop:    'square' | 'native'
  paper:        'a4' | 'a3' | 'screen'
  orientation:  'portrait' | 'landscape'
  appendList:   boolean   // append a quick ID list after the card/grid section
  exportTitle?: string | null
}

export interface ExportFields {
  image:     boolean
  title:     boolean
  id:        boolean
  year:      boolean
  technique: boolean
  support:   boolean
  dims:      boolean
  price:     boolean
  status:    boolean
  notes:     boolean
}

// ── Auth guard ────────────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  /*
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  */
  return { error: null, supabase }
}

// ── Batch edit ────────────────────────────────────────────────────────────

export async function batchEdit(ids: number[], changes: BatchChanges): Promise<BatchResult> {
  if (!ids.length) return { error: 'Aucune sélection' }

  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // Build update object from only explicitly-set fields
  const update: Record<string, unknown> = {}
  if (changes.Titre             !== undefined) update.Titre             = changes.Titre?.trim() || null
  if (changes.statusId          !== undefined) update.statusId          = changes.statusId
  if (changes.Technique         !== undefined) update.Technique         = changes.Technique
  if (changes.Support           !== undefined) update.Support           = changes.Support
  if (changes.Format            !== undefined) update.Format            = changes.Format
  if (changes.ContactID         !== undefined) update.ContactID         = changes.ContactID
  if (changes.Exposable         !== undefined) update.Exposable         = changes.Exposable
  if (changes.Montee            !== undefined) update.Montee            = changes.Montee
  if (changes.Encadree          !== undefined) update.Encadree          = changes.Encadree
  if (changes['Catalogué']      !== undefined) update['Catalogué']      = changes['Catalogué']
  if (changes.is_public         !== undefined) update.is_public         = changes.is_public
  if (changes.IsCommission      !== undefined) update.IsCommission      = changes.IsCommission
  if (changes.Prix              !== undefined) update.Prix              = changes.Prix
  if (changes.Discount          !== undefined) update.Discount          = changes.Discount
  if (changes.PrixFinal         !== undefined) update.PrixFinal         = changes.PrixFinal
  if (changes.Année             !== undefined) {
    let a = changes.Année
    if (a && /^\d{4}$/.test(a)) a = `${a}-01-01`
    else if (a && /^\d{4}-\d{2}$/.test(a)) a = `${a}-01`
    update['Année'] = a
  }
  if (changes.LocalisationDetail !== undefined) update.LocalisationDetail = changes.LocalisationDetail
  if (changes.Commentaires      !== undefined) update.Commentaires      = changes.Commentaires
  if (changes.is_gift           !== undefined) update.is_gift           = changes.is_gift
  if (changes.is_paid           !== undefined) update.is_paid           = changes.is_paid
  if (changes.NeedsPhotograph   !== undefined) update.NeedsPhotograph   = changes.NeedsPhotograph

  const hasScalarChanges  = Object.keys(update).length > 0
  const hasThemeChanges   = (changes.addThemeIds?.length ?? 0) > 0 || (changes.removeThemeIds?.length ?? 0) > 0
  const hasGroupChanges   = (changes.addGroupIds?.length ?? 0) > 0 || (changes.removeGroupIds?.length ?? 0) > 0
  if (!hasScalarChanges && !hasThemeChanges && !hasGroupChanges) return { error: 'Aucun champ modifié' }

  let count = ids.length

  if (hasScalarChanges) {
    const { error, count: c } = await supabase
      .from('Oeuvres')
      .update(update)
      .in('OeuvreID', ids)
      .select('OeuvreID', { count: 'exact', head: true })
    if (error) return { error: error.message }
    count = c ?? ids.length
  }

  // ── Theme junction (OeuvreTheme) ──────────────────────────────────────
  if (changes.removeThemeIds?.length) {
    const { error } = await supabase
      .from('OeuvreTheme')
      .delete()
      .in('OeuvreID', ids)
      .in('ThemeID', changes.removeThemeIds)
    if (error) return { error: `Thème (retrait) : ${error.message}` }
  }

  if (changes.addThemeIds?.length) {
    // Build all (oeuvreId, themeId) pairs; upsert ignores existing ones
    const rows = ids.flatMap(oid =>
      changes.addThemeIds!.map(tid => ({ OeuvreID: oid, ThemeID: tid }))
    )
    const { error } = await supabase
      .from('OeuvreTheme')
      .upsert(rows, { onConflict: 'OeuvreID,ThemeID', ignoreDuplicates: true })
    if (error) return { error: `Thème (ajout) : ${error.message}` }
  }

  // ── Group junction (working_group_work) ────────────────────────────────
  if (changes.removeGroupIds?.length) {
    const { error } = await supabase
      .from('working_group_work')
      .delete()
      .in('oeuvre_id', ids)
      .in('group_id', changes.removeGroupIds)
    if (error) return { error: `Groupe (retrait) : ${error.message}` }
  }

  if (changes.addGroupIds?.length) {
    const rows = ids.flatMap(oid =>
      changes.addGroupIds!.map(gid => ({ oeuvre_id: oid, group_id: gid }))
    )
    const { error } = await supabase
      .from('working_group_work')
      .upsert(rows, { onConflict: 'oeuvre_id,group_id', ignoreDuplicates: true })
    if (error) return { error: `Groupe (ajout) : ${error.message}` }
  }

  revalidatePath('/atelier')
  revalidatePath('/hub')
  return { ok: true, updated: count }
}

export async function createTheme(name: string): Promise<{ error?: string, theme?: { ThemeID: number, Nom: string } }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // 1. Try to insert
  const { data, error } = await supabase
    .from('tblTheme')
    .insert({ Nom: name })
    .select('ThemeID, Nom')
    .single()

  // 2. If it exists already (23505), just fetch it
  if (error?.code === '23505') {
    const { data: existing } = await supabase
      .from('tblTheme')
      .select('ThemeID, Nom')
      .eq('Nom', name)
      .single()
    if (existing) return { theme: existing }
  }

  if (error) return { error: `Thème : ${error.message}` }
  revalidatePath('/atelier')
  return { theme: data }
}

// ── Export ────────────────────────────────────────────────────────────────

export async function generateExport(
  ids:    number[],
  config: ExportConfig,
  tM:     Record<number, string>,
  sM:     Record<number, string>,
  statusLabelMap: Record<number, string>,
): Promise<ExportResult> {
  if (!ids.length) return { error: 'Aucune sélection' }

  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // Fetch selected works
  const { data: oeuvres, error: fetchErr } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Technique, Support, Format, Hauteur, Largeur, Profondeur, Prix, PrixFinal, Discount, statusId, Exposable, Catalogué, txtImageNameLink, Commentaires')
    .in('OeuvreID', ids)
    .order('OeuvreID', { ascending: false })

  if (fetchErr || !oeuvres) return { error: fetchErr?.message ?? 'Fetch failed' }

  const R2   = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''
  const STR  = R2

  // Build image map: id → url or base64 data url
  // PDF always needs server-fetched images (pdfkit cannot load remote URLs).
  const imageMap = new Map<number, string>()
  if (config.fields.image && config.imageSize !== 'none') {
    const imgSize  = config.imageSize === 'large' ? 600 : 240
    const needFetch = config.imageEmbed === 'embedded' || config.format === 'pdf'
    const R2_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || ''

    if (needFetch) {
      // Fetch + base64 encode server-side, 8 at a time
      const concurrency = 8
      const chunks: typeof oeuvres[] = []
      for (let i = 0; i < oeuvres.length; i += concurrency)
        chunks.push(oeuvres.slice(i, i + concurrency))

      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (o) => {
          if (!o.txtImageNameLink) return
          try {
            const fileName = o.txtImageNameLink
            const url = fileName.startsWith('http') ? fileName : `${R2_URL}/${encodeURIComponent(fileName)}`
            const res = await fetch(url)
            if (!res.ok) return
            let buf   = Buffer.from(await res.arrayBuffer())
            
            // PDF: pdfkit only supports JPEG and PNG. Convert others (AVIF, etc) to JPEG.
            if (config.format === 'pdf') {
              buf = await sharp(buf).jpeg({ quality: 85 }).toBuffer()
            }

            const mime = config.format === 'pdf' ? 'image/jpeg' : (res.headers.get('content-type') ?? 'image/jpeg')
            imageMap.set(o.OeuvreID, `data:${mime};base64,${buf.toString('base64')}`)
          } catch (e) { 
            console.error(`Export image fetch error (#${o.OeuvreID}):`, e)
          }
        }))
      }
    } else {
      // Linked HTML — include URL directly (browser loads it)
      for (const o of oeuvres) {
        if (o.txtImageNameLink) {
          const fileName = o.txtImageNameLink
          const url = fileName.startsWith('http') ? fileName : `${R2_URL}/${encodeURIComponent(fileName)}`
          imageMap.set(o.OeuvreID, url)
        }
      }
    }
  }

  if (config.format === 'html') {
    const html = buildHtml(oeuvres, config, tM, sM, statusLabelMap, imageMap)
    const ts   = new Date().toISOString().slice(0, 10)
    return { ok: true, content: html, filename: `export_${ts}.html`, mime: 'text/html' }
  }

  // PDF
  try {
    const b64 = await buildPdf(oeuvres, config, tM, sM, statusLabelMap, imageMap)
    const ts  = new Date().toISOString().slice(0, 10)
    return { ok: true, content: b64, filename: `export_${ts}.pdf`, mime: 'application/pdf' }
  } catch (e) {
    return { error: `PDF : ${String(e)}` }
  }
}

// ── HTML builder ──────────────────────────────────────────────────────────

type Oeuvre = {
  OeuvreID: number; Titre?: string | null; Année?: string | null
  Technique?: number | null; Support?: number | null
  Hauteur?: string | null; Largeur?: string | null; Profondeur?: string | null
  Prix?: number | null; PrixFinal?: number | null; Discount?: number | null
  statusId?: number | null; Exposable?: boolean | null; ['Catalogué']?: boolean | null
  txtImageNameLink?: string | null; Commentaires?: string | null
}

function buildHtml(
  oeuvres:        Oeuvre[],
  cfg:            ExportConfig,
  tM:             Record<number, string>,
  sM:             Record<number, string>,
  statusLabelMap: Record<number, string>,
  imageMap:       Map<number, string>,
): string {
  const f = cfg.fields
  const paperCss = cfg.paper === 'a3' ? '@page{size:A3}' : cfg.paper === 'a4' ? '@page{size:A4}' : ''

  const rows = oeuvres.map((o) => {
    const img     = imageMap.get(o.OeuvreID)
    const dims    = o.Hauteur && o.Largeur ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm` : null
    const tech    = o.Technique != null ? tM[o.Technique] ?? '' : ''
    const supp    = o.Support   != null ? sM[o.Support]   ?? '' : ''
    const status  = o.statusId  != null ? statusLabelMap[o.statusId] ?? '' : ''
    const price   = o.PrixFinal ?? o.Prix

    if (cfg.layout === 'list') {
      return `<tr>
        ${f.id        ? `<td>${o.OeuvreID}</td>` : ''}
        ${f.image     ? `<td>${img ? `<img src="${img}" style="width:48px;height:48px;object-fit:cover">` : ''}</td>` : ''}
        ${f.title     ? `<td class="title">${o.Titre ?? '—'}</td>` : ''}
        ${f.year      ? `<td>${o.Année?.slice(0,4) ?? '—'}</td>` : ''}
        ${f.technique ? `<td>${tech}${supp ? `, ${supp}` : ''}</td>` : ''}
        ${f.dims      ? `<td>${dims ?? '—'}</td>` : ''}
        ${f.price     ? `<td>${price ? `€\u202f${price.toLocaleString('fr-FR')}` : '—'}</td>` : ''}
        ${f.status    ? `<td>${status}</td>` : ''}
      </tr>`
    }

    const imgHtml = (img && f.image)
      ? `<div class="img-wrap${cfg.imageSize === 'large' ? ' large' : ''}${cfg.imageCrop === 'native' ? ' native' : ''}"><img src="${img}" alt="${o.Titre ?? ''}"></div>`
      : (f.image && cfg.imageSize !== 'none' ? `<div class="img-wrap${cfg.imageSize === 'large' ? ' large' : ''}${cfg.imageCrop === 'native' ? ' native' : ''} empty"></div>` : '')

    // Grid: minimal caption — ID then title, tight to image
    if (cfg.layout === 'grid') {
      return '<div class="card">'
        + imgHtml
        + '<div class="meta">'
        + (f.id    ? '<div class="ref-cap">#' + o.OeuvreID + '</div>' : '')
        + (f.title ? '<div class="title-cap">' + (o.Titre ?? '—') + '</div>' : '')
        + '</div></div>'
    }

    // Cards: full metadata table
    const meta = [
      f.id        && `<tr><td class="lbl">Réf.</td><td>#${o.OeuvreID}</td></tr>`,
      f.year      && o.Année && `<tr><td class="lbl">Année</td><td>${o.Année.slice(0,4)}</td></tr>`,
      f.technique && tech    && `<tr><td class="lbl">Technique</td><td>${tech}${supp ? `, ${supp}` : ''}</td></tr>`,
      f.dims      && dims    && `<tr><td class="lbl">Dimensions</td><td>${dims}</td></tr>`,
      f.price     && price   && `<tr><td class="lbl">Prix</td><td>€\u202f${price.toLocaleString('fr-FR')}</td></tr>`,
      f.status    && status  && `<tr><td class="lbl">Statut</td><td>${status}</td></tr>`,
      f.notes     && o.Commentaires && `<tr><td class="lbl" colspan="2" style="padding-top:8px">${o.Commentaires}</td></tr>`,
    ].filter(Boolean).join('\n')

    return `<div class="card">
      ${imgHtml}
      <div class="meta">
        ${f.title ? `<h2>${o.Titre ?? 'Sans titre'}</h2>` : ''}
        ${meta ? `<table>${meta}</table>` : ''}
      </div>
    </div>`
  })

  // ── Compact 3-column index (ID + title only) ──
  const indexItems = oeuvres.map((o) =>
    '<div class="idx-item"><span class="idx-ref">#' + o.OeuvreID + '</span><span class="idx-title">' + (o.Titre ?? '—') + '</span></div>'
  ).join('')

  const indexTable = '<div class="idx-grid">' + indexItems + '</div>'

  // Full list table (standalone layout — all fields)
  const listRows = oeuvres.map((o) => {
    const dims   = o.Hauteur && o.Largeur ? (o.Hauteur + ' × ' + o.Largeur) : '—'
    const tech   = o.Technique != null ? (tM[o.Technique] ?? '') : ''
    const status = o.statusId  != null ? (statusLabelMap[o.statusId] ?? '') : ''
    const price  = o.PrixFinal ?? o.Prix
    return '<tr>'
      + (f.id        ? '<td>#' + o.OeuvreID + '</td>' : '')
      + (f.image     ? '<td>' + (imageMap.get(o.OeuvreID) ? '<img src="' + imageMap.get(o.OeuvreID) + '" style="width:48px;height:48px;object-fit:cover">' : '') + '</td>' : '')
      + (f.title     ? '<td class="title">' + (o.Titre ?? '—') + '</td>' : '')
      + (f.year      ? '<td>' + (o.Année?.slice(0,4) ?? '—') + '</td>' : '')
      + (f.technique ? '<td>' + tech + '</td>' : '')
      + (f.dims      ? '<td>' + dims + '</td>' : '')
      + (f.price     ? '<td>' + (price ? ('€\u202f' + price.toLocaleString('fr-FR')) : '—') + '</td>' : '')
      + (f.status    ? '<td>' + status + '</td>' : '')
      + '</tr>'
  }).join('')

  const listTable = '<table class="list"><thead><tr>'
    + (f.id        ? '<th>Réf.</th>'      : '')
    + (f.image     ? '<th></th>'           : '')
    + (f.title     ? '<th>Titre</th>'      : '')
    + (f.year      ? '<th>Année</th>'      : '')
    + (f.technique ? '<th>Technique</th>'  : '')
    + (f.dims      ? '<th>Dimensions</th>' : '')
    + (f.price     ? '<th>Prix</th>'       : '')
    + (f.status    ? '<th>Statut</th>'     : '')
    + '</tr></thead><tbody>' + listRows + '</tbody></table>'

  // Append-index block (resolved before main template to avoid nesting issues)
  const appendBlock = cfg.appendList
    ? '<div style="margin-top:40px;padding-top:24px;border-top:1px solid #ddd">'
      + '<p style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:16px">Index</p>'
      + indexTable
      + '</div>'
    : ''

  // Cards: wrap N per page so print produces correct page breaks
  const cardsBody = (() => {
    const n = cfg.cardsPerPage ?? 1
    if (n <= 1) return rows.join('') + appendBlock
    const pages: string[] = []
    for (let i = 0; i < rows.length; i += n) {
      pages.push('<div class="pg">' + rows.slice(i, i + n).join('') + '</div>')
    }
    return pages.join('\n') + appendBlock
  })()

  const gridGap = cfg.columns >= 10 ? '8px 12px' : cfg.columns >= 6 ? '16px 24px' : '32px 48px'

  const bodyContent = cfg.layout === 'list'
    ? listTable
    : cfg.layout === 'grid'
      ? `<div class="grid cols-${cfg.columns}" style="gap:${gridGap}">` + rows.join('') + '</div>' + appendBlock
      : cardsBody

  const titleHtml = cfg.exportTitle ? `<h1 style="font-family:'Instrument Serif', serif; font-size:32pt; margin-bottom:40px; border-bottom:1px solid #ddd; padding-bottom:10px;">${cfg.exportTitle}</h1>` : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Export — Pierre Emmanuel Moulin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  ${paperCss}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter', sans-serif;font-size:11px;color:#1a1a1a;background:#fff;padding:40px 80px 80px 80px}
  h1.header{font-size:8px;letter-spacing:4px;text-transform:uppercase;color:#ccc;margin-bottom:12px;text-align:center;font-weight:500}
  
  .header-group{display:flex;flex-direction:column;align-items:center;margin-bottom:60px;text-align:center}
  .header-title{font-family:'Instrument Serif', serif;font-size:36px;color:#111;font-weight:400;letter-spacing:-0.01em;margin:16px 0 12px 0;line-height:1}
  .header-sep{width:1px;height:24px;background:#eee;margin:12px 0}
  .header-meta{font-size:9px;color:#aaa;letter-spacing:1.5px;text-transform:uppercase;font-weight:400}
  /* Page groups for cards-per-page */
  .pg{page-break-after:always;break-after:page}
  .pg:last-child{page-break-after:auto;break-after:auto}
  
  /* Cards */
  .card{display:flex;gap:32px;margin-bottom:48px;padding-bottom:48px;border-bottom:1px solid #f0f0f0;page-break-inside:avoid}
  .card:last-child{border-bottom:none}
  .img-wrap{overflow:hidden;flex-shrink:0;background:#fdfdfd;display:flex;align-items:center;justify-content:center;border:1px solid #f5f5f5}
  .img-wrap.large{flex:0 0 320px;height:320px}
  .img-wrap.empty{opacity:0}
  .img-wrap:not(.large){flex:0 0 160px;height:160px}
  .img-wrap img{max-width:100%;max-height:100%;object-fit:contain;display:block}
  .meta{flex:1}
  .meta h2{font-family:'Instrument Serif', serif;font-size:24px;margin-bottom:16px;font-weight:400;color:#111}
  .meta table{border-collapse:collapse;width:100%}
  .meta td{padding:5px 0;vertical-align:top;color:#444;line-height:1.4}
  .meta td.lbl{color:#bbb;width:100px;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;padding-top:7px;font-weight:500}
  
  /* Grid — contact sheet: tight, consistent, professional */
  .grid{display:grid}
  .grid.cols-2{grid-template-columns:repeat(2,1fr);gap:32px 48px}
  .grid.cols-3{grid-template-columns:repeat(3,1fr);gap:24px 40px}
  .grid.cols-4{grid-template-columns:repeat(4,1fr);gap:16px 32px}
  .grid.cols-6{grid-template-columns:repeat(6,1fr);gap:12px 24px}
  .grid.cols-8{grid-template-columns:repeat(8,1fr);gap:8px 16px}
  .grid.cols-10{grid-template-columns:repeat(10,1fr);gap:6px 12px}
  .grid.cols-12{grid-template-columns:repeat(12,1fr);gap:4px 8px}
  
  .grid .card{flex-direction:column;margin:0;padding:0;border:none;gap:0}
  .grid .card .img-wrap,.grid .card .img-wrap.large{flex:none;width:100%;height:auto;aspect-ratio:1/1;margin-bottom:8px}
  .grid .card .img-wrap img{width:100%;height:100%;object-fit:cover;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.05))}
  .grid .card .img-wrap.native img{object-fit:contain}
  
  .grid .card .meta{padding:0;text-align:left}
  .grid .card .meta .ref-cap{font-size:6px;color:#ccc;font-family:ui-monospace, monospace;letter-spacing:0.5px;margin-bottom:2px}
  .grid .card .meta .title-cap{font-family:'Instrument Serif', serif;font-size:11px;font-weight:400;line-height:1.1;color:#111;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  
  /* Index grid — 3 columns, compact */
  .idx-grid{display:grid;grid-template-columns:repeat(3,1fr);column-gap:24px;row-gap:4px}
  .idx-item{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f5f5f5;overflow:hidden;min-width:0}
  .idx-ref{font-family:ui-monospace, monospace;font-size:8px;color:#ccc;flex-shrink:0;width:42px;padding-top:1px}
  .idx-title{font-size:10px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  
  /* List */
  .list{width:100%;border-collapse:collapse;margin-top:20px}
  .list th{font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:#bbb;padding:10px 16px;border-bottom:1px solid #eee;text-align:left;font-weight:500}
  .list td{padding:12px 16px;border-bottom:1px solid #f8f8f8;vertical-align:middle;color:#444}
  .list td.title{font-family:'Instrument Serif', serif;font-size:15px;color:#111}
  .list tr:hover td{background:#fcfcfc}
  
  /* Print */
  @media print{
    body{padding:0}
    .card{page-break-inside:avoid}
    .grid{page-break-inside:avoid}
  }
</style>
</head>
<body>
  <div class="header-group">
    <h1 class="header" style="margin-bottom:0">Pierre Emmanuel Moulin</h1>
    <div class="header-sep"></div>
    ${cfg.exportTitle ? `<h2 class="header-title">${cfg.exportTitle}</h2>` : ''}
    <p class="header-meta">
      Sélection · ${oeuvres.length} œuvre${oeuvres.length > 1 ? 's' : ''} · ${new Date().toLocaleDateString('fr-FR')}
    </p>
  </div>
  ${bodyContent}
  <div style="margin-top:60px;padding-top:24px;border-top:1px solid #f0f0f0;font-size:8px;color:#ccc;text-align:center;letter-spacing:1px">
    GÉNÉRÉ LE ${new Date().toLocaleDateString('fr-FR').toUpperCase()} · RÉF. ${createHash('md5').update(oeuvres.map(o=>o.OeuvreID).join(',')).digest('hex').slice(0,8).toUpperCase()}
  </div>
</body>
</html>`
}

// ── PDF builder ───────────────────────────────────────────────────────────

async function buildPdf(
  oeuvres:        Oeuvre[],
  cfg:            ExportConfig,
  tM:             Record<number, string>,
  sM:             Record<number, string>,
  statusLabelMap: Record<number, string>,
  imageMap:       Map<number, string>,
): Promise<string> {
  const PDFDocument = (await import('pdfkit')).default

  const pageSize = cfg.paper === 'a3' ? 'A3' : 'A4'

  return new Promise(async (resolve, reject) => {
    const layout = cfg.orientation || 'portrait'
    // Disable automatic page breaks to prevent 'ghosting' from large text blocks
    const doc    = new PDFDocument({ size: pageSize, layout, margin: 50, autoFirstPage: true, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks).toString('base64')))
    doc.on('error', reject)

    const isLandscape = layout === 'landscape'
    const PW_RAW = pageSize === 'A3' ? 841 : 595
    const PH_RAW = pageSize === 'A3' ? 1189 : 842
    
    const PW = isLandscape ? PH_RAW : PW_RAW
    const PH = isLandscape ? PW_RAW : PH_RAW
    const margin = 50
    const usable = PW - margin * 2

    // --- Content Generation ---
    let y = margin + 40 // Initial offset to leave room for the header
    const f = cfg.fields

    if (cfg.layout === 'list') {
      // ── List layout ──────────────────────────────────────────
      const cols: { label: string; w: number }[] = [
        f.id        && { label: 'Réf.',      w: 40  },
        f.title     && { label: 'Titre',     w: 0   }, // flex
        f.year      && { label: 'Année',     w: 40  },
        f.technique && { label: 'Technique', w: 90  },
        f.dims      && { label: 'Dims',      w: 80  },
        f.price     && { label: 'Prix',      w: 60  },
        f.status    && { label: 'Statut',    w: 70  },
      ].filter(Boolean) as { label: string; w: number }[]

      const fixed = cols.reduce((s, c) => s + c.w, 0)
      const flexCol = cols.find((c) => c.w === 0)
      if (flexCol) flexCol.w = usable - fixed

      // Header row
      let x = margin
      doc.fontSize(7).fillColor('#aaaaaa')
      for (const col of cols) {
        doc.text(col.label.toUpperCase(), x, y, { width: col.w, characterSpacing: 0.8 })
        x += col.w
      }
      y += 14
      doc.moveTo(margin, y - 2).lineTo(margin + usable, y - 2).lineWidth(0.3).strokeColor('#cccccc').stroke()

      for (const o of oeuvres) {
        if (y > PH - margin - 40) { doc.addPage(); y = margin + 40 }
        const dims   = o.Hauteur && o.Largeur ? `${o.Hauteur}×${o.Largeur}` : '—'
        const tech   = o.Technique != null ? tM[o.Technique] ?? '' : ''
        const status = o.statusId  != null ? statusLabelMap[o.statusId] ?? '' : ''
        const price  = o.PrixFinal ?? o.Prix
        const vals: string[] = [
          f.id        ? String(o.OeuvreID)    : '',
          f.title     ? (o.Titre ?? '—')      : '',
          f.year      ? (o.Année?.slice(0,4) ?? '—') : '',
          f.technique ? tech                  : '',
          f.dims      ? dims                  : '',
          f.price     ? (price ? `€${price.toLocaleString('fr-FR')}` : '—') : '',
          f.status    ? status                : '',
        ].filter((_, i) => {
          const active = [f.id, f.title, f.year, f.technique, f.dims, f.price, f.status]
          return active[i]
        })

        x = margin
        doc.fontSize(8).fillColor('#333333')
        cols.forEach((col, i) => {
          doc.text(vals[i] ?? '', x, y, { width: col.w - 4, ellipsis: true, lineBreak: false })
          x += col.w
        })
        y += 14
        doc.moveTo(margin, y - 2).lineTo(margin + usable, y - 2).lineWidth(0.2).strokeColor('#eeeeee').stroke()
      }

    } else if (cfg.layout === 'grid') {
      // ── Grid layout (Contact Sheet) ──────────────────────────
      const cols      = cfg.columns
      const gap       = cfg.columns >= 8 ? 4 : cfg.columns >= 4 ? 8 : 12
      const rowGap    = cfg.columns >= 8 ? 12 : cfg.columns >= 4 ? 20 : 28
      const cellW     = (usable - gap * (cols - 1)) / cols
      
      const activeMetaCount = [f.year, f.technique, f.support, f.dims, f.price].filter(Boolean).length
      const textLineH = (cols >= 8 ? 6 : 8)
      const textH     = (f.title ? (cols >= 8 ? 8 : 12) : 0) + (f.id ? (cols >= 8 ? 7 : 10) : 0) + (activeMetaCount * textLineH) + 4
      
      let imgH = cfg.imageSize !== 'none' ? Math.round(cellW) : 0
      if (cfg.rowsPerPage > 0) {
        const calculatedImgH = Math.floor((PH - margin * 2 - 60) / cfg.rowsPerPage) - textH - rowGap
        if (calculatedImgH > 0 && calculatedImgH < imgH) imgH = calculatedImgH
      }
      const cellH = imgH + textH

      let col = 0
      for (const o of oeuvres) {
        const cx = margin + col * (cellW + gap)

        if (col === 0 && (y + cellH > PH - margin - 20)) {
          doc.addPage()
          y = margin + 40
        }

        if (imgH > 0) {
          const imgSrc = imageMap.get(o.OeuvreID)
          if (imgSrc?.startsWith('data:')) {
            const imgBuf = Buffer.from(imgSrc.split(',')[1], 'base64')
            try {
              const processed = await sharp(imgBuf)
                .resize(Math.round(cellW * 2), Math.round(imgH * 2), {
                  fit: cfg.imageCrop === 'native' ? 'inside' : 'cover',
                  background: { r: 255, g: 255, b: 255, alpha: 0 }
                }).toBuffer()
              doc.image(processed, cx, y, { width: cellW, height: imgH, align: 'left', valign: 'top' })
            } catch {}
          }
        }

        let ty = y + imgH + 3
        if (f.id) {
          doc.fontSize(cols >= 8 ? 5 : 6).fillColor('#cccccc').font('Courier').text('#' + o.OeuvreID, cx, ty, { width: cellW, align: 'left', lineBreak: false })
          doc.font('Helvetica')
          ty += (cols >= 8 ? 7 : 8)
        }
        if (f.title) {
          doc.fontSize(cols >= 8 ? 6 : 7.5).fillColor('#111111').font('Helvetica-Bold').text(o.Titre ?? '—', cx, ty, { width: cellW, align: 'left', lineBreak: true, ellipsis: true, maxLines: 1 })
          doc.font('Helvetica')
          ty += (cols >= 8 ? 8 : 10)
        }
        
        doc.fontSize(cols >= 8 ? 5 : 6).fillColor('#666666')
        const metaLines: string[] = []
        if (f.year && o.Année) metaLines.push(o.Année.slice(0, 4))
        const techPart = [f.technique && (o.Technique != null ? tM[o.Technique] : null), f.support && (o.Support != null ? sM[o.Support] : null)].filter(Boolean).join(', ')
        if (techPart) metaLines.push(techPart)
        if (f.dims) {
          const d = o.Hauteur && o.Largeur ? `${o.Hauteur}×${o.Largeur} cm` : null
          if (d) metaLines.push(d)
        }
        if (f.price) {
          const p = o.PrixFinal ?? o.Prix
          if (p) metaLines.push(`€${p.toLocaleString('fr-FR')}`)
        }

        for (const line of metaLines) {
          doc.text(line, cx, ty, { width: cellW, align: 'left', lineBreak: false, ellipsis: true })
          ty += (cols >= 8 ? 6 : 8)
        }

        col++
        if (col >= cols) {
          col = 0
          y += cellH + rowGap
          doc.y = y
        }
      }
      if (col > 0) { y += cellH + gap; doc.y = y }

    } else {
      // ── Cards layout ─────────────────────────────────────────
      const imgW       = cfg.imageSize === 'large' ? 200 : cfg.imageSize === 'small' ? 120 : 0
      const imgH       = imgW
      const perPage    = cfg.cardsPerPage ?? 1
      let   cardCount  = 0

      for (const o of oeuvres) {
        // Robust card height estimation for page break
        const estH = Math.max(imgH, 100) + 40
        if ((cardCount > 0 && cardCount % perPage === 0) || (y + estH > PH - margin - 20)) {
          doc.addPage(); y = margin + 40; cardCount = 0
        }

        const dims   = o.Hauteur && o.Largeur ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm` : null
        const tech   = o.Technique != null ? tM[o.Technique] ?? '' : ''
        const supp   = o.Support   != null ? sM[o.Support]   ?? '' : ''
        const status = o.statusId  != null ? statusLabelMap[o.statusId] ?? '' : ''
        const price  = o.PrixFinal ?? o.Prix

        if (imgW > 0) {
          const imgSrc = imageMap.get(o.OeuvreID)
          if (imgSrc?.startsWith('data:')) {
            try {
              const imgBuf = Buffer.from(imgSrc.split(',')[1], 'base64')
              doc.image(imgBuf, margin, y, { cover: [imgW, imgH], align: 'center', valign: 'center' })
            } catch {}
          }
        }

        const tx = margin + (imgW > 0 ? imgW + 16 : 0)
        const tw = usable - (imgW > 0 ? imgW + 16 : 0)
        let   ty = y

        if (f.title) { doc.fontSize(14).fillColor('#1a1a1a').text(o.Titre ?? 'Sans titre', tx, ty, { width: tw }); ty += 20 }
        if (f.year && o.Année) { doc.fontSize(9).fillColor('#666666').text(o.Année.slice(0, 4), tx, ty, { width: tw }); ty += 13 }
        if (f.technique && tech) { doc.fontSize(8).fillColor('#888888').text(tech + (supp ? `, ${supp}` : ''), tx, ty, { width: tw }); ty += 12 }
        if (f.dims && dims) { doc.fontSize(8).fillColor('#888888').text(dims, tx, ty, { width: tw }); ty += 12 }
        if (f.price && price) { doc.fontSize(9).fillColor('#444444').text(`€\u202f${price.toLocaleString('fr-FR')}`, tx, ty, { width: tw }); ty += 12 }
        if (f.status && status) { doc.fontSize(8).fillColor('#888888').text(status, tx, ty, { width: tw }); ty += 12 }
        if (f.id) { doc.fontSize(7).fillColor('#cccccc').text(`#${o.OeuvreID}`, tx, ty, { width: tw }); ty += 10 }

        const actualCardH = Math.max(ty - y, imgH) + 24
        y += actualCardH
        doc.moveTo(margin, y - 12).lineTo(margin + usable, y - 12).lineWidth(0.3).strokeColor('#eeeeee').stroke()
        cardCount++
      }
    }

    // ── Append index ─────────────────────
    if (cfg.appendList && cfg.layout !== 'list') {
      y += 20
      if (y > PH - margin - 80) { doc.addPage(); y = margin + 40 }
      doc.moveTo(margin, y).lineTo(margin + usable, y).lineWidth(0.3).strokeColor('#dddddd').stroke()
      y += 14
      doc.fontSize(7).fillColor('#aaaaaa').font('Helvetica').text('INDEX', margin, y, { characterSpacing: 2 })
      y += 16
      const idxCols = 3, colW = Math.floor(usable / idxCols), idxRefW = 36, idxTitW = colW - idxRefW - 6
      let idxCol = 0
      for (const o of oeuvres) {
        if (y > PH - margin - 20 && idxCol === 0) { doc.addPage(); y = margin + 40 }
        const ix = margin + idxCol * colW
        doc.fontSize(7).fillColor('#bbbbbb').font('Courier').text('#' + o.OeuvreID, ix, y, { width: idxRefW, lineBreak: false })
        doc.fontSize(7).fillColor('#333333').font('Helvetica').text(o.Titre ?? '—', ix + idxRefW + 4, y, { width: idxTitW, lineBreak: false, ellipsis: true })
        idxCol++
        if (idxCol >= idxCols) {
          idxCol = 0; y += 10
          doc.moveTo(margin, y - 1).lineTo(margin + usable, y - 1).lineWidth(0.2).strokeColor('#f0f0f0').stroke()
        }
      }
    }

    // --- Global Headers & Footers (on all pages) ---
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      
      // Header
      doc.fontSize(6).fillColor('#bbbbbb').text('PIERRE EMMANUEL MOULIN', margin, margin - 10, { characterSpacing: 1.5 })
      let headY = margin - 2
      if (cfg.exportTitle) {
        doc.fontSize(16).fillColor('#111111').text(cfg.exportTitle, margin, headY, { lineGap: -4 })
        headY += 20
        doc.fontSize(6.5).fillColor('#aaaaaa').text(`SÉLECTION · ${oeuvres.length} ŒUVRES · PAGE ${i + 1} / ${pages.count}`, margin, headY, { characterSpacing: 0.8 })
      } else {
        doc.fontSize(8).fillColor('#111111').text(`SÉLECTION · ${oeuvres.length} ŒUVRES · PAGE ${i + 1} / ${pages.count}`, margin, headY, { characterSpacing: 0.8 })
      }
      doc.moveTo(margin, headY + 10).lineTo(margin + 40, headY + 10).lineWidth(0.5).strokeColor('#eeeeee').stroke()

      doc.fontSize(6).fillColor('#ccc')
         .text(`GÉNÉRÉ LE ${new Date().toLocaleDateString('fr-FR').toUpperCase()} · PIERREEMMANUELMOULIN.COM`, margin, PH - margin, { align: 'center', width: usable, characterSpacing: 1, lineBreak: false })
    }

    doc.end()
  })
}
