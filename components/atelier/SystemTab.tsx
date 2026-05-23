'use client'

import { useState, useEffect, useTransition, useRef, type SyntheticEvent, type ClipboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { vaultStudioBible } from '@/app/atelier/(portal)/vault/bible-action'
import { exportSiteMapChecklistPdf } from '@/app/atelier/(portal)/vault/actions'
import { getSystemLedgerReferenceMarkdown } from '@/app/atelier/system-reference-actions'
import { uploadLedgerAttachment } from '@/app/atelier/(portal)/system/ledger-attachment-actions'
import { stringifyError } from '@/lib/error'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { imageUrl } from '@/lib/data'
import { useMediaQuery } from '@/lib/useMediaQuery'

const TYPES = ['suggestion', 'improvement', 'maintenance', 'backlog', 'bug'] as const
const STATUSES = ['active', 'requested', 'in-progress', 'completed', 'dismissed'] as const
const MAX_ATTACHMENTS = 8

const TYPE_TO_DICT: Record<(typeof TYPES)[number], DictKey> = {
  suggestion: 'system_task_type_suggestion',
  improvement: 'system_task_type_improvement',
  maintenance: 'system_task_type_maintenance',
  backlog: 'system_task_type_backlog',
  bug: 'system_task_type_bug',
}

const STATUS_TO_DICT: Record<(typeof STATUSES)[number], DictKey> = {
  active: 'system_ledger_status_active',
  requested: 'system_ledger_status_requested',
  'in-progress': 'system_ledger_status_in_progress',
  completed: 'system_ledger_status_completed',
  dismissed: 'system_ledger_status_dismissed',
}

const PRIORITY_TO_DICT: Record<string, DictKey> = {
  P1: 'system_ledger_priority_p1',
  P2: 'system_ledger_priority_p2',
  P3: 'system_ledger_priority_p3',
  P4: 'system_ledger_priority_p4',
}

function priorityColor(p: string | null | undefined) {
  if (p === 'P1') return '#e05252'
  if (p === 'P2') return '#d4843a'
  if (p === 'P4') return 'var(--tx3)'
  return 'var(--ac)'
}

function statusColor(s: string | null | undefined) {
  if (s === 'completed') return 'var(--green)'
  if (s === 'dismissed') return 'var(--tx3)'
  if (s === 'in-progress') return '#d4843a'
  return 'var(--ac)'
}

function nextStatus(s: string | null | undefined): string {
  const idx = STATUSES.indexOf((s ?? 'active') as (typeof STATUSES)[number])
  return STATUSES[(idx + 1) % STATUSES.length]
}

type LedgerAttachment = { key: string }

function normalizeAttachments(raw: unknown): LedgerAttachment[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: LedgerAttachment[] = []
  for (const x of raw) {
    if (x && typeof x === 'object' && 'key' in x && typeof (x as { key: unknown }).key === 'string') {
      out.push({ key: (x as { key: string }).key })
    }
  }
  return out
}

interface LogEntry {
  id: number
  created_at: string
  type: string | null
  action: string
  details: string | null
  status: string | null
  priority: string | null
  attachments?: unknown
}

interface Draft {
  action: string
  details: string
  type: string
  status: string
  priority: string
  attachments: LedgerAttachment[]
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: 'var(--bg0)',
  border: '1px solid var(--bd)',
  color: 'var(--tx)',
  fontSize: 11,
  width: '100%',
  boxSizing: 'border-box',
}

function LedgerThumb({
  storageKey,
  expiredLabel,
}: {
  storageKey: string
  expiredLabel: string
}) {
  const [gone, setGone] = useState(false)
  const src = imageUrl(storageKey)
  if (!src || gone) {
    return (
      <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', alignSelf: 'center' }}>
        {expiredLabel}
      </span>
    )
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', flexShrink: 0 }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        style={{ maxHeight: 72, maxWidth: 120, objectFit: 'contain', border: '1px solid var(--bd)', borderRadius: 2 }}
        onError={() => setGone(true)}
      />
    </a>
  )
}

export function SystemTab() {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [checklistPending, startChecklist] = useTransition()
  const [refMdBusy, setRefMdBusy] = useState(false)
  const [refCopiedFlash, setRefCopiedFlash] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)

  const attachFileRef = useRef<HTMLInputElement>(null)
  const attachTargetRef = useRef<'new' | 'edit'>('new')

  const [action, setAction] = useState('')
  const [details, setDetails] = useState('')
  const [type, setType] = useState('maintenance')
  const [priority, setPriority] = useState('P3')
  const [pendingAttachments, setPendingAttachments] = useState<LedgerAttachment[]>([])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  useEffect(() => {
    void fetchLogs()
  }, [])

  async function fetchLogs() {
    const sb = createClient()
    const { data } = await sb.from('system_log').select('*').is('event_type', null).order('id', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }

  function uploadErrorAlert(code: string) {
    const key = `system_ledger_upload_${code}` as DictKey
    alert(t(key))
  }

  async function runUpload(file: File, onDone: (key: string) => void): Promise<boolean> {
    if (attachBusy) return false
    setAttachBusy(true)
    const fd = new FormData()
    fd.set('file', file)
    const res = await uploadLedgerAttachment(fd)
    setAttachBusy(false)
    if (!res.ok) {
      uploadErrorAlert(res.code)
      return false
    }
    onDone(res.key)
    return true
  }

  async function handleAddAttachments(files: FileList | File[] | null) {
    if (!files?.length) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    const tgt = attachTargetRef.current
    const curLen = tgt === 'edit' && draft ? draft.attachments.length : pendingAttachments.length
    let rem = MAX_ATTACHMENTS - curLen
    if (rem <= 0) {
      alert(t('system_ledger_attach_max'))
      return
    }
    let skipped = false
    for (const f of list) {
      if (rem <= 0) {
        skipped = true
        break
      }
      const ok = await runUpload(f, (key) => {
        if (attachTargetRef.current === 'edit') {
          setDraft((d) => {
            if (!d || d.attachments.length >= MAX_ATTACHMENTS) return d
            return { ...d, attachments: [...d.attachments, { key }] }
          })
        } else {
          setPendingAttachments((prev) => {
            if (prev.length >= MAX_ATTACHMENTS) return prev
            return [...prev, { key }]
          })
        }
      })
      if (ok) rem -= 1
    }
    if (skipped) alert(t('system_ledger_attach_max'))
  }

  function openAttachPicker(target: 'new' | 'edit') {
    attachTargetRef.current = target
    attachFileRef.current?.click()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!action) return
    setBusy(true)
    const sb = createClient()
    const status = type === 'suggestion' ? 'requested' : 'active'
    const attachments = pendingAttachments.length ? pendingAttachments : []
    const { data } = await sb
      .from('system_log')
      .insert([
        {
          action,
          details,
          type,
          status,
          priority,
          attachments,
        },
      ])
      .select()
      .single()
    if (data) {
      setLogs([data, ...logs])
      setAction('')
      setDetails('')
      setPriority('P3')
      setPendingAttachments([])
    }
    setBusy(false)
  }

  function startEdit(log: LogEntry) {
    setEditingId(log.id)
    setDraft({
      action: log.action,
      details: log.details ?? '',
      type: log.type ?? 'maintenance',
      status: log.status ?? 'active',
      priority: log.priority ?? 'P3',
      attachments: normalizeAttachments(log.attachments),
    })
  }

  async function saveEdit(id: number) {
    if (!draft) return
    setSaveBusy(true)
    const sb = createClient()
    const { data } = await sb
      .from('system_log')
      .update({
        action: draft.action,
        details: draft.details,
        type: draft.type,
        status: draft.status,
        priority: draft.priority,
        attachments: draft.attachments,
      })
      .eq('id', id)
      .select()
      .single()
    if (data) setLogs(logs.map((l) => (l.id === id ? data : l)))
    setSaveBusy(false)
    setEditingId(null)
    setDraft(null)
  }

  async function cycleStatus(log: LogEntry) {
    const next = nextStatus(log.status)
    const sb = createClient()
    const { data } = await sb.from('system_log').update({ status: next }).eq('id', log.id).select().single()
    if (data) setLogs(logs.map((l) => (l.id === log.id ? data : l)))
  }

  async function deleteLog(id: number) {
    if (!confirm(t('system_ledger_delete_confirm'))) return
    const sb = createClient()
    const { error } = await sb.from('system_log').delete().eq('id', id)
    if (!error) setLogs(logs.filter((l) => l.id !== id))
  }

  function handleDownloadChecklist() {
    startChecklist(async () => {
      const res = await exportSiteMapChecklistPdf()
      if (!('ok' in res) || !res.ok) {
        const err = 'error' in res ? res.error : 'Unknown'
        alert(`${t('system_checklist_error_prefix')} ${stringifyError(err)}`)
        return
      }
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  async function fetchLedgerReferenceMd() {
    setRefMdBusy(true)
    try {
      const res = await getSystemLedgerReferenceMarkdown()
      if (!('ok' in res) || !res.ok) {
        const err = 'error' in res ? res.error : 'Unknown'
        alert(`${t('system_ledger_ref_error_prefix')} ${stringifyError(err)}`)
        return null
      }
      return res
    } finally {
      setRefMdBusy(false)
    }
  }

  async function handleCopyLedgerReference() {
    const res = await fetchLedgerReferenceMd()
    if (!res) return
    try {
      await navigator.clipboard.writeText(res.markdown)
      setRefCopiedFlash(true)
      window.setTimeout(() => setRefCopiedFlash(false), 2500)
    } catch {
      alert(t('system_ledger_ref_clipboard_failed'))
    }
  }

  async function handleDownloadLedgerReference() {
    const res = await fetchLedgerReferenceMd()
    if (!res) return
    const blob = new Blob([res.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleRegenerateBible() {
    if (!confirm(t('system_ledger_bible_confirm'))) return
    startTransition(async () => {
      const res = await vaultStudioBible()
      if ('error' in res) {
        alert(`${t('system_ledger_bible_err_prefix')} ${stringifyError(res.error)}`)
      } else {
        alert(`${t('system_ledger_bible_success')} ${res.filename}`)
        const sb = createClient()
        await sb.from('system_log').insert([
          {
            action: 'Studio Bible Updated',
            details: `Regenerated high-fidelity PDF and vaulted as ${res.filename}`,
            type: 'improvement',
            status: 'completed',
            priority: 'P3',
            attachments: [],
          },
        ])
        void fetchLogs()
      }
    })
  }

  function handleDetailsPaste(e: ClipboardEvent<HTMLTextAreaElement>, target: 'new' | 'edit') {
    const cb = e.clipboardData
    if (!cb?.files?.length) return
    const imgs = Array.from(cb.files).filter((f: File) => f.type.startsWith('image/'))
    if (!imgs.length) return
    e.preventDefault()
    attachTargetRef.current = target
    void handleAddAttachments(imgs)
  }

  const formGridStyle: React.CSSProperties = narrow
    ? { display: 'flex', flexDirection: 'column', gap: 12 }
    : { display: 'grid', gridTemplateColumns: '80px 150px 1fr', gap: 12 }

  const rowGridStyle: React.CSSProperties = narrow
    ? { display: 'flex', flexDirection: 'column', gap: 10, padding: '13px 16px', alignItems: 'stretch' }
    : {
        display: 'grid',
        gridTemplateColumns: '44px 84px 110px 1fr 100px 88px',
        gap: 12,
        padding: '13px 16px',
        alignItems: 'start',
      }

  function renderAttachmentEditor(items: LedgerAttachment[], onRemove: (key: string) => void, target: 'new' | 'edit') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          data-testid={target === 'new' ? 'system-ledger-attach-trigger' : undefined}
          className="btn ghost sm"
          disabled={attachBusy || items.length >= MAX_ATTACHMENTS}
          onClick={() => openAttachPicker(target)}
          style={{
            minHeight: 44,
            minWidth: 44,
            borderColor: 'var(--bd)',
            color: 'var(--tx2)',
          }}
        >
          {attachBusy ? t('system_ledger_attach_busy') : t('system_ledger_attach_add')}
        </button>
        {items.map((a) => (
          <div key={a.key} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <LedgerThumb storageKey={a.key} expiredLabel={t('system_ledger_attachment_expired')} />
            <button
              type="button"
              aria-label={t('system_ledger_attach_remove_aria')}
              onClick={() => onRemove(a.key)}
              style={{
                marginLeft: 4,
                background: 'var(--bg1)',
                border: '1px solid var(--bd)',
                color: 'var(--tx2)',
                cursor: 'pointer',
                minWidth: 36,
                minHeight: 36,
                fontSize: 14,
                borderRadius: 2,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    )
  }

  const headerPad = narrow ? '16px 16px' : '32px 40px'

  return (
    <div style={{ flex: 1, padding: headerPad, overflow: 'auto', background: 'var(--bg0)' }}>
      <input
        ref={attachFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        capture={narrow ? 'environment' : undefined}
        style={{ display: 'none' }}
        aria-hidden
        onChange={(ev) => {
          void handleAddAttachments(ev.target.files)
          ev.target.value = ''
        }}
      />
      <div style={{ maxWidth: 960 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: narrow ? 'stretch' : 'flex-start',
            marginBottom: 32,
            gap: narrow ? 16 : 0,
          }}
        >
          <div>
            <h2 data-testid="system-ledger-heading" className="serif" style={{ fontSize: narrow ? 26 : 32, marginBottom: 8 }}>
              {t('system_ledger_title')}
            </h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
              {t('system_ledger_subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: narrow ? 'stretch' : 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: narrow ? 'flex-start' : 'flex-end' }}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={handleDownloadChecklist}
                disabled={checklistPending}
                style={{ borderColor: 'var(--bd)', color: 'var(--tx2)' }}
              >
                {checklistPending ? t('system_checklist_building') : t('system_download_site_checklist')}
              </button>
              <button
                className="btn ghost sm"
                onClick={handleRegenerateBible}
                disabled={isPending}
                style={{ borderColor: 'var(--ac)', color: 'var(--ac)' }}
              >
                {isPending ? t('system_ledger_bible_regenerating') : t('system_ledger_bible_cta')}
              </button>
              <button
                type="button"
                data-testid="system-ledger-ref-copy"
                className="btn ghost sm"
                onClick={() => void handleCopyLedgerReference()}
                disabled={refMdBusy}
                style={{ borderColor: 'var(--bd)', color: 'var(--tx2)' }}
              >
                {refMdBusy ? t('system_ledger_ref_loading') : t('system_ledger_ref_copy')}
              </button>
              <button
                type="button"
                data-testid="system-ledger-ref-download"
                className="btn ghost sm"
                onClick={() => void handleDownloadLedgerReference()}
                disabled={refMdBusy}
                style={{ borderColor: 'var(--bd)', color: 'var(--tx2)' }}
              >
                {refMdBusy ? t('system_ledger_ref_loading') : t('system_ledger_ref_download')}
              </button>
            </div>
            {refCopiedFlash && (
              <span className="t-mono-sm" style={{ color: 'var(--green)' }} role="status">
                {t('system_ledger_ref_clipboard_ok')}
              </span>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--bd)',
            padding: 24,
            marginBottom: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={formGridStyle}>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                ...inputStyle,
                border: `1px solid ${priorityColor(priority)}`,
                color: priorityColor(priority),
                fontWeight: 600,
              }}
            >
              {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                <option key={p} value={p}>
                  {t(PRIORITY_TO_DICT[p])}
                </option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(TYPE_TO_DICT[ty])}
                </option>
              ))}
            </select>
            <input
              placeholder={t('system_ledger_summary_ph')}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={inputStyle}
            />
          </div>
          <textarea
            placeholder={t('system_ledger_details_ph')}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onPaste={(e) => handleDetailsPaste(e, 'new')}
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          />
          {renderAttachmentEditor(pendingAttachments, (key) => setPendingAttachments((p) => p.filter((x) => x.key !== key)), 'new')}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button disabled={busy || !action} type="submit" className="btn primary sm" style={{ minHeight: 44 }}>
              {busy ? t('system_ledger_logging') : t('system_ledger_add_entry')}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            {t('system_ledger_loading')}
          </div>
        ) : logs.length === 0 ? (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
            {t('system_ledger_empty')}
          </div>
        ) : (
          <div style={{ border: '1px solid var(--bd)' }}>
            <div
              style={{
                display: narrow ? 'none' : 'grid',
                gridTemplateColumns: '44px 84px 110px 1fr 100px 88px',
                gap: 12,
                padding: '8px 16px',
                borderBottom: '1px solid var(--bd)',
                background: 'var(--bg1)',
              }}
            >
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                {t('system_ledger_col_pri')}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                {t('system_ledger_col_date')}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                {t('system_ledger_col_type')}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                {t('system_ledger_col_entry')}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>
                {t('system_ledger_col_status')}
              </div>
              <div style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }} />
            </div>

            {logs.map((log, idx) => {
              const isEditing = editingId === log.id
              const viewAttachments = normalizeAttachments(log.attachments)

              return (
                <div
                  key={log.id}
                  style={{
                    borderBottom: idx === logs.length - 1 ? 'none' : '1px solid var(--bd2)',
                    background: isEditing ? 'var(--bg1)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  {isEditing && draft ? (
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={formGridStyle}>
                        <select
                          value={draft.priority}
                          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                          style={{
                            ...inputStyle,
                            border: `1px solid ${priorityColor(draft.priority)}`,
                            color: priorityColor(draft.priority),
                            fontWeight: 600,
                          }}
                        >
                          {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                            <option key={p} value={p}>
                              {t(PRIORITY_TO_DICT[p])}
                            </option>
                          ))}
                        </select>
                        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} style={inputStyle}>
                          {TYPES.map((ty) => (
                            <option key={ty} value={ty}>
                              {t(TYPE_TO_DICT[ty])}
                            </option>
                          ))}
                        </select>
                        <input value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} style={inputStyle} />
                      </div>
                      <textarea
                        value={draft.details}
                        onChange={(e) => setDraft({ ...draft, details: e.target.value })}
                        onPaste={(e) => handleDetailsPaste(e, 'edit')}
                        style={{ ...inputStyle, minHeight: 52, resize: 'vertical' }}
                      />
                      {renderAttachmentEditor(
                        draft.attachments,
                        (key) => setDraft((d) => (d ? { ...d, attachments: d.attachments.filter((x) => x.key !== key) } : d)),
                        'edit',
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase' }}>
                          {t('system_ledger_col_status')}
                        </span>
                        <select
                          value={draft.status}
                          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                          style={{ ...inputStyle, width: 'auto' }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(STATUS_TO_DICT[s])}
                            </option>
                          ))}
                        </select>
                        <div style={{ flex: 1 }} />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setDraft(null)
                          }}
                          className="btn ghost sm"
                          style={{ fontSize: 10, minHeight: 44 }}
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(log.id)}
                          disabled={saveBusy || !draft.action}
                          className="btn primary sm"
                          style={{ fontSize: 10, minHeight: 44 }}
                        >
                          {saveBusy ? t('system_ledger_save_busy') : t('save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={rowGridStyle}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 10,
                          color: priorityColor(log.priority),
                          letterSpacing: 0.5,
                          paddingTop: 1,
                        }}
                      >
                        {log.priority ?? '—'}
                      </div>
                      <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9, paddingTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString(locale)}
                      </div>
                      <div>
                        {log.type && TYPES.includes(log.type as (typeof TYPES)[number]) && (
                          <span
                            style={{
                              fontSize: 8,
                              textTransform: 'uppercase',
                              color: 'var(--ac)',
                              letterSpacing: 1,
                              border: '1px solid var(--ac)',
                              padding: '1px 5px',
                            }}
                          >
                            {t(TYPE_TO_DICT[log.type as (typeof TYPES)[number]])}
                          </span>
                        )}
                        {log.type && !TYPES.includes(log.type as (typeof TYPES)[number]) && (
                          <span
                            style={{
                              fontSize: 8,
                              textTransform: 'uppercase',
                              color: 'var(--ac)',
                              letterSpacing: 1,
                              border: '1px solid var(--ac)',
                              padding: '1px 5px',
                            }}
                          >
                            {log.type}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="t-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>
                          {log.action}
                        </div>
                        {log.details && (
                          <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.4 }}>{log.details}</div>
                        )}
                        {viewAttachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                            {viewAttachments.map((a) => (
                              <LedgerThumb key={a.key} storageKey={a.key} expiredLabel={t('system_ledger_attachment_expired')} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => cycleStatus(log)}
                          title={t('system_ledger_cycle_status_title')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            color: statusColor(log.status),
                            fontFamily: 'inherit',
                            minHeight: 44,
                            textAlign: narrow ? 'left' : 'center',
                          }}
                        >
                          {STATUSES.includes((log.status ?? 'active') as (typeof STATUSES)[number])
                            ? t(STATUS_TO_DICT[(log.status ?? 'active') as (typeof STATUSES)[number]])
                            : (log.status ?? '')}{' '}
                          ↻
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: narrow ? 'flex-start' : 'flex-end', paddingTop: 1 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(log)}
                          aria-label={t('system_ledger_edit_aria')}
                          title={t('system_ledger_edit_aria')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--tx3)',
                            fontSize: 11,
                            padding: '0 2px',
                            minWidth: 44,
                            minHeight: 44,
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLog(log.id)}
                          aria-label={t('system_ledger_delete_aria')}
                          title={t('system_ledger_delete_aria')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--tx3)',
                            fontSize: 13,
                            padding: '0 2px',
                            lineHeight: 1,
                            minWidth: 44,
                            minHeight: 44,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
