'use client'

// « Bureau IA », phase 1 (Pem « go for ai build », 2026-11-18; docs/design/2026-11-18/AiDesk.notes.md):
// engines as this server sees them + what waits for the studio PC's local jobs + the command for each queue.
// Phase 2: « Lancer » queues an `ai_job` row (queueAiJob); the PC agent (scripts/ai-agent) runs it. Commands stay as « by hand ».

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { surfaceError } from '@/lib/error-reporter/client'
import { loadAiDesk, queueAiJob, type AiDeskData, type AiRunKind } from '../actions'

/** Same scripts as the Overview « Local jobs » card (the `pem-embed:` protocol runs embed-run.ps1). */
const CMD_VOICE_INDEX = 'pwsh scripts/embed-run.ps1'
const CMD_DESCRIBE = 'pwsh scripts/describe-run.ps1'
const PROTOCOL_HREF = 'pem-embed:run'

function Dot({ on }: { on: boolean }) {
  return <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', background: on ? 'var(--sage)' : 'var(--tx3)', opacity: on ? 1 : 0.5 }} />
}

function Row({ on, label, value }: { on: boolean; label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--bd)', minHeight: 44, flexWrap: 'wrap' }}>
      <Dot on={on} />
      <span style={{ flex: '1 1 220px', color: 'var(--tx)' }}>{label}</span>
      <span style={{ color: 'var(--tx2)', fontSize: 13 }}>{value}</span>
    </div>
  )
}

function Command({ cmd, withLink }: { cmd: string; withLink?: boolean }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- clipboard refusal is expected; the command stays on screen
    } catch {
      setCopied(false)
    }
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0 0 19px' }}>
      <code style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg1)', border: '1px solid var(--bd)', overflowWrap: 'anywhere' }}>{cmd}</code>
      <button type="button" className="btn ghost sm" style={{ minHeight: 36 }} onClick={() => void copy()}>
        {copied ? t('ai_copied') : t('ai_copy')}
      </button>
      {withLink ? (
        <a href={PROTOCOL_HREF} className="btn ghost sm" style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          {t('ai_run_link')}
        </a>
      ) : null}
    </div>
  )
}

function RunButton({ kind, jobs, onDone }: { kind: AiRunKind; jobs: AiDeskData['jobs']; onDone: () => void }) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState(false)
  const active = jobs.find((j) => j.kind === kind && (j.status === 'waiting' || j.status === 'running'))
  const click = async () => {
    setPending(true)
    setErr(false)
    try {
      const res = await queueAiJob(kind)
      if ('error' in res && res.error !== 'already') setErr(true)
      else onDone()
    } catch (e) {
      surfaceError(String(e), e, { source: 'ai-desk.queue' })
      setErr(true)
    } finally {
      setPending(false)
    }
  }
  const label = active ? (active.status === 'running' ? t('ai_job_running') : t('ai_job_waiting')) : t('ai_run')
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0 0 19px' }}>
      <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={pending || !!active} onClick={() => void click()}>
        {label}
      </button>
      {err ? <span style={{ color: 'var(--rust)', fontSize: 13 }}>{t('ai_run_failed')}</span> : null}
    </div>
  )
}

function ByHand({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <details style={{ margin: '6px 0 0 19px' }}>
      <summary style={{ fontSize: 12, color: 'var(--tx3)', cursor: 'pointer', minHeight: 32 }}>{t('ai_by_hand')}</summary>
      {children}
    </details>
  )
}

export function AiDesk({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<AiDeskData | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBusy(true)
    setFailed(false)
    try {
      const res = await loadAiDesk()
      if ('error' in res) setFailed(true)
      else setData(res)
    } catch (e) {
      surfaceError(String(e), e, { source: 'ai-desk.load' })
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void refresh()
  }, [isAdmin, refresh])

  const hasActiveJob = !!data?.jobs.some((j) => j.status === 'waiting' || j.status === 'running')
  useEffect(() => {
    if (!isAdmin || !hasActiveJob) return
    const id = setInterval(() => void refresh(), 10000)
    return () => clearInterval(id)
  }, [isAdmin, hasActiveJob, refresh])

  if (!isAdmin) return <p style={{ padding: 24, color: 'var(--tx3)' }}>{t('ai_admin_only')}</p>

  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const n = (v: number | null | undefined) => (data === null ? '…' : v == null ? '—' : v.toLocaleString(loc))
  const agent = data?.agent ?? null
  const agentMin = agent ? Math.max(0, Math.floor((Date.now() - new Date(agent.seenAt).getTime()) / 60000)) : 0
  const agentFresh = agent != null && Date.now() - new Date(agent.seenAt).getTime() < 3 * 60000
  const jobs = data?.jobs ?? []
  const kindLabel = (k: string) =>
    k === 'voice' ? t('ai_kind_voice') : k === 'embed' ? t('ai_kind_embed') : k === 'describe' ? t('ai_kind_describe') : k
  const statusLabel = (s: string) =>
    s === 'waiting' ? t('ai_job_waiting') : s === 'running' ? t('ai_job_running') : s === 'done' ? t('ai_job_done') : t('ai_job_failed')
  const ollamaOk = data?.ollama != null
  const textEngine = (m: AiDeskData['cardText']) =>
    m === 'openai' ? t('ai_engine_openai') : m === 'ollama' ? (ollamaOk ? t('ai_engine_ollama_ok') : t('ai_engine_ollama_out')) : t('ai_engine_none')
  const date = (d: string) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')
  const q = data?.queues

  return (
    <div data-testid="ai-desk" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'clamp(16px, 3vw, 32px)' }}>
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="serif" style={{ fontSize: 32, fontWeight: 400, margin: 0, flex: 1, color: 'var(--tx)' }}>{t('ai_tab')}</h1>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => void refresh()}>
            {t('ai_refresh')}
          </button>
        </div>
        <p style={{ color: 'var(--tx2)', fontSize: 14, margin: '6px 0 20px' }}>{t('ai_intro')}</p>
        {failed ? <p style={{ color: 'var(--rust)' }}>{t('ai_load_error')}</p> : null}

        <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>
          {t('ai_engines')}
          {data ? ` · ${data.server === 'live' ? t('ai_server_live') : t('ai_server_pc')}` : ''}
        </div>
        {data ? (
          <div data-testid="ai-desk-engines">
            <Row
              on={agentFresh}
              label={t('ai_agent')}
              value={
                agent
                  ? t('ai_agent_seen').replace('{n}', String(agentMin)) +
                    (agentFresh ? ' · ' + agent.models.map((m) => `${m.name} ${m.present ? t('ai_model_present') : t('ai_model_missing')}`).join(' · ') : '')
                  : t('ai_agent_never')
              }
            />
            {!agentFresh ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '6px 0 0 19px' }}>{t('ai_agent_start')}</p>
                <Command cmd="npm run ai:agent" />
              </>
            ) : null}
            <Row on={data.openaiKey} label={t('ai_openai_key')} value={data.openaiKey ? t('ai_yes') : t('ai_no')} />
            <Row on={data.cardPhoto !== 'none'} label={t('ai_card_photo')} value={data.cardPhoto === 'openai' ? t('ai_engine_openai') : t('ai_engine_none')} />
            <Row on={data.cardText === 'openai' || (data.cardText === 'ollama' && ollamaOk)} label={t('ai_card_text')} value={textEngine(data.cardText)} />
            <Row
              on={ollamaOk}
              label={t('ai_ollama')}
              value={
                data.ollama
                  ? data.ollama.map((m) => `${m.model} ${m.present ? t('ai_model_present') : t('ai_model_missing')}`).join(' · ')
                  : t('ai_no')
              }
            />
            {!ollamaOk ? (
              <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '6px 0 0 19px' }}>{data.server === 'live' ? t('ai_ollama_out_live') : t('ai_ollama_out_pc')}</p>
            ) : null}
          </div>
        ) : (
          <p style={{ color: 'var(--tx3)' }}>…</p>
        )}

        <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginTop: 28 }}>{t('ai_waiting')}</div>
        <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('ai_run_intro')}</p>
        <div data-testid="ai-desk-queues">
          <Row on={(q?.voice ?? 0) === 0} label={t('ai_q_voice')} value={<b>{n(q?.voice)}</b>} />
          <RunButton kind="voice" jobs={jobs} onDone={() => void refresh()} />
          <ByHand><Command cmd={CMD_VOICE_INDEX} withLink /></ByHand>
          <Row on={(q?.index ?? 0) === 0} label={t('ai_q_index')} value={<b>{n(q?.index)}</b>} />
          <RunButton kind="embed" jobs={jobs} onDone={() => void refresh()} />
          <ByHand><Command cmd="npm run embed:worker -- --drain" /></ByHand>
          <Row on={(q?.describe ?? 0) === 0} label={t('ai_q_describe')} value={<b>{n(q?.describe)}</b>} />
          <RunButton kind="describe" jobs={jobs} onDone={() => void refresh()} />
          <ByHand><Command cmd={CMD_DESCRIBE} /></ByHand>
          <Row
            on={false}
            label={t('ai_q_cards')}
            value={
              <>
                <b>{n(q?.cards?.count)}</b>
                {q?.cards?.latest ? <span style={{ marginLeft: 8 }}>{t('ai_latest').replace('{d}', date(q.cards.latest))}</span> : null}
              </>
            }
          />
          <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '6px 0 0 19px' }}>{t('ai_q_cards_note')}</p>
        </div>

        <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginTop: 28 }}>{t('ai_jobs')}</div>
        {data && jobs.length === 0 ? <p style={{ color: 'var(--tx3)', fontSize: 13 }}>{t('ai_jobs_none')}</p> : null}
        <div data-testid="ai-desk-jobs">
          {jobs.map((j) => (
            <div key={j.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--bd)', minHeight: 44 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: '1 1 200px', color: 'var(--tx)' }}>{kindLabel(j.kind)}</span>
                <span style={{ color: j.status === 'failed' ? 'var(--rust)' : 'var(--tx2)', fontSize: 13 }}>{statusLabel(j.status)}</span>
                <span style={{ color: 'var(--tx3)', fontSize: 13 }}>{new Date(j.createdAt).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              {j.status === 'failed' && j.log ? (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' }}>{t('ai_job_log')}</summary>
                  <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto', margin: '4px 0 0' }}>{j.log}</pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>

        <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginTop: 28 }}>{t('ai_next')}</div>
        <p style={{ fontSize: 14, color: 'var(--tx2)', margin: '4px 0 0' }}>{t('ai_next_text')}</p>
      </div>
    </div>
  )
}
