'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import type { Oeuvre } from '@/lib/types/database'
import { thumbUrl } from '@/lib/data'
import { assignWorksToExhibitionContact } from '@/app/atelier/(portal)/exhibitions/actions'
import { useI18n } from '@/lib/i18n/context'
import { ExhibitionStepsPanel } from './ExhibitionStepsPanel'
import { ExhibitionFloorPlanEditor } from './ExhibitionFloorPlanEditor'
import { StepPill } from './StepPill'
import { CalendarExportStrip } from './CalendarExportStrip'
import { FloorPlanTool } from './FloorPlanTool'
import {
  type Step, type Exhibition, type ExhibitionContact,
  STATUT_COLORS, STATUT_LABELS, STEP_COLORS, inputSt, fmtDate,
} from './exhibitions-types'

// ── ExhibitionDetail ──────────────────────────────────────────────────────────

export function ExhibitionDetail({ exhibition, oeuvres, contacts, themes, tM, selection, setSelection, onDelete, onUpdate }: {
  exhibition:   Exhibition
  oeuvres:      Oeuvre[]
  contacts:     ExhibitionContact[]
  themes:       { id: number; name: string }[]
  tM:           Record<number, string>
  selection:    Set<number>
  setSelection: (s: Set<number>) => void
  onDelete:     () => void
  onUpdate:     (p: Partial<Exhibition> & { _isEditing?: boolean }) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'overview' | 'works' | 'floorplan' | 'calendar'>('overview')

  const contact     = contacts.find((c) => c.ContactID === exhibition.contact_id)
  const contactName = contact
    ? (contact.NomInstitution ?? [contact.Prénom, contact.Nom].filter(Boolean).join(' ') ?? '—')
    : '—'

  const stepsTotal = exhibition.steps.length
  const stepsDone  = exhibition.steps.filter((s) => s.statut === 'fait').length
  const pct        = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0

  const linkedWorks = useMemo(() => {
    if (!exhibition.contact_id) return []
    return oeuvres.filter((o) => o.ContactID === exhibition.contact_id)
  }, [oeuvres, exhibition.contact_id])

  const TABS = [
    { id: 'overview'  as const, label: t('exhibition_tab_overview') },
    { id: 'calendar'  as const, label: t('exhibition_tab_calendar') },
    { id: 'works'     as const, label: t('exhibition_tab_works_label').replace('{n}', String(linkedWorks.length)) },
    { id: 'floorplan' as const, label: t('exhibition_tab_floorplan') },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--tx)' }}>{exhibition.nom}</div>
              <button onClick={onDelete} className="btn ghost sm" style={{ color: 'var(--rust)', fontSize: 11, borderColor: 'var(--rust)', opacity: 0.8 }}>{t('exh_delete_exhibition')}</button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--tx3)', flexWrap: 'wrap' }}>
              {contact && <span>📍 {contactName}</span>}
              {contact?.Email && <span title={contact.Email}>✉️ {contact.Email}</span>}
              {contact?.Tel && <span title={contact.Tel}>📞 {contact.Tel}</span>}
              {exhibition.localisation && <span>🗺 {exhibition.localisation}</span>}
              {exhibition.date_debut && <span>Du {fmtDate(exhibition.date_debut)}</span>}
              {exhibition.date_fin && <span>au {fmtDate(exhibition.date_fin)}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <select
              value={exhibition.statut}
              onChange={(e) => onUpdate({ statut: e.target.value })}
              style={{
                background: `${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}22`,
                color: STATUT_COLORS[exhibition.statut] ?? 'var(--tx3)',
                border: `1px solid ${STATUT_COLORS[exhibition.statut] ?? 'var(--bd)'}`,
                padding: '4px 12px', fontSize: 11, letterSpacing: 1,
                textTransform: 'uppercase', borderRadius: 2, outline: 'none', cursor: 'pointer',
              }}
            >
              {Object.entries(STATUT_LABELS).map(([k, v]) => (
                <option key={k} value={k} style={{ background: 'var(--bg1)', color: 'var(--tx)' }}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4caf82' : 'var(--ac)', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', flexShrink: 0 }}>{stepsDone}/{stepsTotal} étapes</div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '8px 18px', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--ac)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'floorplan' ? 'none' : 'block', overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <ExhibitionStepsPanel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              {/* Steps Management */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>Étapes</div>
                  <button
                    onClick={() => {
                      const newStep: Step = { id: `s${Date.now()}`, process_id: exhibition.id, nom: 'Nouvelle étape', statut: 'a_faire', date_echeance: null, position: exhibition.steps.length, notes: null, overdue_override: false }
                      onUpdate({ steps: [...exhibition.steps, newStep] })
                    }}
                    className="btn sm" style={{ fontSize: 11, padding: '4px 10px' }}>+ Ajouter</button>
                </div>

                {exhibition.steps.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--tx3)', fontStyle: 'italic' }}>{t('exh_no_steps_defined')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {exhibition.steps.map((s) => (
                      <StepPill
                        key={s.id}
                        step={s}
                        onToggle={(id, next) => {
                          onUpdate({ steps: exhibition.steps.map(sx => sx.id === id ? { ...sx, statut: next } : sx) })
                        }}
                        onRename={(id, name) => {
                          onUpdate({ steps: exhibition.steps.map(sx => sx.id === id ? { ...sx, nom: name } : sx) })
                        }}
                        onDelete={(id) => {
                          if (confirm(t('exhib_step_delete_confirm'))) {
                            onUpdate({ steps: exhibition.steps.filter(sx => sx.id !== id) })
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 16, fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>
                  Double-cliquez sur un nom pour le modifier. Cliquez sur le cercle pour changer le statut.
                </div>
              </div>

              {/* Info Editing */}
              <div style={{ borderLeft: '1px solid var(--bg2)', paddingLeft: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)' }}>Infos</div>
                  <button
                    onClick={() => onUpdate({ _isEditing: !exhibition['_isEditing' as keyof Exhibition] })}
                    className="btn sm" style={{ fontSize: 11, padding: '4px 10px' }}>
                    {exhibition['_isEditing' as keyof Exhibition] ? 'Terminer' : 'Éditer'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Type',  key: 'type',         val: exhibition.type },
                    { label: 'Lieu',  key: 'localisation', val: exhibition.localisation },
                    { label: 'URL',   key: 'url',          val: exhibition.url },
                    { label: 'Début', key: 'date_debut',   val: exhibition.date_debut, type: 'date' },
                    { label: 'Fin',   key: 'date_fin',     val: exhibition.date_fin,   type: 'date' },
                  ].map((field) => (
                    <div key={field.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 80, flexShrink: 0, color: 'var(--tx3)', fontSize: 12 }}>{field.label}</div>
                      {exhibition['_isEditing' as keyof Exhibition] ? (
                        <input
                          type={field.type || 'text'}
                          value={field.val ?? ''}
                          onChange={(e) => onUpdate({ [field.key]: e.target.value || null })}
                          style={{ ...inputSt, flex: 1, fontSize: 13, padding: '6px 10px' }}
                        />
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {field.key === 'url' && field.val ? (
                            <a href={field.val} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>{field.val}</a>
                          ) : (
                            field.type === 'date' ? fmtDate(field.val) : (field.val ?? '—')
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 60, flexShrink: 0, color: 'var(--tx3)', fontSize: 10 }}>Contact</div>
                    {exhibition['_isEditing' as keyof Exhibition] ? (
                      <select
                        value={exhibition.contact_id ?? ''}
                        onChange={(e) => onUpdate({ contact_id: Number(e.target.value) || null })}
                        style={{ ...inputSt, flex: 1, fontSize: 10, padding: '4px 8px' }}
                      >
                        <option value="">— Aucun —</option>
                        {contacts.map(c => (
                          <option key={c.ContactID} value={c.ContactID}>
                            {c.NomInstitution || [c.Prénom, c.Nom].filter(Boolean).join(' ') || `#${c.ContactID}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--tx)' }}>{contactName}</div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }}>Notes</div>
                  {exhibition['_isEditing' as keyof Exhibition] ? (
                    <textarea
                      value={exhibition.notes ?? ''}
                      onChange={(e) => onUpdate({ notes: e.target.value || null })}
                      rows={4}
                      style={{ ...inputSt, fontSize: 10, resize: 'vertical' }}
                    />
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--tx)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{exhibition.notes ?? '—'}</div>
                  )}
                </div>
              </div>
            </div>
          </ExhibitionStepsPanel>
        )}

        {activeTab === 'calendar' && (
          <div style={{ padding: 24 }}>
            <CalendarExportStrip exhibition={exhibition} />
            <div style={{ position: 'relative', borderLeft: '1px solid var(--bd)', paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {exhibition.date_debut && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 2, width: 9, height: 9, borderRadius: '50%', background: 'var(--ac)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('exh_calendar_start_label')}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{fmtDate(exhibition.date_debut)}</div>
                </div>
              )}
              {exhibition.steps.slice().sort((a,b) => (a.date_echeance ?? '').localeCompare(b.date_echeance ?? '')).map(s => (
                <div key={s.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 4, width: 9, height: 9, borderRadius: '50%', background: STEP_COLORS[s.statut] ?? 'var(--bd)', border: '2px solid var(--bg1)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.statut === 'fait' ? t('exh_step_status_done') : s.statut === 'en_cours' ? t('exh_step_status_in_progress') : t('exh_step_status_todo')}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx)', marginBottom: 2 }}>{s.nom}</div>
                  {s.date_echeance && <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{t('exh_step_deadline_label')} {fmtDate(s.date_echeance)}</div>}
                </div>
              ))}
              {exhibition.date_fin && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -29, top: 2, width: 9, height: 9, borderRadius: '50%', background: 'var(--tx3)' }} />
                  <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('exh_calendar_end_label')}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{fmtDate(exhibition.date_fin)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'works' && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--tx2)' }}>
                {linkedWorks.length} œuvre{linkedWorks.length !== 1 ? 's' : ''} liée{linkedWorks.length !== 1 ? 's' : ''}
              </div>
              {selection.size > 0 && (
                <button
                  className="btn primary sm"
                  onClick={async () => {
                    if (!exhibition.contact_id) { alert(t('exhib_link_contact_first')); return }
                    const ids = Array.from(selection)
                    const result = await assignWorksToExhibitionContact({ oeuvreIds: ids, contactId: exhibition.contact_id })
                    if ('ok' in result) {
                      alert(t('exhib_works_linked_count_fmt').replace('{n}', String(ids.length)))
                      window.location.reload()
                    }
                  }}
                >
                  Ajouter la sélection ({selection.size})
                </button>
              )}
            </div>
            {linkedWorks.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--tx3)', fontStyle: 'italic' }}>
                Aucune œuvre liée à ce contact pour le moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {linkedWorks.map((o) => {
                  const thumb = thumbUrl(o.txtImageNameLink)
                  return (
                    <div key={o.OeuvreID} style={{ width: 120, flexShrink: 0 }}>
                      <div style={{ width: 120, height: 120, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden', position: 'relative' }}>
                        {thumb
                          ? <Image src={thumb} alt={o.Titre ?? ''} fill sizes="120px" style={{ objectFit: 'cover' }} />
                          : <span style={{ fontSize: 9, color: 'var(--tx3)' }}>#{o.OeuvreID}</span>}
                      </div>
                      {o.anonymity_level === 2 && (
                        <div style={{
                          fontSize: 8, background: 'rgba(200,140,40,0.12)',
                          border: '1px solid rgba(200,140,40,0.5)', color: '#c88a20',
                          padding: '1px 5px', borderRadius: 2, marginBottom: 3,
                        }}>⚠ Non public</div>
                      )}
                      <div style={{ fontSize: 9, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.Titre ?? 'S/T'}</div>
                      <div style={{ fontSize: 8, color: 'var(--tx3)' }}>#{o.OeuvreID}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floor plan — outside scroll container so it can fill remaining height */}
      {activeTab === 'floorplan' && (
        <ExhibitionFloorPlanEditor>
          <FloorPlanTool exhibitionId={exhibition.id} oeuvres={oeuvres} themes={themes} tM={tM} />
        </ExhibitionFloorPlanEditor>
      )}
    </div>
  )
}
