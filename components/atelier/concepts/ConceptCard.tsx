'use client'

import { useState, useRef } from 'react'
import { updateConcept, deleteConcept, uploadConceptSketch, type ConceptRow, type IdeaLine } from '@/app/atelier/(portal)/concepts/actions'
import { convertConceptToProcess, type PipelineProcessType } from '@/app/atelier/(portal)/pipeline/actions'
import { TYPE_LABELS, pipelineTypeLabel, type ProcessType } from '@/components/atelier/pipeline/pipeline-shared'
import { useI18n } from '@/lib/i18n/context'
import { stringifyError } from '@/lib/error'
import { imageUrl } from '@/lib/data'
import { toast } from '@/lib/ui/toast'
import { CATEGORY_IDS, CATEGORY_KEYS, IDEA_MATURITIES, IDEA_WEIGHTS, MEDIUM_IDS, MEDIUM_KEY, STATUT_COLORS, STATUT_KEYS, type IdeaMaturity, type IdeaWeight } from './concept-constants'
import { MATURITY_KEY, MaturityMark, WEIGHT_KEY } from './IdeaMarks'
import { IdeaDiscussion } from './IdeaDiscussion'
import { ConceptDocuments } from './ConceptDocuments'
import { LinkedVoiceNotes } from '@/components/atelier/LinkedVoiceNotes'
import { inputSt, labelSt } from './concept-form-styles'
import type { ConceptDocument } from '@/app/atelier/(portal)/concepts/document-actions'

// R1 Idées: the team reads an idea and adds lines to its discussion; only Pem (admin) edits it,
// sets its weight (Petite / Recherche) and maturity (Graine · Pousse · Mûre), or closes the discussion.
export function ConceptCard({ concept, documents, lines, isAdmin, onUpdated, onDeleted, onLineAdded, narrow }: {
  concept:   ConceptRow
  documents: ConceptDocument[]
  lines:     IdeaLine[]
  isAdmin:   boolean
  onUpdated: (c: ConceptRow) => void
  onDeleted: (id: string) => void
  onLineAdded: (line: IdeaLine) => void
  narrow: boolean
}) {
  const { lang, t } = useI18n()
  const dateLoc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [busy,     setBusy]     = useState(false)
  const [skBusy,  setSkBusy]   = useState(false)

  const [titre,       setTitre]      = useState(concept.titre)
  const [description, setDesc]       = useState(concept.description ?? '')
  const [medium,      setMedium]     = useState(concept.medium ?? '')
  const [themesStr,   setThemesStr]  = useState((concept.themes ?? []).join(', '))
  const [statut,      setStatut]     = useState(concept.statut)
  const [weight,      setWeight]     = useState<IdeaWeight>(concept.weight)
  const [maturity,    setMaturity]   = useState<IdeaMaturity>(concept.maturity)
  const [imageNote,   setImageNote]  = useState(concept.image_note ?? '')
  const [notes,       setNotes]      = useState(concept.notes ?? '')
  const [category,    setCategory]   = useState(concept.category ?? 'artistic')
  const [showConvert, setShowConvert] = useState(false)
  const [targetType,  setTargetType]  = useState('exposition')
  const fileRef = useRef<HTMLInputElement>(null)

  async function save() {
    setBusy(true)
    const themes = themesStr ? themesStr.split(',').map((x) => x.trim()).filter(Boolean) : null
    const res = await updateConcept(concept.id, {
      titre:       titre.trim() || 'Sans titre',
      description: description.trim() || null,
      medium:      medium || null,
      themes,
      statut,
      weight,
      maturity,
      image_note:  imageNote.trim() || null,
      notes:       notes.trim() || null,
      category,
    })
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error === 'admin' ? t('ideas_admin_only') : t('ideas_err').replace('{e}', stringifyError(res.error)))
      return
    }
    if ('ok' in res) {
      toast.success(t('saveDoneUndoHint'))
      onUpdated({
        ...concept,
        titre:       titre.trim() || 'Sans titre',
        description: description.trim() || null,
        medium:      medium || null,
        themes:      themes,
        statut,
        weight,
        maturity,
        image_note:  imageNote.trim() || null,
        notes:       notes.trim() || null,
        category:    category,
        updated_at:  new Date().toISOString(),
      })
      setEditing(false)
    }
  }

  /** Admin quick-set from the open card: one tap sets the weight or the maturity. */
  async function quickSet(patch: { weight: IdeaWeight } | { maturity: IdeaMaturity }) {
    setBusy(true)
    const res = await updateConcept(concept.id, patch)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error === 'admin' ? t('ideas_admin_only') : t('ideas_err').replace('{e}', stringifyError(res.error)))
      return
    }
    if ('weight' in patch) setWeight(patch.weight)
    if ('maturity' in patch) setMaturity(patch.maturity)
    onUpdated({ ...concept, ...patch, updated_at: new Date().toISOString() })
  }

  async function onPickSketch(f: File | null) {
    if (!f) return
    setSkBusy(true)
    const fd = new FormData()
    fd.set('sketch', f)
    const res = await uploadConceptSketch(fd)
    setSkBusy(false)
    if ('error' in res) {
      toast.error(`${t('concept_convert_err')}: ${stringifyError(res.error)}`)
      return
    }
    setImageNote(res.storagePath)
    toast.success(t('concept_sketch_stored'))
  }

  async function handleConvert() {
    setBusy(true)
    const res = await convertConceptToProcess(concept.id, targetType as PipelineProcessType)
    setBusy(false)
    if ('ok' in res) {
      toast.success(t('concept_convert_ok'))
      onUpdated({ ...concept, statut: 'en_cours' })
      setShowConvert(false)
    } else {
      toast.error(`${t('concept_convert_err')}: ${stringifyError(res.error)}`)
    }
  }

  async function handleDelete() {
    if (!confirm(t('concept_delete_confirm'))) return
    setBusy(true)
    const res = await deleteConcept(concept.id)
    setBusy(false)
    if (res && 'error' in res) {
      toast.error(stringifyError(res.error))
    } else {
      onDeleted(concept.id)
    }
  }

  const isAbandoned  = concept.statut === 'abandonne'
  const isBecameWork = concept.statut === 'devenu_oeuvre'
  const catLabel = concept.category && CATEGORY_KEYS[concept.category as keyof typeof CATEGORY_KEYS]
    ? t(CATEGORY_KEYS[concept.category as keyof typeof CATEGORY_KEYS])
    : t('concept_cat_artistic')
  const gridCols = narrow ? '1fr' : '1fr 1fr'

  return (
    <div style={{
      border: '1px solid var(--bd)',
      borderLeft: `3px solid ${STATUT_COLORS[concept.statut] ?? 'var(--bd)'}`,
      background: 'var(--bg1)',
      opacity: isAbandoned ? 0.5 : 1,
      marginBottom: 8,
    }}>
      <div
        onClick={() => { setExpanded((x) => !x); setEditing(false) }}
        style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{ flexShrink: 0 }}><MaturityMark maturity={concept.maturity} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--tx)',
            textDecoration: isAbandoned ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {concept.titre}
          </div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span data-testid="idea-weight" style={{ color: 'var(--tx2)', fontWeight: 500 }}>{t(WEIGHT_KEY[concept.weight])}</span>
            <span>{t(MATURITY_KEY[concept.maturity])}</span>
            <span style={{ color: 'var(--ac)', fontWeight: 500 }}>{catLabel}</span>
            {lines.length > 0 && (
              <span data-testid="idea-lines-count">{lines.length === 1 ? t('ideas_lines_one') : t('ideas_lines_n').replace('{n}', String(lines.length))}</span>
            )}
            {concept.medium && <span>{concept.medium}</span>}
            {concept.themes?.length ? <span>{concept.themes.slice(0, 3).join(' · ')}</span> : null}
          </div>
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 1, padding: '2px 7px',
          border: `1px solid ${STATUT_COLORS[concept.statut] ?? 'var(--bd)'}`,
          color: STATUT_COLORS[concept.statut] ?? 'var(--tx3)',
          flexShrink: 0,
        }}>
          {t(`concept_status_${concept.statut}` as 'concept_status_idee')}
        </div>
        <div style={{ color: 'var(--tx3)', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--bd)', padding: '16px max(12px, env(safe-area-inset-right)) 12px max(12px, env(safe-area-inset-left))' }}>
          {editing ? (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>{t('concept_edit_title')}</label>
                <input style={inputSt} value={titre} onChange={(e) => setTitre(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>{t('status')}</label>
                <select style={inputSt} value={statut} onChange={(e) => setStatut(e.target.value)}>
                  {STATUT_KEYS.map((v) => (
                    <option key={v} value={v}>{t(`concept_status_${v}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('ideas_field_weight')}</label>
                <select style={inputSt} value={weight} onChange={(e) => setWeight(e.target.value as IdeaWeight)}>
                  {IDEA_WEIGHTS.map((w) => (
                    <option key={w} value={w}>{t(WEIGHT_KEY[w])}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('ideas_field_maturity')}</label>
                <select style={inputSt} value={maturity} onChange={(e) => setMaturity(e.target.value as IdeaMaturity)}>
                  {IDEA_MATURITIES.map((m) => (
                    <option key={m} value={m}>{t(MATURITY_KEY[m])}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('concept_field_medium')}</label>
                <select style={inputSt} value={medium} onChange={(e) => setMedium(e.target.value)}>
                  <option value="">—</option>
                  {MEDIUM_IDS.map((id) => (
                    <option key={id} value={id}>{t(MEDIUM_KEY[id] ?? 'concept_med_autre')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('concept_field_themes')}</label>
                <input style={inputSt} value={themesStr} onChange={(e) => setThemesStr(e.target.value)} placeholder={t('concept_ph_themes')} />
              </div>
              <div>
                <label style={labelSt}>{t('concept_field_category')}</label>
                <select style={inputSt} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORY_IDS.map((id) => (
                    <option key={id} value={id}>{t(CATEGORY_KEYS[id])}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>{t('concept_field_desc')}</label>
                <textarea style={{ ...inputSt, height: 80, resize: 'vertical' }}
                  value={description} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>{t('concept_field_visual')}</label>
                <input style={inputSt} value={imageNote} onChange={(e) => setImageNote(e.target.value)} />
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
                  onChange={(e) => { void onPickSketch(e.target.files?.[0] ?? null); e.target.value = '' }} />
                <button type="button" className="btn ghost sm" style={{ marginTop: 8, minHeight: 44 }} disabled={skBusy}
                  onClick={() => fileRef.current?.click()}>
                  {skBusy ? t('concept_sketch_uploading') : t('concept_sketch_btn')}
                </button>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>{t('concept_view_notes')}</label>
                <textarea style={{ ...inputSt, height: 64, resize: 'vertical' }}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="row gap-sm" style={{ gridColumn: '1 / -1', marginTop: 4, flexWrap: 'wrap' }}>
                <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void save()} disabled={busy}>
                  {busy ? t('concept_edit_saving') : t('concept_edit_save')}
                </button>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setEditing(false)}>{t('concept_edit_cancel')}</button>
              </div>
            </div>
          ) : (
            <div>
              {concept.description && (
                <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                  {concept.description}
                </div>
              )}
              {isAdmin ? (
                <div data-testid="idea-quickset" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  {([
                    ['ideas_field_weight', IDEA_WEIGHTS.map((w) => [w, t(WEIGHT_KEY[w]), concept.weight === w, () => void quickSet({ weight: w })] as const)],
                    ['ideas_field_maturity', IDEA_MATURITIES.map((m) => [m, t(MATURITY_KEY[m]), concept.maturity === m, () => void quickSet({ maturity: m })] as const)],
                  ] as const).map(([labelKey, opts]) => (
                    <div key={labelKey} role="group" aria-label={t(labelKey)}>
                      <div style={{ ...labelSt, marginBottom: 4 }}>{t(labelKey)}</div>
                      <div style={{ display: 'flex', border: '1px solid var(--bd)' }}>
                        {opts.map(([id, label, on, pick]) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={on}
                            disabled={busy}
                            onClick={pick}
                            style={{
                              minHeight: 44, minWidth: 64, padding: '0 10px', fontSize: 11, cursor: 'pointer',
                              border: 'none', borderRight: '1px solid var(--bd)',
                              background: on ? 'var(--bg2)' : 'transparent',
                              color: on ? 'var(--tx)' : 'var(--tx3)',
                              fontWeight: on ? 500 : 400,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                {!isAdmin && (
                  <>
                    <div>
                      <div style={{ ...labelSt, marginBottom: 2 }}>{t('ideas_field_weight')}</div>
                      <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{t(WEIGHT_KEY[concept.weight])}</div>
                    </div>
                    <div>
                      <div style={{ ...labelSt, marginBottom: 2 }}>{t('ideas_field_maturity')}</div>
                      <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{t(MATURITY_KEY[concept.maturity])}</div>
                    </div>
                  </>
                )}
                {concept.medium && (
                  <div>
                    <div style={{ ...labelSt, marginBottom: 2 }}>{t('concept_view_medium')}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{concept.medium}</div>
                  </div>
                )}
                {concept.themes?.length ? (
                  <div>
                    <div style={{ ...labelSt, marginBottom: 2 }}>{t('concept_view_themes')}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {concept.themes.map((th) => (
                        <span key={th} style={{
                          fontSize: 9, padding: '2px 6px',
                          border: '1px solid var(--bd)', color: 'var(--tx3)',
                        }}>{th}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {concept.image_note && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelSt}>{t('concept_view_visual')}</div>
                  {concept.image_note.startsWith('http') ? (
                    <a href={concept.image_note} target="_blank" rel="noreferrer"
                      style={{ fontSize: 10, color: 'var(--ac)', wordBreak: 'break-all' }}>
                      {concept.image_note}
                    </a>
                  ) : concept.image_note.startsWith('concepts/') ? (
                    <img src={imageUrl(concept.image_note) ?? ''} alt="" style={{ maxWidth: '100%', maxHeight: 220, border: '1px solid var(--bd)' }} />
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--tx2)', fontStyle: 'italic' }}>{concept.image_note}</div>
                  )}
                </div>
              )}

              {concept.notes && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelSt}>{t('concept_view_notes')}</div>
                  <div style={{ fontSize: 10, color: 'var(--tx2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {concept.notes}
                  </div>
                </div>
              )}

              <ConceptDocuments conceptId={concept.id} initialDocs={documents} canEdit={isAdmin} />
              <LinkedVoiceNotes field="concept_id" value={concept.id} />

              <IdeaDiscussion
                conceptId={concept.id}
                lines={lines}
                closedAt={concept.discussion_closed_at}
                isAdmin={isAdmin}
                onLineAdded={onLineAdded}
                onClosedChange={(closedAt) => onUpdated({ ...concept, discussion_closed_at: closedAt })}
              />

              {isBecameWork && concept.oeuvre_id && (
                <div style={{ marginBottom: 12, fontSize: 10, color: 'var(--sage)' }}>
                  {t('concept_view_became_work').replace('{id}', String(concept.oeuvre_id))}
                </div>
              )}

              <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 10 }}>
                {t('concept_view_created')} {new Date(concept.created_at).toLocaleDateString(dateLoc)}
                {concept.updated_at !== concept.created_at &&
                  ` · ${t('concept_view_updated')} ${new Date(concept.updated_at).toLocaleDateString(dateLoc)}`}
              </div>

              {isAdmin && <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setEditing(true)}>{t('concept_view_edit')}</button>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setShowConvert(!showConvert)}>{t('concept_view_pipeline')}</button>
                <button type="button" className="btn ghost sm" style={{ color: 'var(--rust)', minHeight: 44 }} onClick={() => void handleDelete()} disabled={busy}>
                  {t('concept_view_delete')}
                </button>
              </div>}

              {isAdmin && showConvert && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg2)', border: '1px solid var(--bd)' }}>
                  <div style={labelSt}>{t('concept_convert_heading')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select style={{ ...inputSt, flex: 1, minWidth: 0 }} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                      {(Object.keys(TYPE_LABELS) as ProcessType[])
                        .filter((typ) => typ !== 'vente')
                        .map((typ) => (
                          <option key={typ} value={typ}>{pipelineTypeLabel(typ, lang)}</option>
                        ))}
                    </select>
                    <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void handleConvert()} disabled={busy}>{t('concept_convert_go')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
