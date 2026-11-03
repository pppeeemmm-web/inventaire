'use client'

// Constats in the work drawer (owner 2026-11-02): newest examination first; each has date, who,
// grade, notes, action / treatment with a follow-up status, and issues with photos. Own saves —
// not part of the drawer's dirty baseline. Lists everything in Rapports → Constats too.

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { imageUrl, thumbUrl } from '@/lib/data'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import {
  ACTION_STATUSES,
  ACTION_STATUS_KEY,
  CONDITION_GRADES,
  GRADE_COLOR,
  GRADE_KEY,
  REPORT_KINDS,
  REPORT_KIND_KEY,
  type ActionStatus,
  type ConditionGrade,
  type ConditionReport,
  type ConditionWorkPatch,
  type ReportKind,
} from '@/lib/condition'
import { formatPartialDate, parsePartialDate, partialDateInput } from '@/lib/partial-date'
import {
  addConditionIssue,
  createConditionReport,
  deleteConditionReport,
  listConditionReports,
  removeConditionIssue,
  updateConditionReport,
} from '@/app/atelier/works/condition-actions'

type Draft = {
  examined_on: string
  examiner: string
  grade: ConditionGrade | ''
  notes: string
  action: string
  action_status: ActionStatus
  kind: ReportKind
  /** Destroyed / lost event date as typed (`2019`, `03/2019`, `12/03/2019`); empty = report date. */
  event: string
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyDraft = (): Draft => ({
  examined_on: today(), examiner: '', grade: '', notes: '', action: '', action_status: 'none', kind: 'examination', event: '',
})

/** `onWorkPatched`: a destroyed / lost constat changes the work (status, fate) — keep the list row in step. */
export function ConditionReportsSection({
  oeuvreId,
  onWorkPatched,
}: {
  oeuvreId: number
  onWorkPatched?: (patch: ConditionWorkPatch) => void
}) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [reports, setReports] = useState<ConditionReport[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [me, setMe] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  /** 'new' = creating; a number = editing that report; null = closed. */
  const [editing, setEditing] = useState<'new' | number | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listConditionReports(oeuvreId)
    if ('error' in res) setErr(true)
    else {
      setErr(false)
      setReports(res.reports)
      setNames(res.names)
      setMe(res.me)
      setIsAdmin(res.isAdmin)
    }
    setLoading(false)
  }, [oeuvreId])
  useEffect(() => {
    setEditing(null)
    void load()
  }, [load])

  const errText = (code: string) =>
    code === 'fate_admin_only'
      ? t('cond_err_fate_admin')
      : code === 'bad_event_date'
        ? t('cond_event_date_invalid')
        : code === 'forbidden'
      ? t('cond_err_forbidden')
      : code === 'r2_failed'
        ? t('cond_err_upload')
        : code === 'invalid_format'
          ? t('cond_err_format')
          : code === 'too_large'
            ? t('cond_err_too_large')
            : `${t('error_prefix')} ${code}`
  const who = (r: ConditionReport) => r.examiner?.trim() || (r.author_id ? names[r.author_id] : '') || '—'
  const canEdit = (r: ConditionReport) => isAdmin || r.author_id === me

  const openNew = () => {
    setDraft(emptyDraft())
    setEditing('new')
  }
  const openEdit = (r: ConditionReport) => {
    setDraft({
      examined_on: r.examined_on,
      examiner: r.examiner ?? '',
      grade: r.grade ?? '',
      notes: r.notes ?? '',
      action: r.action ?? '',
      action_status: r.action_status,
      kind: r.kind,
      event: partialDateInput(r.event_on, r.event_precision),
    })
    setEditing(r.id)
  }

  async function save() {
    const fate = draft.kind !== 'examination'
    const event = fate ? parsePartialDate(draft.event) : null
    if (event === 'invalid') { toast.error(t('cond_event_date_invalid')); return }
    setBusy(true)
    const input = {
      examined_on: draft.examined_on,
      examiner: draft.examiner,
      notes: draft.notes,
      kind: draft.kind,
      // A destruction / loss is not graded and has no treatment to follow.
      grade: fate ? null : draft.grade || null,
      action: fate ? '' : draft.action,
      action_status: fate ? 'none' : draft.action_status,
      event_on: event?.date ?? null,
      event_precision: event?.precision ?? null,
    }
    if (editing === 'new') {
      const res = await createConditionReport(oeuvreId, input)
      setBusy(false)
      if ('error' in res) { toast.error(errText(res.error)); return }
      setReports((prev) => [res.report, ...prev].sort((a, b) => b.examined_on.localeCompare(a.examined_on) || b.id - a.id))
      if (res.work) onWorkPatched?.(res.work)
    } else if (typeof editing === 'number') {
      const res = await updateConditionReport(editing, input)
      setBusy(false)
      if ('error' in res) { toast.error(errText(res.error)); return }
      setReports((prev) => prev.map((r) => (r.id === editing ? { ...r, ...res.report } : r)))
      if (res.work) onWorkPatched?.(res.work)
    }
    setEditing(null)
    toast.success(t('cond_saved'))
  }

  async function remove(r: ConditionReport) {
    if (!window.confirm(t('cond_delete_confirm'))) return
    const res = await deleteConditionReport(r.id)
    if ('error' in res) { toast.error(errText(res.error)); return }
    setReports((prev) => prev.filter((x) => x.id !== r.id))
    if (res.work) onWorkPatched?.(res.work)
    toast.success(t('cond_deleted'))
  }

  /** Lost work found again: closes the constat; the trigger restores the previous status. */
  async function markFound(r: ConditionReport) {
    if (!window.confirm(t('cond_found_confirm'))) return
    const res = await updateConditionReport(r.id, { resolved_on: today() })
    if ('error' in res) { toast.error(errText(res.error)); return }
    setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...res.report } : x)))
    if (res.work) onWorkPatched?.(res.work)
    toast.success(t('cond_saved'))
  }

  const fateDraft = draft.kind !== 'examination'
  // Destruction / loss constats are admin only (DB gate too); a non-admin editing one keeps its kind.
  const kindOptions = REPORT_KINDS.filter((k) => k === 'examination' || isAdmin || k === draft.kind)

  const box: CSSProperties = { border: '1px solid var(--bd)', padding: narrow ? 10 : 12, background: 'var(--bg1)' }
  const inputH: CSSProperties = { minHeight: narrow ? 44 : 34, fontSize: 13 }

  const form = (
    <div data-testid="cond-form" style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {kindOptions.length > 1 ? (
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('cond_kind')}</div>
          <div role="radiogroup" aria-label={t('cond_kind')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {kindOptions.map((k) => {
              const on = draft.kind === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-testid={`cond-kind-${k}`}
                  onClick={() => setDraft({ ...draft, kind: k })}
                  style={{
                    padding: '6px 12px',
                    minHeight: narrow ? 44 : 32,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: `1px solid ${k === 'examination' ? 'var(--bd)' : 'var(--tx3)'}`,
                    background: on ? 'var(--tx3)' : 'transparent',
                    color: on ? 'var(--bg1)' : 'var(--tx2)',
                  }}
                >
                  {t(REPORT_KIND_KEY[k])}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--tx3)' }}>
          {t('cond_date')}
          <input type="date" className="input" style={inputH} value={draft.examined_on} onChange={(e) => setDraft({ ...draft, examined_on: e.target.value })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--tx3)', flex: 1, minWidth: 180 }}>
          {t('cond_examiner')}
          <input className="input" style={inputH} value={draft.examiner} placeholder={t('cond_examiner_ph')} onChange={(e) => setDraft({ ...draft, examiner: e.target.value })} />
        </label>
      </div>
      {fateDraft ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--tx3)' }}>
            {t('cond_event_date')}
            <input
              className="input"
              style={inputH}
              inputMode="numeric"
              value={draft.event}
              placeholder={t('cond_event_date_ph')}
              data-testid="cond-event-date"
              onChange={(e) => setDraft({ ...draft, event: e.target.value })}
            />
          </label>
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{t('cond_fate_note')}</div>
        </>
      ) : null}
      <div style={{ display: fateDraft ? 'none' : undefined }}>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('cond_grade')}</div>
        <div role="radiogroup" aria-label={t('cond_grade')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['', ...CONDITION_GRADES] as const).map((g) => {
            const on = draft.grade === g
            return (
              <button
                key={g || 'none'}
                type="button"
                role="radio"
                aria-checked={on}
                data-testid={`cond-grade-${g || 'none'}`}
                onClick={() => setDraft({ ...draft, grade: g })}
                style={{
                  padding: '6px 12px',
                  minHeight: narrow ? 44 : 32,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: `1px solid ${g ? GRADE_COLOR[g] : 'var(--bd)'}`,
                  background: on ? (g ? GRADE_COLOR[g] : 'var(--tx3)') : 'transparent',
                  color: on ? 'var(--bg1)' : 'var(--tx2)',
                }}
              >
                {g ? t(GRADE_KEY[g]) : t('cond_grade_none')}
              </button>
            )
          })}
        </div>
      </div>
      <textarea className="input" rows={3} value={draft.notes} placeholder={t('cond_notes')} aria-label={t('cond_notes')} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={{ resize: 'vertical', fontSize: 13 }} />
      {fateDraft ? null : (
        <textarea className="input" rows={2} value={draft.action} placeholder={t('cond_action')} aria-label={t('cond_action')} onChange={(e) => setDraft({ ...draft, action: e.target.value })} style={{ resize: 'vertical', fontSize: 13 }} />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {fateDraft ? null : (
          <>
            <label style={{ fontSize: 11, color: 'var(--tx3)' }} htmlFor={`cond-status-${oeuvreId}`}>{t('cond_action_status')}</label>
            <select id={`cond-status-${oeuvreId}`} className="input" style={inputH} value={draft.action_status} onChange={(e) => setDraft({ ...draft, action_status: e.target.value as ActionStatus })}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>{t(ACTION_STATUS_KEY[s])}</option>
              ))}
            </select>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setEditing(null)}>{t('cond_cancel')}</button>
        <button type="button" className="btn primary sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => void save()} data-testid="cond-save">
          {t('cond_save')}
        </button>
      </div>
    </div>
  )

  return (
    <section data-testid="cond-section" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="t-label" style={{ flex: 1 }}>
          {reports.length ? t('cond_heading_fmt').replace('{n}', String(reports.length)) : t('cond_heading')}
        </div>
        {editing === null ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={openNew} data-testid="cond-new">
            {t('cond_new')}
          </button>
        ) : null}
      </div>
      {editing === 'new' ? form : null}
      {loading ? (
        <div className="t-mono-sm" style={{ opacity: 0.6 }}>{t('cond_loading')}</div>
      ) : err ? (
        <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>{t('cond_load_error')}</div>
      ) : reports.length === 0 && editing !== 'new' ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('cond_empty')}</div>
      ) : (
        reports.map((r) =>
          editing === r.id ? (
            <div key={r.id}>{form}</div>
          ) : (
            <article key={r.id} data-testid={`cond-report-${r.id}`} style={{ ...box, marginBottom: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                  {t('cond_by_fmt').replace('{date}', new Date(`${r.examined_on}T12:00:00`).toLocaleDateString(loc)).replace('{who}', who(r))}
                </span>
                {r.kind !== 'examination' ? (
                  <span data-testid={`cond-fate-${r.id}`} style={{ fontSize: 11, padding: '1px 8px', color: 'var(--bg1)', background: 'var(--tx3)' }}>
                    {t(REPORT_KIND_KEY[r.kind])} · {formatPartialDate(r.event_on ?? r.examined_on, r.event_on ? r.event_precision : 'day', loc)}
                  </span>
                ) : null}
                {r.kind === 'lost' && r.resolved_on ? (
                  <span style={{ fontSize: 11, padding: '1px 8px', border: '1px solid var(--sage)', color: 'var(--sage)' }}>
                    {t('cond_found_fmt').replace('{date}', formatPartialDate(r.resolved_on, 'day', loc))}
                  </span>
                ) : null}
                {r.grade ? (
                  <span style={{ fontSize: 11, padding: '1px 8px', color: 'var(--bg1)', background: GRADE_COLOR[r.grade] }}>{t(GRADE_KEY[r.grade])}</span>
                ) : null}
                {r.action_status !== 'none' ? (
                  <span style={{ fontSize: 11, padding: '1px 8px', border: `1px solid ${r.action_status === 'todo' ? 'var(--rust)' : 'var(--sage)'}`, color: r.action_status === 'todo' ? 'var(--rust)' : 'var(--sage)' }}>
                    {t(ACTION_STATUS_KEY[r.action_status])}
                  </span>
                ) : null}
                <span style={{ flex: 1 }} />
                {r.kind === 'lost' && !r.resolved_on && isAdmin && editing === null ? (
                  <button type="button" className="btn ghost sm" style={{ color: 'var(--sage)' }} data-testid={`cond-found-${r.id}`} onClick={() => void markFound(r)}>
                    {t('cond_found_btn')}
                  </button>
                ) : null}
                {canEdit(r) && editing === null ? (
                  <button type="button" className="btn ghost sm" onClick={() => openEdit(r)}>{t('cond_edit')}</button>
                ) : null}
                {isAdmin && editing === null ? (
                  <button type="button" className="btn ghost sm" style={{ color: 'var(--rust)' }} onClick={() => void remove(r)}>{t('cond_delete')}</button>
                ) : null}
              </div>
              {r.notes ? <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 6 }}>{r.notes}</div> : null}
              {r.action ? (
                <div style={{ fontSize: 12, color: 'var(--tx2)', whiteSpace: 'pre-wrap', marginTop: 6 }}>
                  <span className="t-label" style={{ marginRight: 6 }}>{t('cond_action')}</span>{r.action}
                </div>
              ) : null}
              <IssueList report={r} canAdd onChange={(issues) => setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, issues } : x)))} me={me} isAdmin={isAdmin} errText={errText} />
            </article>
          ),
        )
      )}
    </section>
  )
}

function IssueList({
  report,
  canAdd,
  onChange,
  me,
  isAdmin,
  errText,
}: {
  report: ConditionReport
  canAdd: boolean
  onChange: (issues: ConditionReport['issues']) => void
  me: string
  isAdmin: boolean
  errText: (code: string) => string
}) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [desc, setDesc] = useState('')
  const [where, setWhere] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileKey, setFileKey] = useState(0)

  async function add() {
    if (!desc.trim()) return
    setBusy(true)
    const fd = new FormData()
    fd.set('description', desc)
    fd.set('location', where)
    // Constat photos end at 2100 px: shrink on every device so desktop uploads stay under the 4.5 MB body cap too.
    if (file) fd.set('photo', await downscaleImageFileForMobileIfNeeded(file, true, 2100))
    const res = await addConditionIssue(report.id, fd)
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    onChange([...report.issues, res.issue])
    setDesc('')
    setWhere('')
    setFile(null)
    setFileKey((k) => k + 1)
    toast.success(t('cond_issue_added'))
  }

  async function remove(id: number) {
    if (!window.confirm(t('cond_issue_remove_confirm'))) return
    const res = await removeConditionIssue(id)
    if ('error' in res) { toast.error(errText(res.error)); return }
    onChange(report.issues.filter((i) => i.id !== id))
  }

  const inputH: CSSProperties = { minHeight: narrow ? 44 : 32, fontSize: 12 }
  return (
    <div style={{ marginTop: 10 }}>
      <div className="t-label" style={{ marginBottom: 6 }}>{t('cond_issues_fmt').replace('{n}', String(report.issues.length))}</div>
      {report.issues.map((i) => (
        <div key={i.id} data-testid={`cond-issue-${i.id}`} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid var(--bd)' }}>
          {i.photo_key ? (
            <a href={imageUrl(i.photo_key) ?? undefined} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- R2 thumb, already a 400px AVIF */}
              <img src={thumbUrl(i.photo_key) ?? undefined} alt="" width={64} height={64} style={{ objectFit: 'cover', display: 'block' }} />
            </a>
          ) : null}
          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{i.description}</div>
            {i.location ? <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{i.location}</div> : null}
          </div>
          {isAdmin || i.author_id === me ? (
            <button type="button" className="btn ghost sm" aria-label={t('cond_issue_remove_aria')} style={{ minHeight: narrow ? 44 : 28 }} onClick={() => void remove(i.id)}>×</button>
          ) : null}
        </div>
      ))}
      {canAdd ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <input className="input" style={{ ...inputH, flex: 2, minWidth: 160 }} value={desc} placeholder={t('cond_issue_desc_ph')} aria-label={t('cond_issue_desc_ph')} onChange={(e) => setDesc(e.target.value)} data-testid={`cond-issue-desc-${report.id}`} />
          <input className="input" style={{ ...inputH, flex: 1, minWidth: 120 }} value={where} placeholder={t('cond_issue_loc_ph')} aria-label={t('cond_issue_loc_ph')} onChange={(e) => setWhere(e.target.value)} />
          <label className="btn ghost sm" style={{ ...inputH, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {file ? `${t('cond_issue_photo')} ✓` : t('cond_issue_photo')}
            <input key={fileKey} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn sm" style={{ minHeight: narrow ? 44 : 32 }} disabled={busy || !desc.trim()} onClick={() => void add()} data-testid={`cond-issue-add-${report.id}`}>
            {busy ? t('cond_uploading') : t('cond_issue_add')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
