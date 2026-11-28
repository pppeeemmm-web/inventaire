'use client'

// Laboratoire — one idea's lab part (design 2026-11-28/Laboratoire.md): the tree of a field / chapter, a recipe card,
// the grid of limits, « Essai ». Everything comes from `lab` (no read here); writes go through lab-actions doors.

import { useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'
import { addTrial, plantLabIdea, saveRecipe } from '@/app/atelier/(portal)/concepts/lab-actions'
import {
  LAB_CHILD_ROLES, LAB_CRITERIA, LAB_SIGNS, LAB_SIGN_MARK,
  type LabAssessment, type LabCriterion, type LabDesk, type LabIngredient, type LabRole, type LabSign, type LabSource, type LabStep,
} from '@/lib/lab'

const KNOWN_ERR = ['auth', 'forbidden', 'not_found', 'role_failed', 'unchanged', 'stale', 'failed', 'empty']
const SOURCES: LabSource[] = ['literature', 'trials']
const h3: CSSProperties = { margin: '14px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--tx2)' }
const inp: CSSProperties = { minHeight: 44, fontSize: 15, boxSizing: 'border-box', minWidth: 0, width: '100%' }
const small: CSSProperties = { fontSize: 12.5, color: 'var(--tx3)' }
const box: CSSProperties = { border: '1px solid var(--bd)', borderRadius: 10, padding: 10, background: 'var(--bg1)', display: 'grid', gap: 6 }

type Cell = { sign: LabSign | ''; score: string; note: string; sourceRef: string }
type IngDraft = { src: LabIngredient; label: string; amount: string; unit: string; ratio: string; note: string }
type StepDraft = { src: LabStep; body: string; duration: string; warning: string }
type Draft = { version: string; ings: IngDraft[]; steps: StepDraft[]; grid: Record<string, Cell> }

const cellKey = (c: LabCriterion, s: LabSource) => `${c}|${s}`
const num = (s: string): number | null => {
  const v = Number(s.replace(',', '.'))
  return s.trim() && Number.isFinite(v) ? v : null
}
const txt = (s: string): string | null => (s.trim() ? s.trim() : null)

function toDraft(lab: LabDesk): Draft {
  const grid: Record<string, Cell> = {}
  for (const a of lab.assessments) grid[cellKey(a.criterion, a.source)] = { sign: a.sign, score: a.score != null ? String(a.score) : '', note: a.note ?? '', sourceRef: a.sourceRef ?? '' }
  return {
    version: lab.version != null ? String(lab.version) : '',
    ings: lab.ingredients.map((i) => ({ src: i, label: i.label ?? '', amount: i.amount != null ? String(i.amount) : '', unit: i.unit ?? '', ratio: i.ratioPct != null ? String(i.ratioPct) : '', note: i.note ?? '' })),
    steps: lab.steps.map((s) => ({ src: s, body: s.body, duration: s.duration ?? '', warning: s.warning ?? '' })),
    grid,
  }
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const out = list.slice()
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function LabPanel({ ideaId, lab, isAdmin, narrow, onOpen, onChanged }: {
  ideaId: string
  lab: LabDesk
  isAdmin: boolean
  narrow: boolean
  onOpen: (id: string) => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const tt = t as unknown as (k: string) => string
  const [draft, setDraft] = useState<Draft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [busy, setBusy] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)

  const errText = (code: string) => (KNOWN_ERR.includes(code) ? tt(`lab_err_${code}`) : code)
  const isCard = lab.role === 'recette' || lab.role === 'conjecture'
  const canEdit = isAdmin && !narrow && isCard

  function startEdit() {
    const d = toDraft(lab)
    setBaseline(JSON.stringify(d))
    setDraft(d)
  }
  function cancelEdit() {
    if (draft && JSON.stringify(draft) !== baseline && !window.confirm(t('lab_discard_confirm'))) return
    setDraft(null)
  }

  async function save() {
    if (!draft) return
    setBusy(true)
    const ingredients: LabIngredient[] = draft.ings
      .filter((i) => i.label.trim() || i.src.stockItemId != null)
      .map((i) => ({ stockItemId: i.src.stockItemId, stockName: i.src.stockName, label: txt(i.label), amount: num(i.amount), unit: txt(i.unit), ratioPct: num(i.ratio), note: txt(i.note) }))
    const steps: LabStep[] = draft.steps.map((s) => ({ body: s.body, duration: txt(s.duration), equipmentId: s.src.equipmentId, equipmentName: s.src.equipmentName, warning: txt(s.warning) }))
    const assessments: LabAssessment[] = []
    for (const c of LAB_CRITERIA) {
      for (const s of SOURCES) {
        const cell = draft.grid[cellKey(c, s)]
        if (!cell || !cell.sign) continue
        const sc = num(cell.score)
        const prev = lab.assessments.find((a) => a.criterion === c && a.source === s)
        assessments.push({ criterion: c, source: s, sign: cell.sign, score: sc != null && sc >= 1 && sc <= 5 ? Math.round(sc) : null, note: txt(cell.note), sourceRef: s === 'literature' ? txt(cell.sourceRef) : null, journalEntryId: prev?.journalEntryId ?? null })
      }
    }
    const v = num(draft.version)
    const res = await saveRecipe({
      id: ideaId,
      readUpdatedAt: lab.updatedAt,
      version: v != null ? Math.round(v) : null,
      ...(lab.role === 'recette' ? { ingredients, steps } : {}),
      assessments,
    })
    setBusy(false)
    if ('error' in res) {
      toast.error(errText(res.error))
      return
    }
    toast.success(t('lab_saved'))
    setDraft(null)
    onChanged()
  }

  // ---- tree ----
  if (lab.role === 'champ' || lab.role === 'chapitre') {
    return <Tree ideaId={ideaId} lab={lab} isAdmin={isAdmin} onOpen={onOpen} onChanged={onChanged} errText={errText} />
  }

  // ---- grid (read) ----
  const cellText = (a: LabAssessment | undefined) => {
    if (!a) return null
    return `${LAB_SIGN_MARK[a.sign]}${a.score != null ? ` ${a.score}/5` : ''}`
  }
  const find = (c: LabCriterion, s: LabSource) => lab.assessments.find((a) => a.criterion === c && a.source === s)

  const gridRead = narrow ? (
    <div style={{ display: 'grid', gap: 8 }}>
      {LAB_CRITERIA.map((c) => (
        <div key={c} style={box}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{tt(`lab_crit_${c}`)}</div>
          {SOURCES.map((s) => {
            const a = find(c, s)
            return (
              <div key={s} style={{ fontSize: 14 }}>
                <span style={{ color: 'var(--tx3)' }}>{tt(`lab_col_${s}`)} · </span>
                {a ? cellText(a) : t('lab_empty_cell')}
                {a?.note ? <div style={small}>{a.note}</div> : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  ) : (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed' }}>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>
          <th style={{ padding: '4px 6px', width: '46%' }}>{t('lab_grid')}</th>
          {SOURCES.map((s) => <th key={s} style={{ padding: '4px 6px' }}>{tt(`lab_col_${s}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {LAB_CRITERIA.map((c) => (
          <tr key={c} style={{ borderTop: '1px solid var(--bd)' }}>
            <td style={{ padding: '6px', overflowWrap: 'anywhere' }}>{tt(`lab_crit_${c}`)}</td>
            {SOURCES.map((s) => {
              const a = find(c, s)
              return (
                <td key={s} style={{ padding: '6px' }} title={a?.note ?? undefined}>
                  {a ? cellText(a) : t('lab_empty_cell')}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )

  // ---- edit form ----
  const patch = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d))
  const setCell = (c: LabCriterion, s: LabSource, p: Partial<Cell>) =>
    patch((d) => {
      const prev = d.grid[cellKey(c, s)] ?? { sign: '', score: '', note: '', sourceRef: '' }
      return { ...d, grid: { ...d.grid, [cellKey(c, s)]: { ...prev, ...p } } }
    })
  const iconBtn: CSSProperties = { minWidth: 44, minHeight: 44 }

  const rowTools = (i: number, len: number, onMove: (d: -1 | 1) => void, onRemove: () => void) => (
    <div style={{ display: 'flex', gap: 4 }}>
      <button type="button" className="btn ghost sm" style={iconBtn} aria-label={t('lab_up')} disabled={i === 0} onClick={() => onMove(-1)}>↑</button>
      <button type="button" className="btn ghost sm" style={iconBtn} aria-label={t('lab_down')} disabled={i === len - 1} onClick={() => onMove(1)}>↓</button>
      <button type="button" className="btn ghost sm" style={iconBtn} aria-label={t('lab_remove')} onClick={onRemove}>✕</button>
    </div>
  )

  const signChips = (value: LabSign | '', onPick: (s: LabSign | '') => void) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(['', ...LAB_SIGNS] as const).map((s) => (
        <button
          key={s || 'none'}
          type="button"
          aria-pressed={value === s}
          aria-label={s ? tt(`lab_sign_${s}`) : t('lab_sign_none')}
          title={s ? tt(`lab_sign_${s}`) : t('lab_sign_none')}
          onClick={() => onPick(s)}
          style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: `1px solid ${value === s ? 'var(--ac)' : 'var(--bd2)'}`, background: 'none', color: value === s ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer', fontSize: 15 }}
        >
          {s ? LAB_SIGN_MARK[s] : '∅'}
        </button>
      ))}
    </div>
  )

  const scoreSelect = (value: string, onPick: (v: string) => void) => (
    <select className="input" aria-label={t('lab_f_score')} value={value} onChange={(e) => onPick(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 72 }}>
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}/5</option>)}
    </select>
  )

  const editForm = draft ? (
    <div style={{ display: 'grid', gap: 10 }}>
      {lab.role === 'recette' ? (
        <>
          <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
            {t('lab_f_version')}
            <input className="input" type="number" inputMode="numeric" value={draft.version} onChange={(e) => patch((d) => ({ ...d, version: e.target.value }))} style={{ ...inp, maxWidth: 120 }} />
          </label>
          <h4 style={h3}>{t('lab_ingredients')}</h4>
          {draft.ings.map((r, i) => (
            <div key={i} style={box}>
              <input className="input" aria-label={t('lab_f_label')} placeholder={r.src.stockName ?? t('lab_f_label')} value={r.label} onChange={(e) => patch((d) => ({ ...d, ings: d.ings.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) }))} style={inp} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                <input className="input" aria-label={t('lab_f_amount')} placeholder={t('lab_f_amount')} inputMode="decimal" value={r.amount} onChange={(e) => patch((d) => ({ ...d, ings: d.ings.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)) }))} style={inp} />
                <input className="input" aria-label={t('lab_f_unit')} placeholder={t('lab_f_unit')} value={r.unit} onChange={(e) => patch((d) => ({ ...d, ings: d.ings.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)) }))} style={inp} />
                <input className="input" aria-label={t('lab_f_ratio')} placeholder={t('lab_f_ratio')} inputMode="decimal" value={r.ratio} onChange={(e) => patch((d) => ({ ...d, ings: d.ings.map((x, k) => (k === i ? { ...x, ratio: e.target.value } : x)) }))} style={inp} />
              </div>
              <input className="input" aria-label={t('lab_f_note')} placeholder={t('lab_f_note')} value={r.note} onChange={(e) => patch((d) => ({ ...d, ings: d.ings.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)) }))} style={inp} />
              {rowTools(i, draft.ings.length, (dir) => patch((d) => ({ ...d, ings: move(d.ings, i, dir) })), () => patch((d) => ({ ...d, ings: d.ings.filter((_, k) => k !== i) })))}
            </div>
          ))}
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => patch((d) => ({ ...d, ings: [...d.ings, { src: { stockItemId: null, stockName: null, label: null, amount: null, unit: null, ratioPct: null, note: null }, label: '', amount: '', unit: '', ratio: '', note: '' }] }))}>{t('lab_add_ingredient')}</button>

          <h4 style={h3}>{t('lab_steps')}</h4>
          {draft.steps.map((r, i) => (
            <div key={i} style={box}>
              <textarea className="input" aria-label={t('lab_f_body')} rows={2} value={r.body} onChange={(e) => patch((d) => ({ ...d, steps: d.steps.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)) }))} style={{ ...inp, minHeight: 64 }} />
              <input className="input" aria-label={t('lab_f_duration')} placeholder={t('lab_f_duration')} value={r.duration} onChange={(e) => patch((d) => ({ ...d, steps: d.steps.map((x, k) => (k === i ? { ...x, duration: e.target.value } : x)) }))} style={inp} />
              <input className="input" aria-label={t('lab_f_warning')} placeholder={t('lab_f_warning')} value={r.warning} onChange={(e) => patch((d) => ({ ...d, steps: d.steps.map((x, k) => (k === i ? { ...x, warning: e.target.value } : x)) }))} style={inp} />
              {rowTools(i, draft.steps.length, (dir) => patch((d) => ({ ...d, steps: move(d.steps, i, dir) })), () => patch((d) => ({ ...d, steps: d.steps.filter((_, k) => k !== i) })))}
            </div>
          ))}
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => patch((d) => ({ ...d, steps: [...d.steps, { src: { body: '', duration: null, equipmentId: null, equipmentName: null, warning: null }, body: '', duration: '', warning: '' }] }))}>{t('lab_add_step')}</button>
        </>
      ) : null}

      <h4 style={h3}>{t('lab_grid')}</h4>
      {LAB_CRITERIA.map((c) => (
        <div key={c} style={box}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{tt(`lab_crit_${c}`)}</div>
          {SOURCES.map((s) => {
            const cell = draft.grid[cellKey(c, s)] ?? { sign: '', score: '', note: '', sourceRef: '' }
            return (
              <div key={s} style={{ display: 'grid', gap: 6, borderTop: '1px dashed var(--bd)', paddingTop: 6 }}>
                <div style={small}>{tt(`lab_col_${s}`)}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {signChips(cell.sign, (sg) => setCell(c, s, { sign: sg }))}
                  {scoreSelect(cell.score, (v) => setCell(c, s, { score: v }))}
                </div>
                <input className="input" aria-label={t('lab_f_note')} placeholder={t('lab_f_note')} value={cell.note} onChange={(e) => setCell(c, s, { note: e.target.value })} style={inp} />
                {s === 'literature' ? (
                  <input className="input" aria-label={t('lab_f_source')} placeholder={t('lab_f_source')} value={cell.sourceRef} onChange={(e) => setCell(c, s, { sourceRef: e.target.value })} style={inp} />
                ) : null}
              </div>
            )
          })}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => void save()} data-testid="lab-save" style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>{t('lab_save')}</button>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={cancelEdit} style={{ minHeight: 44 }}>{t('lab_cancel')}</button>
      </div>
    </div>
  ) : null

  // ---- card (read) ----
  const card = (
    <div style={{ display: 'grid', gap: 4 }}>
      {lab.role === 'recette' ? (
        <>
          {lab.version != null ? <div style={{ fontSize: 13, color: 'var(--tx2)', fontWeight: 600 }}>{t('lab_version').replace('{n}', String(lab.version))}</div> : null}
          <h4 style={h3}>{t('lab_ingredients')}</h4>
          {lab.ingredients.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2, fontSize: 14.5 }}>
              {lab.ingredients.map((r, i) => (
                <li key={i}>
                  {r.stockName ?? r.label ?? '—'}
                  {r.amount != null ? ` · ${r.amount}${r.unit ? ` ${r.unit}` : ''}` : ''}
                  {r.ratioPct != null ? ` · ${r.ratioPct} %` : ''}
                  {r.note ? <span style={small}> — {r.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : <div style={small}>{t('lab_no_ingredients')}</div>}
          <h4 style={h3}>{t('lab_steps')}</h4>
          {lab.steps.length ? (
            <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 4, fontSize: 14.5 }}>
              {lab.steps.map((s, i) => (
                <li key={i} style={{ overflowWrap: 'anywhere' }}>
                  {s.body}
                  {s.duration ? <span style={small}> · {s.duration}</span> : null}
                  {s.equipmentName ? <div style={small}>🛠 {s.equipmentName}</div> : null}
                  {s.warning ? <div style={{ ...small, color: 'var(--rust, var(--ko))' }}>⚠ {s.warning}</div> : null}
                </li>
              ))}
            </ol>
          ) : <div style={small}>{t('lab_no_steps')}</div>}
        </>
      ) : null}
      <h4 style={h3}>{t('lab_grid')}</h4>
      {gridRead}
    </div>
  )

  const trialSheet = trialOpen ? (
    <TrialSheet
      recipeId={ideaId}
      onClose={() => setTrialOpen(false)}
      onDone={() => {
        setTrialOpen(false)
        onChanged()
      }}
    />
  ) : null

  return (
    <section data-testid="lab-panel" style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 12, margin: '10px 0', background: 'var(--bg1)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{tt(`lab_role_${lab.role}`)}</span>
        {isAdmin ? <button type="button" className="btn sm" data-testid="lab-trial" onClick={() => setTrialOpen(true)} style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>{t('lab_trial')}</button> : null}
        {canEdit && !draft ? <button type="button" className="btn ghost sm" data-testid="lab-edit" onClick={startEdit} style={{ minHeight: 44 }}>{t('lab_edit')}</button> : null}
      </div>
      {draft ? editForm : card}
      {trialSheet}
    </section>
  )
}

function Tree({ ideaId, lab, isAdmin, onOpen, onChanged, errText }: {
  ideaId: string
  lab: LabDesk
  isAdmin: boolean
  onOpen: (id: string) => void
  onChanged: () => void
  errText: (code: string) => string
}) {
  const { t } = useI18n()
  const tt = t as unknown as (k: string) => string
  const [adding, setAdding] = useState<LabRole | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function plant(role: LabRole) {
    if (!title.trim()) return
    setBusy(true)
    const res = await plantLabIdea({ parentId: ideaId, title, role })
    setBusy(false)
    if ('error' in res) {
      toast.error(errText(res.error))
      return
    }
    setTitle('')
    setAdding(null)
    onChanged()
    onOpen(res.conceptId)
  }

  return (
    <section data-testid="lab-tree" style={{ margin: '10px 0', minWidth: 0 }}>
      {LAB_CHILD_ROLES.map((role) => {
        const kids = lab.children.filter((c) => c.role === role)
        if (!kids.length && !isAdmin) return null
        return (
          <div key={role}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h4 style={{ ...h3, flex: 1, margin: '10px 0 2px' }}>{tt(`lab_role_${role}`)}</h4>
              {isAdmin ? (
                <button type="button" className="btn ghost sm" aria-label={t('lab_add_aria').replace('{role}', tt(`lab_role_${role}`))} onClick={() => { setAdding(adding === role ? null : role); setTitle('') }} style={{ minWidth: 44, minHeight: 44 }}>+</button>
              ) : null}
            </div>
            {adding === role ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" aria-label={t('lab_plant_title')} placeholder={t('lab_plant_title')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void plant(role) }} style={{ ...inp, flex: 1 }} />
                <button type="button" className="btn sm" disabled={busy || !title.trim()} onClick={() => void plant(role)} style={{ minHeight: 44, flex: 'none', ...(title.trim() ? MAIN_ACTION_STYLE : {}) }}>{t('lab_plant')}</button>
              </div>
            ) : null}
            <ul style={{ margin: 0, padding: 0 }}>
              {kids.map((k) => <PhoneListRow key={k.id} title={k.title} onClick={() => onOpen(k.id)} testId={`lab-child-${k.id}`} />)}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function TrialSheet({ recipeId, onClose, onDone }: { recipeId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const tt = t as unknown as (k: string) => string
  const [body, setBody] = useState('')
  const [criterion, setCriterion] = useState<LabCriterion | ''>('')
  const [sign, setSign] = useState<LabSign | ''>('')
  const [score, setScore] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!body.trim()) return
    setBusy(true)
    const res = await addTrial({ recipeId, body, criterion: criterion || null, sign: criterion && sign ? sign : null, score: score ? Number(score) : null })
    setBusy(false)
    if ('error' in res) {
      const code = res.error
      if (code === 'label_failed') toast.error(t('lab_trial_label_failed'))
      else if (code.startsWith('grid:')) toast.error(t('lab_trial_grid_failed'))
      else toast.error(KNOWN_ERR.includes(code) ? tt(`lab_err_${code}`) : code)
      // The entry is kept in those two cases: refresh so the screen shows it.
      if (code === 'label_failed' || code.startsWith('grid:')) onDone()
      return
    }
    toast.success(t('lab_trial_saved'))
    onDone()
  }

  return (
    <PhoneSheet
      title={t('lab_trial_title')}
      onClose={onClose}
      testId="lab-trial-sheet"
      footer={<button type="button" className="btn" disabled={busy || !body.trim()} onClick={() => void submit()} style={{ width: '100%', minHeight: 48, ...(body.trim() ? MAIN_ACTION_STYLE : {}) }}>{t('lab_save')}</button>}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <textarea className="input" aria-label={t('lab_trial_body')} placeholder={t('lab_trial_body')} rows={4} value={body} onChange={(e) => setBody(e.target.value)} style={{ ...inp, minHeight: 100, fontSize: 16 }} />
        <select className="input" aria-label={t('lab_trial_criterion')} value={criterion} onChange={(e) => setCriterion(e.target.value as LabCriterion | '')} style={inp}>
          <option value="">{t('lab_trial_none')}</option>
          {LAB_CRITERIA.map((c) => <option key={c} value={c}>{tt(`lab_crit_${c}`)}</option>)}
        </select>
        {criterion ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {LAB_SIGNS.map((s) => (
              <button key={s} type="button" aria-pressed={sign === s} aria-label={tt(`lab_sign_${s}`)} title={tt(`lab_sign_${s}`)} onClick={() => setSign(sign === s ? '' : s)} style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: `1px solid ${sign === s ? 'var(--ac)' : 'var(--bd2)'}`, background: 'none', color: sign === s ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer', fontSize: 15 }}>
                {LAB_SIGN_MARK[s]}
              </button>
            ))}
            <select className="input" aria-label={t('lab_f_score')} value={score} onChange={(e) => setScore(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 72 }}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}/5</option>)}
            </select>
          </div>
        ) : null}
      </div>
    </PhoneSheet>
  )
}
