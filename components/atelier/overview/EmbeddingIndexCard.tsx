'use client'

// Overview "Local jobs" (admin). The Run link opens `pem-embed:run`, a URL protocol that
// scripts/register-embed-protocol.ps1 maps to scripts/embed-run.ps1 on the owner's PC:
// voice notes -> transcripts, then search indexing (local GPU, one after the other).
// On any other machine the link does nothing; on a phone only the counts show.
// Since the one-glance dashboard (B1, 2026-11-13) the counts feed a signal cell, so they live in
// a hook (`useLocalJobs`) and the panel only renders the Run / Copy controls.

import { useCallback, useEffect, useRef, useState } from 'react'
import { countEmbeddingBacklog, countVoiceTranscriptBacklog, getLastArchiveRun } from '@/app/atelier/embedding-status-actions'

const PROTOCOL_HREF = 'pem-embed:run'
const WORKER_COMMAND = 'pwsh scripts/embed-run.ps1'
const POLL_MS = 5_000
const POLL_MAX_MS = 10 * 60_000
/** Owner 2026-11-13: remind when the PC archive copy is older than this. */
export const ARCHIVE_STALE_DAYS = 14

export type LocalJobs = {
  voice: number | null
  index: number | null
  /** undefined = loading · null = never archived · n = days since the last PC archive */
  archiveDays: number | null | undefined
  archiveStale: boolean
  polling: boolean
  startPolling: () => void
}

/** Counts behind the Local jobs signal; `enabled` = admin (others never fetch). */
export function useLocalJobs(enabled: boolean): LocalJobs {
  const [counts, setCounts] = useState<{ voice: number | null; index: number | null }>({ voice: null, index: null })
  const [archiveDays, setArchiveDays] = useState<number | null | undefined>(undefined)
  const [polling, setPolling] = useState(false)
  const pollStart = useRef(0)

  const refresh = useCallback(async () => {
    const [voice, index] = await Promise.all([countVoiceTranscriptBacklog(), countEmbeddingBacklog()])
    const next = { voice, index }
    setCounts(next)
    return next
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    // PC archive age (`npm run archive` stamps each run; the site cannot read the PC itself).
    void getLastArchiveRun().then((r) => {
      if (!r) return
      setArchiveDays(r.at ? Math.floor((Date.now() - new Date(r.at).getTime()) / 86_400_000) : null)
    })
  }, [enabled, refresh])

  // After "Run", poll until both queues are empty or the window runs out.
  useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      const n = await refresh()
      const empty = (n.voice ?? 0) === 0 && (n.index ?? 0) === 0
      if (empty || Date.now() - pollStart.current > POLL_MAX_MS) setPolling(false)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [polling, refresh])

  const archiveStale = archiveDays === null || (archiveDays != null && archiveDays > ARCHIVE_STALE_DAYS)
  const startPolling = useCallback(() => { pollStart.current = Date.now(); setPolling(true) }, [])
  return { ...counts, archiveDays, archiveStale, polling, startPolling }
}

/** Run on this PC + copy the command (desktop only). */
export function LocalJobsControls({ jobs, t }: { jobs: LocalJobs; t: (k: string) => string }) {
  const [copied, setCopied] = useState(false)
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(WORKER_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- clipboard refusal is expected; the command stays in the tooltip
    } catch {
      // Clipboard blocked (permissions) — the command stays visible in the title tooltip.
      setCopied(false)
    }
  }
  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px', alignItems: 'center' }} title={t('ov_jobs_hint')}>
      <a
        href={PROTOCOL_HREF}
        className="btn primary sm"
        style={{ minHeight: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}
        onClick={jobs.startPolling}
        data-testid="overview-embedding-run"
      >
        {jobs.polling ? t('ov_jobs_running') : t('ov_jobs_run')}
      </a>
      <button type="button" className="btn ghost sm" style={{ minHeight: 26 }} title={WORKER_COMMAND} onClick={() => void copyCommand()}>
        {copied ? t('ov_index_copied') : t('ov_index_copy')}
      </button>
    </div>
  )
}
