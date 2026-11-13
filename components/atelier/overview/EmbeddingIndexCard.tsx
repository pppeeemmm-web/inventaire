'use client'

// Overview "Local jobs" card (admin). The button opens `pem-embed:run`, a URL protocol that
// scripts/register-embed-protocol.ps1 maps to scripts/embed-run.ps1 on the owner's PC:
// voice notes -> transcripts, then search indexing (local GPU, one after the other).
// On any other machine the link does nothing; on a phone the card only shows what is waiting.

import { useCallback, useEffect, useRef, useState } from 'react'
import { countEmbeddingBacklog, countVoiceTranscriptBacklog } from '@/app/atelier/embedding-status-actions'
import { interpolateMessage } from '@/lib/i18n/message-core'

const PROTOCOL_HREF = 'pem-embed:run'
const WORKER_COMMAND = 'pwsh scripts/embed-run.ps1'
const POLL_MS = 5_000
const POLL_MAX_MS = 10 * 60_000

type Counts = { voice: number | null; index: number | null }

export function EmbeddingIndexCard({ t, narrow = false }: { t: (k: string) => string; narrow?: boolean }) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [polling, setPolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollStart = useRef(0)

  const refresh = useCallback(async () => {
    const [voice, index] = await Promise.all([countVoiceTranscriptBacklog(), countEmbeddingBacklog()])
    const next = { voice, index }
    setCounts(next)
    return next
  }, [])

  useEffect(() => { void refresh() }, [refresh])

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

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(WORKER_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (permissions) — the command stays visible in the title tooltip.
      setCopied(false)
    }
  }

  const line = (n: number | null | undefined, pendingKey: string, clearKey: string) =>
    n == null ? '…' : n === 0 ? t(clearKey) : interpolateMessage(t(pendingKey), { n })

  return (
    <div style={{ padding: 16, background: 'var(--bg1)', border: '1px solid var(--bd)' }} data-testid="overview-embedding-index">
      <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 4, color: 'var(--tx3)' }}>{t('ov_jobs_title')}</div>
      <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 2 }} data-testid="overview-jobs-voice">
        {line(counts?.voice, 'ov_jobs_voice_pending', 'ov_jobs_voice_clear')}
      </div>
      <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 10 }}>
        {line(counts?.index, 'ov_index_pending', 'ov_index_clear')}
      </div>
      {narrow ? (
        <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', lineHeight: 1.4 }}>{t('ov_jobs_phone_hint')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={PROTOCOL_HREF}
              className="btn primary sm"
              style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}
              onClick={() => { pollStart.current = Date.now(); setPolling(true) }}
              data-testid="overview-embedding-run"
            >
              {polling ? t('ov_jobs_running') : t('ov_jobs_run')}
            </a>
            <button
              type="button"
              className="btn ghost sm"
              style={{ minHeight: 44 }}
              title={WORKER_COMMAND}
              onClick={() => void copyCommand()}
            >
              {copied ? t('ov_index_copied') : t('ov_index_copy')}
            </button>
          </div>
          <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 8, lineHeight: 1.4 }}>{t('ov_jobs_hint')}</div>
        </>
      )}
    </div>
  )
}
