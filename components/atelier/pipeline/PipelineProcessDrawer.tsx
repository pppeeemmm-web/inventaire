'use client'

import { useCallback, useTransition } from 'react'
import { getSignedUrl } from '@/app/atelier/(portal)/vault/actions'
import { regenerateConsignmentPdf, closeConsignmentByPdfPath } from '@/app/atelier/consignments/actions'
import { AsyncButton } from '@/components/ui/AsyncButton'
import { toast } from '@/lib/ui/toast'
import {
  ETAPE_STATUT_COLORS,
  TYPE_COLORS,
  type EtapeStatut,
  type Process,
  type ProcessType,
} from '@/components/atelier/pipeline/pipeline-shared'
import { daysUntil } from '@/lib/pipeline-deadlines'
import {
  fmtDate,
  urgencyColor,
  useSuiviLabels,
} from '@/components/atelier/pipeline/pipeline-suivi-labels'

export type PipelineProcessDrawerProps = {
  process: Process
  onClose: () => void
  onEdit: () => void
  onRefresh: () => Promise<void>
  onCycleEtape: (id: string, current: EtapeStatut) => Promise<void>
  onOverdueOverride: (id: string, current: boolean) => Promise<void>
}

export function PipelineProcessDrawer({ process, onClose, onEdit, onRefresh, onCycleEtape, onOverdueOverride }: {
  process:Process; onClose:()=>void; onEdit:()=>void; onRefresh:()=>Promise<void>
  onCycleEtape:(id:string,current:EtapeStatut)=>Promise<void>
  onOverdueOverride:(id:string,current:boolean)=>Promise<void>
}) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const dateLocale = lang === 'en' ? 'en' : 'fr'
  const color = TYPE_COLORS[process.type as ProcessType]??'#888'
  const [regenPending, startRegen] = useTransition()
  const [closePending, startClose] = useTransition()
  const [downloadPending, startDownload] = useTransition()

  const openExhibitionProject = useCallback(() => {
    const id = process.exhibition_process_id
    if (!id) return
    window.location.assign(`/atelier/exhibitions?exhibition=${encodeURIComponent(id)}`)
  }, [process])

  function Row({label,value,href}:{label:string;value?:string|null;href?:string}) {
    if(!value) return null
    return (
      <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
        <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:140, flexShrink:0 }}>{label}</div>
        <div style={{ fontSize:13, wordBreak:'break-word' }}>
          {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color:'var(--ac)' }}>{value}</a> : value}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', right:0, top:0, bottom:0, width:400, zIndex:100, background:'var(--bg1)', borderLeft:'1px solid var(--bd)', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:18 }}>{process.nom}</div>
          <div style={{ fontSize:11, color, marginTop:4, textTransform:'uppercase', letterSpacing:'0.1em' }}>
            {typeLabel(process.type as ProcessType)} · {statutLabels[process.statut]}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {process.exhibition_process_id && (
            <button className="btn ghost sm" onClick={openExhibitionProject}>
              {t('pipeline_open_exhibition_project')}
            </button>
          )}
          <button className="btn ghost sm" onClick={onEdit}>{t('edit')}</button>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>
      </div>

      <Row label={t('pd_row_location')} value={process.localisation} />
      <Row label={t('pd_row_url')} value={process.url} href={process.url?.startsWith('http')?process.url:`https://${process.url}`} />
      {process.date_debut && <Row label={t('pd_row_start')} value={fmtDate(process.date_debut, undefined, dateLocale)} />}
      {process.date_fin   && (() => {
        const days = daysUntil(process.date_fin);
        const hasCompletedSameDay = process.etapes.some(e => e.statut === 'fait' && e.date_echeance === process.date_fin);
        const hasFutureSteps = process.etapes.some(e => e.statut !== 'fait' && e.date_echeance && daysUntil(e.date_echeance) >= 0);
        const isOverdue = days < 0 && !hasCompletedSameDay && !hasFutureSteps;
        const color = isOverdue ? '#c06060' : (days >= 0 ? urgencyColor(days) : 'var(--tx)');
        return (
          <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
            <div className="t-mono-sm" style={{ color:'var(--tx3)', minWidth:140, flexShrink:0 }}>{t('pd_row_deadline')}</div>
            <div style={{ fontSize:13, color, fontWeight:600 }}>
              {fmtDate(process.date_fin, process.deadline_time, dateLocale)}
              <span style={{ fontSize:11, fontWeight:400, marginLeft:6, color:'var(--tx3)' }}>
                {days >= 0
                  ? t('pd_deadline_in_days_paren').replace(/\{days\}/g, String(days))
                  : isOverdue
                    ? t('pd_deadline_overdue_paren').replace(/\{days\}/g, String(Math.abs(days)))
                    : t('pd_deadline_on_track')}
              </span>
            </div>
          </div>
        )
      })()}
      <Row label={t('pd_row_scope')} value={process.scope} />
      <Row label={t('pd_row_stakeholders')} value={process.stakeholders} />

      {process.responsables?.length > 0 && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_in_charge')}</div>
          {process.responsables.map((r,i)=>(
            <div key={i} style={{ fontSize:13, padding:'4px 0' }}>{r.nom} <span style={{ color:'var(--tx3)', fontSize:11 }}>· {r.role}</span></div>
          ))}
        </div>
      )}

      {process.vault_path && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_vault_folder')}</div>
          <a
            href={process.vault_path.startsWith('http') ? process.vault_path : `https://${process.vault_path}`}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:13, color:'var(--ac)', wordBreak:'break-all', display:'flex', alignItems:'center', gap:8 }}
          >
            <span style={{ fontSize:18 }}>📁</span>
            <span>{process.vault_path}</span>
          </a>
        </div>
      )}
      {process.vault_tags?.length > 0 && (
        <div style={{ padding:'8px 0', borderBottom:'1px solid var(--bd)' }}>
          <div className="t-mono-sm" style={{ color:'var(--tx3)', marginBottom:6 }}>{t('pd_assets_tags')}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {process.vault_tags.map(tag=>(
              <span key={tag} style={{ fontSize:11, padding:'3px 10px', border:'1px solid var(--bd)', color:'var(--tx3)' }}>{tag}</span>
            ))}
          </div>
        </div>
      )}
      {process.asset_notes && <Row label={t('pd_asset_notes')} value={process.asset_notes} />}

      {process.pdf_path && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.2)' }}>
          <div className="t-label" style={{ marginBottom: 8, color: 'var(--cyan)' }}>{t('pd_commercial_bond_pdf')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <AsyncButton
              pending={regenPending}
              pendingText={t('pd_operation_in_progress')}
              onClick={() => {
                if (!confirm(t('pd_confirm_regenerate_pdf'))) return
                startRegen(() => {
                  void (async () => {
                    try {
                      const res = await regenerateConsignmentPdf(process.id)
                      if (res.ok) {
                        toast.success(t('pd_pdf_updated_reload'))
                        await onRefresh()
                          } else toast.error(res.error ?? t('error'))
                    } catch (err) {
                      toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                    }
                  })()
                })
              }}
              className="btn ghost sm"
              style={{ flex: 1, fontSize: 12, border: '1px solid rgba(34,211,238,0.3)' }}
            >
              {t('pd_regenerate_pdf_btn')}
            </AsyncButton>
            <AsyncButton
              pending={downloadPending}
              pendingText={t('pd_operation_in_progress')}
              onClick={() => {
                startDownload(() => {
                  void (async () => {
                    try {
                      const res = await getSignedUrl(process.pdf_path!)
                      if ('url' in res) window.open(res.url, '_blank')
                      else toast.error(res.error ?? t('error'))
                    } catch (err) {
                      toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                    }
                  })()
                })
              }}
              className="btn primary sm"
              style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 10, padding: '8px 12px' }}
            >
              <span style={{ fontSize: 20 }}>↓</span>
              <span style={{ fontSize: 14 }}>{t('pd_download_pdf_btn')}</span>
            </AsyncButton>
          </div>
          {process.type === 'consignment' && (
            <div style={{ marginTop: 10 }}>
              <AsyncButton
                pending={closePending}
                pendingText={t('pd_operation_in_progress')}
                onClick={() => {
                  if (!confirm(t('pd_confirm_close_consignment'))) return
                  startClose(() => {
                    void (async () => {
                      try {
                        const res = await closeConsignmentByPdfPath(process.pdf_path!)
                        if ('ok' in res) {
                          let msg = t('pd_close_consignment_intro')
                          if (res.reverted.length > 0) {
                            msg += ` ${t('pd_consignment_reverted_line').replace(/\{n\}/g, String(res.reverted.length))}`
                          }
                          if (res.skipped.length > 0) {
                            msg += ` ${t('pd_consignment_skipped_line').replace(/\{n\}/g, String(res.skipped.length))}`
                          }
                          toast.success(msg.trim())
                          await onRefresh()
                        } else toast.error('error' in res ? res.error : t('error'))
                      } catch (err) {
                        toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                      }
                    })()
                  })
                }}
                className="btn ghost sm"
                style={{ width: '100%', fontSize: 12, color: 'var(--rust)', border: '1px solid rgba(202,89,73,0.4)' }}
              >
                {t('pd_close_consignment_btn')}
              </AsyncButton>
            </div>
          )}
        </div>
      )}

      {process.etapes.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div className="t-label" style={{ marginBottom:8 }}>{t('pd_steps_section')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {process.etapes.map(e=>{
              const days      = e.date_echeance ? daysUntil(e.date_echeance) : null
              const isFait    = e.statut === 'fait'
              const isBloque  = e.statut === 'bloque'
              const isEnCours = e.statut === 'en_cours'
              const isOverdue = days !== null && days < 0 && !isFait && !e.overdue_override
              const statColor = ETAPE_STATUT_COLORS[e.statut]
              return (
                <div key={e.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px', background:'var(--bg0)', opacity:isFait?0.5:1 }}>
                  <button
                    title={t('pd_etape_cycle_hint').replace(/\{status\}/g, etapeLabels[e.statut])}
                    onClick={()=>void onCycleEtape(e.id, e.statut)}
                    style={{ width:20, height:20, border:`1.5px solid ${statColor}`, background:isFait?statColor:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', marginTop:1, color:isFait?'#111':statColor, fontSize:12 }}
                  >
                    {isFait ? '✓' : isBloque ? '✕' : isEnCours ? '…' : ''}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, textDecoration:isFait?'line-through':'none', color:'var(--tx)' }}>{e.nom}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:statColor, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                        {etapeLabels[e.statut]}
                      </span>
                      {e.date_echeance && days !== null && (
                        <span style={{ fontSize:11, color: isFait ? 'var(--tx3)' : isOverdue ? '#c06060' : urgencyColor(days) }}>
                          {new Date(e.date_echeance).toLocaleDateString(dateLocale === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'short'})}
                          {days !== null && days >= 0
                            ? t('pd_etape_days_remaining').replace(/\{days\}/g, String(days))
                            : isOverdue && days !== null
                              ? t('pd_etape_days_overdue_label').replace(/\{days\}/g, String(Math.abs(days)))
                              : ''}
                        </span>
                      )}
                      {isOverdue && (
                        <button
                          title={t('pd_ignore_overdue_title')}
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:11, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'2px 8px', cursor:'pointer' }}
                        >{t('pd_ignore_overdue_btn')}</button>
                      )}
                      {e.overdue_override && !isFait && (
                        <button
                          title={t('pd_restore_overdue_title')}
                          onClick={()=>void onOverdueOverride(e.id, e.overdue_override)}
                          style={{ fontSize:11, color:'var(--tx3)', background:'none', border:'1px solid var(--bd)', padding:'2px 8px', cursor:'pointer' }}
                        >{t('pd_overdue_ignored_btn')}</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {process.notes && (
        <div style={{ marginTop:24 }}>
          <div className="t-label" style={{ marginBottom:10 }}>{t('notes')}</div>
          <div style={{ fontSize:14, color:'var(--tx2)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{process.notes}</div>
        </div>
      )}
    </div>
  )
}
