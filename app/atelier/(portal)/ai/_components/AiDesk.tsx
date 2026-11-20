'use client'

// « Bureau IA », phase 1 (Pem « go for ai build », 2026-11-18; docs/design/2026-11-18/AiDesk.notes.md):
// engines as this server sees them + what waits for the studio PC's local jobs + the command for each queue.
// Phase 2: « Lancer » queues an `ai_job` row (queueAiJob); the PC agent (scripts/ai-agent) runs it. Commands stay as « by hand ».

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { surfaceError } from '@/lib/error-reporter/client'
import { decideAiJob, loadAiDesk, queueAiJob, type AiDeskData, type AiRunKind, type CardReview } from '../actions'

/** Same scripts as the Overview « Local jobs » card (the `pem-embed:` protocol runs embed-run.ps1). */
const CMD_VOICE_INDEX = 'pwsh scripts/embed-run.ps1'
const CMD_DESCRIBE = 'pwsh scripts/describe-run.ps1'
const PROTOCOL_HREF = 'pem-embed:run'
/** Starts ONE pass of the PC agent on this PC (scripts/register-ai-agent.ps1 registers it): it runs what waits, then stops. */
const AGENT_HREF = 'pem-ai:run'

/** On the PC (not a phone): open the pem-ai: link, which starts the agent for one pass. Chrome asks the first time. */
function startAgentHere() {
  // A hidden frame opens the link: changing the page's own address left it « loading » and could drop the save.
  const f = document.createElement('iframe')
  f.style.display = 'none'
  f.src = AGENT_HREF
  document.body.appendChild(f)
  window.setTimeout(() => f.remove(), 5000)
}

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

function RunButton({ kind, jobs, onDone, onPc }: { kind: AiRunKind; jobs: AiDeskData['jobs']; onDone: () => void; onPc: boolean }) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState(false)
  const active = jobs.find((j) => j.kind === kind && (j.status === 'waiting' || j.status === 'running'))
  const click = async () => {
    setPending(true)
    setErr(false)
    // On the PC the agent is started right away, while the browser still counts this as the click (after an await
    // Chrome may drop the pem-ai: link silently); the agent waits a few seconds for the job below to land.
    // On a phone the job waits for the next pass on the PC.
    if (onPc) startAgentHere()
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
  const label = active ? (active.status === 'running' ? t('ai_job_running') : t('ai_job_waiting')) : t('ai_plain_run')
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={pending || !!active} onClick={() => void click()}>
        {label}
      </button>
      {err ? <span style={{ color: 'var(--rust)', fontSize: 13 }}>{t('ai_run_failed')}</span> : null}
    </div>
  )
}

/**
 * Phase 3: business cards the PC read, one block each — what it would add to the contact, the card's text as read,
 * « Ouvrir et vérifier » (contact editor pre-filled; accepted when Pem saves there) or « Rejeter ».
 */
function CardReviews({ items, onDone }: { items: CardReview[]; onDone: () => void }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<number | null>(null)
  const [err, setErr] = useState<number | null>(null)
  const labels: Record<CardReview['changes'][number]['field'], string> = {
    prenom: t('ai_card_f_prenom'),
    nom: t('ai_card_f_nom'),
    institution: t('ai_card_f_institution'),
    email: t('ai_card_f_email'),
    phone: t('ai_card_f_phone'),
    website: t('ai_card_f_website'),
    address: t('ai_card_f_address'),
  }
  const fieldLabel = (f: CardReview['changes'][number]['field']) => labels[f]
  const reject = async (jobId: number) => {
    setPending(jobId)
    setErr(null)
    try {
      const res = await decideAiJob(jobId, 'rejected')
      if ('error' in res && res.error !== 'gone') setErr(jobId)
      else onDone()
    } catch (e) {
      surfaceError(String(e), e, { source: 'ai-desk.card-reject' })
      setErr(jobId)
    } finally {
      setPending(null)
    }
  }
  return (
    <div data-testid="ai-desk-cards" style={{ marginTop: 20 }}>
      <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>{t('ai_cards_review').replace('{n}', String(items.length))}</div>
      {items.map((c) => (
        <div key={c.jobId} data-testid="ai-desk-card" style={{ padding: '12px 0', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ color: 'var(--tx)', fontSize: 15 }}>{c.name}</div>
          {c.changes.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('ai_card_nothing_new')}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 13 }}>
              {c.changes.map((ch, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '2px 0' }}>
                  <span style={{ color: 'var(--tx3)', minWidth: 90 }}>{fieldLabel(ch.field)}</span>
                  <span style={{ color: 'var(--tx3)' }}>{ch.before ?? t('ai_card_empty')} →</span>
                  <span style={{ color: 'var(--tx)', overflowWrap: 'anywhere' }}>{ch.after}</span>
                </li>
              ))}
            </ul>
          )}
          {c.text ? (
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 12, color: 'var(--tx3)', cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>{t('ai_card_text_read')}</summary>
              <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0', color: 'var(--tx2)' }}>{c.text}</pre>
            </details>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            {c.changes.length > 0 ? (
              <a
                href={`/atelier/contacts?contact=${c.contactId}&aiJob=${c.jobId}`}
                className="btn primary sm"
                style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                {t('ai_card_open')}
              </a>
            ) : null}
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={pending === c.jobId} onClick={() => void reject(c.jobId)}>
              {c.changes.length === 0 ? t('ai_card_close') : t('ai_card_reject')}
            </button>
            {err === c.jobId ? <span style={{ color: 'var(--rust)', fontSize: 13 }}>{t('ai_run_failed')}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/** One job the PC's assistant does, in plain words: title, what it is for, how many wait, its button. */
function Task({ title, what, count, zero, children }: { title: string; what: string; count: string; zero: boolean; children?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 0', borderBottom: '1px solid var(--bd)', minHeight: 56 }}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ color: 'var(--tx)', fontSize: 15 }}>{title}</div>
        <div style={{ color: 'var(--tx3)', fontSize: 13, marginTop: 2 }}>{what}</div>
      </div>
      <div style={{ fontSize: 13, color: zero ? 'var(--tx3)' : 'var(--tx)', minWidth: 90 }}>
        {zero ? t('ai_plain_nothing') : t('ai_plain_waiting').replace('{n}', count)}
      </div>
      {children}
    </div>
  )
}

export function AiDesk({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang } = useI18n()
  const [data, setData] = useState<AiDeskData | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // The pem-ai: switch exists on the studio PC only; a phone just queues (the next pass on the PC does it).
  const onPc = !useMediaQuery('(max-width: 767px)')

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
    const id = setInterval(() => void refresh(), 2000)
    return () => clearInterval(id)
  }, [isAdmin, hasActiveJob, refresh])

  if (!isAdmin) return <p style={{ padding: 24, color: 'var(--tx3)' }}>{t('ai_admin_only')}</p>

  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const n = (v: number | null | undefined) => (data === null ? '…' : v == null ? '—' : v.toLocaleString(loc))
  const agent = data?.agent ?? null
  const jobs = data?.jobs ?? []
  const running = jobs.some((j) => j.status === 'running')
  const when = (d: string) => new Date(d).toLocaleString(loc, { dateStyle: 'short', timeStyle: 'short' })
  const kindLabel = (k: string) =>
    k === 'voice' ? t('ai_kind_voice') : k === 'embed' ? t('ai_kind_embed') : k === 'describe' ? t('ai_kind_describe') : k === 'card' ? t('ai_kind_card') : k
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
        {failed ? <p style={{ color: 'var(--rust)' }}>{t('ai_load_error')}</p> : null}

        {/* 1. The PC's assistant runs on demand (Pem 2026-11-19 « switch it on if I need to, it shuts down when done »):
            running now, or when it last ran — and the switch. */}
        <div
          data-testid="ai-desk-status"
          style={{ margin: '14px 0 24px', padding: '16px 18px', border: '1px solid var(--bd)', borderLeft: `3px solid ${running ? 'var(--sage)' : 'var(--tx3)'}`, background: 'var(--bg1)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 18, color: 'var(--tx)' }}>
              {data === null ? '…' : running ? t('ai_pass_running') : agent ? t('ai_pass_last').replace('{d}', when(agent.seenAt)) : t('ai_pass_never')}
            </div>
            <div style={{ fontSize: 14, color: 'var(--tx2)', marginTop: 6 }}>{data === null ? null : onPc ? t('ai_pass_sub_pc') : t('ai_pass_sub_phone')}</div>
          </div>
          {onPc && data !== null ? (
            <a
              href={AGENT_HREF}
              data-testid="ai-desk-launch"
              className="btn primary sm"
              style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              onClick={() => window.setTimeout(() => void refresh(), 3000)}
            >
              {running ? t('ai_pass_running_short') : t('ai_launch')}
            </a>
          ) : null}
        </div>

        {/* 2. What it does for you: one line per job, a count, one button. */}
        <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>{t('ai_plain_tasks')}</div>
        <div data-testid="ai-desk-queues">
          <Task title={t('ai_plain_voice')} what={t('ai_plain_voice_what')} count={n(q?.voice)} zero={(q?.voice ?? 0) === 0}>
            <RunButton kind="voice" jobs={jobs} onDone={() => void refresh()} onPc={onPc} />
          </Task>
          <Task title={t('ai_plain_index')} what={t('ai_plain_index_what')} count={n(q?.index)} zero={(q?.index ?? 0) === 0}>
            <RunButton kind="embed" jobs={jobs} onDone={() => void refresh()} onPc={onPc} />
          </Task>
          <Task title={t('ai_plain_describe')} what={t('ai_plain_describe_what')} count={n(q?.describe)} zero={(q?.describe ?? 0) === 0}>
            <RunButton kind="describe" jobs={jobs} onDone={() => void refresh()} onPc={onPc} />
          </Task>
          <Task title={t('ai_plain_cards')} what={t('ai_plain_cards_what')} count={n(q?.cards?.waiting)} zero={(q?.cards?.waiting ?? 0) === 0} />
        </div>
        {q?.cards && q.cards.review.length > 0 ? <CardReviews items={q.cards.review} onDone={() => void refresh()} /> : null}

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
              {j.status === 'waiting' && Date.now() - new Date(j.createdAt).getTime() > 20_000 ? (
                <p style={{ fontSize: 13, color: 'var(--rust)', margin: '4px 0 0' }}>{t('ai_job_not_started')}</p>
              ) : null}
              {j.status === 'running' ? (
                <pre
                  data-testid="ai-desk-live-log"
                  style={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 320, overflow: 'auto', margin: '6px 0 0', padding: 10, background: '#111', color: '#d8d8d8', borderRadius: 4 }}
                >
                  {j.log || t('ai_job_live_empty')}
                </pre>
              ) : null}
              {j.status !== 'running' && j.log ? (
                <details style={{ marginTop: 4 }} open={j.status === 'failed'}>
                  <summary style={{ fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' }}>{t('ai_job_log')}</summary>
                  <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto', margin: '4px 0 0' }}>{j.log}</pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>

        <details style={{ marginTop: 32 }} data-testid="ai-desk-technical">
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--tx3)' }}>{t('ai_plain_tech')}</summary>
          <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 10px' }}>{t('ai_plain_tech_note')}</p>
          {data ? (
            <div data-testid="ai-desk-engines">
              <Row
                on={running}
                label={t('ai_agent')}
                value={agent ? when(agent.seenAt) + (agent.models.length > 0 ? ' · ' + agent.models.map((m) => `${m.name} ${m.present ? t('ai_model_present') : t('ai_model_missing')}`).join(' · ') : '') : t('ai_agent_never')}
              />
              <Row on={!data.openaiKey} label={t('ai_openai_key')} value={data.openaiKey ? t('ai_yes') : t('ai_no')} />
              <Row on={data.cardPhoto !== 'none'} label={t('ai_card_photo')} value={data.cardPhoto === 'openai' ? t('ai_engine_openai') : t('ai_engine_none')} />
              <Row on={data.cardText === 'openai' || (data.cardText === 'ollama' && ollamaOk)} label={t('ai_card_text')} value={textEngine(data.cardText)} />
              <Row on={ollamaOk} label={t('ai_ollama')} value={data.ollama ? data.ollama.map((m) => `${m.model} ${m.present ? t('ai_model_present') : t('ai_model_missing')}`).join(' · ') : t('ai_no')} />
              {!ollamaOk ? <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '6px 0 0 19px' }}>{data.server === 'live' ? t('ai_ollama_out_live') : t('ai_ollama_out_pc')}</p> : null}
              <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '12px 0 0' }}>{t('ai_agent_start')}</p>
              <Command cmd="npm run ai:agent" />
              <Command cmd="pwsh scripts/register-ai-agent.ps1" />
              <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '12px 0 0' }}>{t('ai_by_hand')}</p>
              <Command cmd={CMD_VOICE_INDEX} withLink />
              <Command cmd="npm run embed:worker -- --drain" />
              <Command cmd={CMD_DESCRIBE} />
              {q?.cardPhotos?.latest ? <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '12px 0 0' }}>{t('ai_q_cards')} · {n(q.cardPhotos.count)} · {t('ai_latest').replace('{d}', date(q.cardPhotos.latest))}</p> : null}
            </div>
          ) : null}
        </details>
      </div>
    </div>
  )
}
