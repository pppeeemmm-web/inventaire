import { PassThrough, Readable } from 'node:stream'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  dedupeZipEntryNames,
  WORK_IMAGE_ZIP_MAX_IDS,
  type WorkImageZipEntry,
} from '@/lib/export/work-image-zip'
import { createZipArchive, finalizeZipArchive } from '@/lib/export/zip-archive'
import { r2GetObjectBuffer } from '@/lib/r2-s3-object-get'

export const runtime = 'nodejs'
export const maxDuration = 120

type Body = {
  ids?: unknown
  mode?: unknown
}

async function requireTeamExport() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { ok: false as const, status: 403, supabase: null }
  return { ok: true as const, status: 200, supabase }
}

function parseIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null
  const ids = raw
    .map((v) => (typeof v === 'number' ? v : parseInt(String(v), 10)))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return null
  return [...new Set(ids)]
}

async function resolveZipEntries(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ids: number[],
  mode: 'cover' | 'all',
): Promise<WorkImageZipEntry[]> {
  const { data: works, error: workErr } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, txtImageNameLink')
    .in('OeuvreID', ids)
    .is('deleted_at', null)

  if (workErr) throw new Error(workErr.message)

  const titreById = new Map<number, string | null>()
  for (const w of works ?? []) {
    titreById.set(w.OeuvreID as number, (w.Titre as string | null) ?? null)
  }

  if (mode === 'cover') {
    return (works ?? [])
      .filter((w) => typeof w.txtImageNameLink === 'string' && w.txtImageNameLink.trim())
      .map((w) => ({
        oeuvreId: w.OeuvreID as number,
        titre: titreById.get(w.OeuvreID as number) ?? null,
        storageKey: (w.txtImageNameLink as string).trim(),
      }))
  }

  const { data: images, error: imgErr } = await supabase
    .from('tblImage')
    .select('OeuvreID, txtImageNameLink, SeqNo')
    .in('OeuvreID', ids)
    .order('SeqNo', { ascending: true })

  if (imgErr) throw new Error(imgErr.message)

  return (images ?? [])
    .filter((row) => typeof row.txtImageNameLink === 'string' && row.txtImageNameLink.trim())
    .map((row) => ({
      oeuvreId: row.OeuvreID as number,
      titre: titreById.get(row.OeuvreID as number) ?? null,
      storageKey: (row.txtImageNameLink as string).trim(),
      seqNo: (row.SeqNo as number | null) ?? null,
    }))
}

export async function POST(req: NextRequest) {
  const auth = await requireTeamExport()
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = parseIds(body.ids)
  if (!ids) {
    return NextResponse.json({ error: 'ids must be a non-empty array of oeuvre IDs' }, { status: 400 })
  }
  if (ids.length > WORK_IMAGE_ZIP_MAX_IDS) {
    return NextResponse.json(
      { error: `Too many works (max ${WORK_IMAGE_ZIP_MAX_IDS}). Split the selection.` },
      { status: 400 },
    )
  }

  const mode = body.mode === 'all' ? 'all' : 'cover'

  let entries: WorkImageZipEntry[]
  try {
    entries = await resolveZipEntries(auth.supabase, ids, mode)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No images found for this selection' }, { status: 404 })
  }

  const manifestLines = [
    `PEM work images export`,
    `mode=${mode}`,
    `requested_works=${ids.length}`,
    `files=${entries.length}`,
    '',
  ]

  let archive: Awaited<ReturnType<typeof createZipArchive>>
  try {
    archive = await createZipArchive()
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const passThrough = new PassThrough()
  archive.pipe(passThrough)

  const packed = dedupeZipEntryNames(entries)

  void (async () => {
    let added = 0
    const missing: string[] = []
    try {
      for (const { entry, name } of packed) {
        const buf = await r2GetObjectBuffer(entry.storageKey)
        if (!buf?.length) {
          missing.push(`${name} ← ${entry.storageKey}`)
          continue
        }
        archive.append(buf, { name })
        added += 1
      }
      if (missing.length > 0) {
        manifestLines.push('Missing from R2:', ...missing, '')
      }
      manifestLines.push('', 'zip_name\toeuvre_id\ttitle', ...packed.map(({ entry, name }) => {
        const title = (entry.titre ?? '').replace(/\t/g, ' ')
        return `${name}\t${entry.oeuvreId}\t${title}`
      }))
      manifestLines.push('', `packed_files=${added}`)
      archive.append(manifestLines.join('\n'), { name: '_manifest.txt' })
      await finalizeZipArchive(archive, passThrough)
    } catch (err) {
      archive.abort()
      passThrough.destroy(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  const webStream = Readable.toWeb(passThrough) as ReadableStream<Uint8Array>
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `pem-works-images-${stamp}-${ids.length}.zip`

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Pem-Image-Count': String(entries.length),
    },
  })
}
