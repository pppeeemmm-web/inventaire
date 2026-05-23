import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rowToCsv } from '@/lib/export/csv'
import {
  resolveGraphCsvView,
  rowToCsvCells,
  type AnyGraphCsvConfig,
} from '@/lib/export/graph-csv-views'

const PAGE_SIZE = 500

async function requireAdminExport() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase: null }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { ok: false as const, status: 403, supabase: null }
  return { ok: true as const, status: 200, supabase }
}

async function fetchCsvPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  config: AnyGraphCsvConfig,
  from: number,
): Promise<Record<string, unknown>[]> {
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from(config.table as 'entity')
    .select(config.select)
    .order(config.view === 'entity' ? 'node_type' : 'edge_id', { ascending: true })
    .range(from, to)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Record<string, unknown>[]
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminExport()
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })
  }

  const viewParam = req.nextUrl.searchParams.get('view')
  const config = resolveGraphCsvView(viewParam)
  if (!config) {
    return NextResponse.json(
      { error: 'Missing or invalid view query (use entity or edge_fact)' },
      { status: 400 },
    )
  }

  const ts = new Date().toISOString().slice(0, 10)
  const filename = `pem_${config.view}_${ts}.csv`
  const encoder = new TextEncoder()
  const headers = config.columns.map((c) => c.header)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('\uFEFF'))
        controller.enqueue(encoder.encode(`${rowToCsv(headers)}\r\n`))

        let offset = 0
        for (;;) {
          const page = await fetchCsvPage(auth.supabase!, config, offset)
          if (page.length === 0) break
          for (const row of page) {
            const line = rowToCsv(rowToCsvCells(row, config.columns))
            controller.enqueue(encoder.encode(`${line}\r\n`))
          }
          if (page.length < PAGE_SIZE) break
          offset += PAGE_SIZE
        }

        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
