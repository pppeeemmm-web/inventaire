'use client'

// Overview indexing card (admin). The button opens `pem-embed:run`, a URL protocol that
// scripts/register-embed-protocol.ps1 maps to scripts/embed-run.ps1 on the owner's PC
// (local Ollama). On any other machine the link does nothing.

import { useCallback, useEffect, useRef, useState } from 'react'
import { countEmbeddingBacklog } from '@/app/atelier/embedding-status-actions'
import { interpolateMessage } from '@/lib/i18n/message-core'

const PROTOCOL_HREF = 'pem-embed:run'
const WORKER_COMMAND = 'npm run embed:worker -- --drain'
const POLL_MS = 5_000
const POLL_MAX_MS = 5 * 60_000

export function EmbeddingIndexCard({ t }: { t: (k: string) => string }) {
  const [count, setCount] = useState<number | null>(null)
  const [polling, setPolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollStart = useRef(0)

  const refresh = useCallback(async () => {
    const n = await countEmbeddingBacklog()
    setCount(n)
    return n
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // After "Run", poll until the backlog is empty or the window runs out.
  useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      const n = await refresh()
      if (n === 0 || Date.now() - pollStart.current > POLL_MAX_MS) setPolling(false)
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

  return (
    <div style={{ padding: 16, background: 'var(--bg1)', border: '1px solid var(--bd)' }} data-testid="overview-embedding-index">
      <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 4, color: 'var(--tx3)' }}>{t('ov_index_title')}</div>
      <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 10 }}>
        {count == null
          ? '…'
          : count === 0
            ? t('ov_index_clear')
            : interpolateMessage(t('ov_index_pending'), { n: count })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={PROTOCOL_HREF}
          className="btn primary sm"
          style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto' }}
          onClick={() => { pollStart.current = Date.now(); setPolling(true) }}
          data-testid="overview-embedding-run"
        >
          {polling ? t('ov_index_running') : t('ov_index_run')}
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
      <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 8, lineHeight: 1.4 }}>{t('ov_index_hint')}</div>
    </div>
  )
}
