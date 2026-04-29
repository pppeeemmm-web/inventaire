'use client'

// WorkDrawer — 460 px right-rail overlay for full work detail.
// Shown from any tab when a work is "opened" (double-click / Details button).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl, yearOf, statusOf } from '@/lib/data'
import { StatusChip } from '@/components/ui/StatusChip'
import { deleteWork } from '@/app/atelier/works/actions'
import type { Oeuvre } from '@/lib/types/database'

// PEM's ContactID — default owner
const PEM_CONTACT_ID = 13

interface Props {
  o:               Oeuvre
  tM:              Record<number, string>   // technique map      id → label
  sM:              Record<number, string>   // support map        id → label
  cM:              Record<number, string>   // contact map        id → label
  pM:              Record<number, string>   // presentation map   id → label
  statusLabelMap:  Record<number, string>   // OeuvreStatus       id → label
  selection:       Set<number>
  setSelection:    (s: Set<number>) => void
  onClose:         () => void
}

export function WorkDrawer({ o, tM, sM, cM, pM, statusLabelMap, selection, setSelection, onClose }: Props) {
  const { t }  = useI18n()
  const router = useRouter()
  const isSel  = selection.has(o.OeuvreID)
  const st     = statusOf(o, statusLabelMap)
  const isSold = st === 'sold'
  const isLoan = st === 'loan' || st === 'consigned'

  function fmtDate(d: string | null | undefined) {
    if (!d) return null
    try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      try {
        const result = await deleteWork(o.OeuvreID)
        if ('error' in result) { setDeleteError(result.error); return }
        onClose()
        router.refresh()
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  function toggleSel() {
    const next = new Set(selection)
    if (next.has(o.OeuvreID)) next.delete(o.OeuvreID)
    else next.add(o.OeuvreID)
    setSelection(next)
  }

  const dims = o.Hauteur && o.Largeur
    ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
    : null

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 60,
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      {/* Rail */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, height: '100%',
          background: 'var(--bg1)',
          borderLeft: '1px solid var(--bd)',
          padding: 28,
          overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>Œuvre #{o.OeuvreID}</div>
          <button onClick={onClose} className="btn ghost sm">{t('close')} ×</button>
        </div>

        {/* Image */}
        <div className="thumb" style={{ aspectRatio: '4/3', marginBottom: 20, background: 'var(--bg0)', flexShrink: 0 }}>
          {o.txtImageNameLink
            ? <img
                src={thumbUrl(o.txtImageNameLink, 1080) ?? ''}
                alt={o.Titre ?? ''}
                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              />
            : <div className="ph">—</div>}
        </div>

        {/* Title */}
        <h2 className="serif" style={{ fontSize: 32, color: 'var(--tx)', lineHeight: 1.1, marginBottom: 16 }}>
          {o.Titre || t('untitled')}
        </h2>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 18px', fontSize: 11, marginBottom: 20 }}>

          {/* ── Identité ────────────────────────────── */}
          <div className="t-label">{t('year')}</div>
          <div style={{ color: 'var(--tx2)' }}>{yearOf(o.Année) ?? '—'}</div>

          <div className="t-label">{t('technique')}</div>
          <div style={{ color: 'var(--tx2)' }}>{(o.Technique != null && tM[o.Technique]) || '—'}</div>

          <div className="t-label">{t('support')}</div>
          <div style={{ color: 'var(--tx2)' }}>{(o.Support != null && sM[o.Support]) || '—'}</div>

          <div className="t-label">Présentation</div>
          <div style={{ color: (o as any).PresentationID != null ? 'var(--tx2)' : 'var(--tx3)' }}>
            {(o as any).PresentationID != null ? (pM[(o as any).PresentationID] ?? '—') : '—'}
          </div>

          <div className="t-label">Dimensions</div>
          <div style={{ color: 'var(--tx2)' }}>{dims ?? '—'}</div>

          {/* ── État ────────────────────────────────── */}
          <div className="t-label" style={{ paddingTop: 10 }}>{t('status')}</div>
          <div style={{ paddingTop: 10 }}><StatusChip s={st} /></div>

          <div className="t-label">Contact</div>
          <div style={{ color: 'var(--tx2)' }}>
            {o.ContactID != null ? (cM[o.ContactID] ?? 'Pem') : 'Pem'}
          </div>

          {isLoan && (
            <>
              <div className="t-label">Retour</div>
              <div style={{ color: (o as any).ReturnDate ? 'var(--ac)' : 'var(--tx3)' }}>
                {fmtDate((o as any).ReturnDate) ?? '—'}
              </div>
            </>
          )}

          {/* ── Finance ─────────────────────────────── */}
          <div className="t-label" style={{ paddingTop: 10 }}>Prix</div>
          <div style={{ color: 'var(--tx2)', paddingTop: 10 }}>
            {(() => {
              const p = (o as any).PrixFinal ?? o.Prix
              if (p && p > 0) return `€\u202f${Number(p).toLocaleString('fr-FR')}`
              return isSold ? '—' : t('priceOnRequest')
            })()}
          </div>

          {(o as any).Discount != null && (o as any).Discount > 0 && (
            <>
              <div className="t-label">Remise</div>
              <div style={{ color: 'var(--tx3)' }}>{(o as any).Discount}%</div>
            </>
          )}

          {/* ── Flags ───────────────────────────────── */}
          <div className="t-label" style={{ paddingTop: 10 }}>Exposable</div>
          <div style={{ color: o.Exposable ? 'var(--sage)' : 'var(--tx3)', paddingTop: 10 }}>
            {o.Exposable ? '✓' : '—'}
          </div>

          <div className="t-label">Encadrée</div>
          <div style={{ color: o.Encadree ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Encadree ? '✓' : '—'}</div>

          <div className="t-label">Cataloguée</div>
          <div style={{ color: o.Catalogué ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Catalogué ? '✓' : '—'}</div>

          <div className="t-label">Commission</div>
          <div style={{ color: o.IsCommission ? 'var(--tx2)' : 'var(--tx3)' }}>{o.IsCommission ? '✓' : '—'}</div>

          {o.IsCommission && (
            <>
              <div className="t-label">Livraison</div>
              <div style={{ color: (o as any).DateLivraison ? 'var(--ac)' : 'var(--tx3)' }}>
                {fmtDate((o as any).DateLivraison) ?? '—'}
              </div>
            </>
          )}
        </div>

        {/* Comments */}
        {o.Commentaires && (
          <div style={{
            fontSize: 11, color: 'var(--tx2)', lineHeight: 1.7,
            padding: '16px 0',
            borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
            marginBottom: 20,
          }}>
            {o.Commentaires}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div className="row gap-sm">
            <button className={`btn ${isSel ? 'primary' : ''}`} onClick={toggleSel}>
              {isSel ? `✓ ${t('selected')}` : `+ ${t('addToGroup')}`}
            </button>
            <button
              className="btn ghost"
              onClick={() => router.push(`/atelier/works/${o.OeuvreID}/edit`)}
            >
              Éditer
            </button>
            {!confirmDelete
              ? (
                <button
                  className="btn ghost sm"
                  style={{ marginLeft: 'auto', color: 'var(--tx3)' }}
                  onClick={() => setConfirmDelete(true)}
                >
                  Supprimer
                </button>
              ) : (
                <div className="row gap-sm" style={{ marginLeft: 'auto', alignItems: 'center' }}>
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Confirmer ?</span>
                  <button
                    className="btn ghost sm"
                    style={{ color: '#c0392b' }}
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? '…' : 'Oui, supprimer'}
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                  >
                    Annuler
                  </button>
                </div>
              )
            }
          </div>
          {deleteError && (
            <div className="t-mono-sm" style={{ color: '#c0392b', marginTop: 8 }}>{deleteError}</div>
          )}
        </div>
      </div>
    </div>
  )
}
