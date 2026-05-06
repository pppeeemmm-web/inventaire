'use client'

// CurationPanel — right-rail panel shown when the Constellation tab FIS active
// (or accessible via CurationDock on other tabs).
// Handles: selection summary · thumb strip · save as working group (→ Supabase)
//          private link generation (→ Supabase) · checklist preview modal.

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { thumbUrl, yearOf } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

interface Props {
  selection:    Set<number>
  setSelection: (s: Set<number>) => void
  oeuvres:      Oeuvre[]
  tM:           Record<number, string>
  sM:           Record<number, string>
  onOpen:       (o: Oeuvre) => void
  // Called after Supabase insert; parent updates local groups list
  onGroupSaved: (id: string, name: string) => void
}

export function CurationPanel({
  selection, setSelection, oeuvres, tM, sM, onOpen, onGroupSaved,
}: Props) {
  const ids   = useMemo(() => [...selection], [selection])
  const works = useMemo(
    () => ids.map((id) => oeuvres.find((o) => o.OeuvreID === id)).filter(Boolean) as Oeuvre[],
    [ids, oeuvres],
  )

  const [name,       setName]       = useState('')
  const [recipient,  setRecipient]  = useState('')
  const [expires,    setExpires]    = useState('14')
  const [saving,     setSaving]     = useState(false)
  const [savedGrpId, setSavedGrpId] = useState<string | null>(null)
  const [savedGrpNm, setSavedGrpNm] = useState<string | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [showLink,   setShowLink]   = useState<{ url: string; recipient: string; expires: string } | null>(null)
  const [linkError,  setLinkError]  = useState<string | null>(null)
  const [showPdf,    setShowPdf]    = useState(false)

  const totalValue = works.reduce((s, o) => s + (o.Prix ?? 0), 0)

  // ── Empty state ────────────────────────────────────────────────

  if (ids.length === 0) {
    return (
      <div style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginBottom: 12 }}>Groupe de travail</div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--tx3)' }}>
          <div style={{ fontSize: 48, color: 'var(--mt)', lineHeight: 1, marginBottom: 14, fontFamily: "'Instrument Serif', serif" }}>∅</div>
          <div className="t-mono-sm">Aucune sélection</div>
          <div className="t-mono-sm" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 220, margin: '8px auto 0' }}>
            Cliquez sur une œuvre pour la sélectionner
          </div>
        </div>
      </div>
    )
  }

  // ── Save group to Supabase ─────────────────────────────────────

  async function handleSaveGroup(): Promise<string | null> {
    setSaving(true)
    const supabase = createClient()
    const nm = name.trim() || `Sélection du ${new Date().toLocaleDateString('fr-FR')}`

    const { data: grp, error: gErr } = await supabase
      .from('working_group')
      .insert({ name: nm })
      .select('id')
      .single()

    if (gErr || !grp) {
      setSaving(false)
      return null
    }

    await supabase.from('working_group_work').insert(
      ids.map((id, i) => ({ group_id: grp.id, oeuvre_id: id, position: i })),
    )

    setSavedGrpId(grp.id)
    setSavedGrpNm(nm)
    onGroupSaved(grp.id, nm)
    setName('')
    setSaving(false)
    return grp.id
  }

  // ── Generate private link ──────────────────────────────────────

  async function handleGenerateLink() {
    setLinkLoading(true)
    setLinkError(null)

    // Ensure there FIS a saved group first
    let gid = savedGrpId
    if (!gid) {
      gid = await handleSaveGroup()
      if (!gid) {
        setLinkError('Impossible de sauvegarder le groupe.')
        setLinkLoading(false)
        return
      }
    }

    // nanoid: 12 chars, URL-safe
    const { nanoid } = await import('nanoid')
    const token      = nanoid(12)
    const expiresAt  = new Date(Date.now() + parseInt(expires) * 86_400_000).toISOString()

    const supabase   = createClient()
    const { error }  = await supabase.from('private_link').insert({
      token,
      recipient_name: recipient.trim() || null,
      group_id:       gid,
      expires_at:     expiresAt,
    })

    if (error) {
      setLinkError(error.message)
      setLinkLoading(false)
      return
    }

    setShowLink({
      url:       `${window.location.origin}/c/${token}`,
      recipient: recipient.trim() || '—',
      expires,
    })
    setLinkLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ padding: '20px 18px', flex: 1, overflow: 'auto' }}>

      {/* Header */}
      <div className="row between" style={{ marginBottom: 14 }}>
        <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>Groupe de travail</div>
        <button className="btn ghost sm" onClick={() => setSelection(new Set())}>Effacer</button>
      </div>

      {/* Summary */}
      <div className="row gap-md" style={{
        padding: '12px 0',
        borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
        marginBottom: 14,
      }}>
        <div className="stat" style={{ gap: 2, flex: 1 }}>
          <span className="v" style={{ fontSize: 28 }}>{ids.length}</span>
          <span className="l">sélectionnée{ids.length > 1 ? 's' : ''}</span>
        </div>
        {totalValue > 0 && (
          <div className="stat" style={{ gap: 2, flex: 1, textAlign: 'right', alignItems: 'flex-end' }}>
            <span className="v" style={{ fontSize: 20, color: 'var(--ac)' }}>
              €{totalValue.toLocaleString('fr-FR')}
            </span>
            <span className="l">valeur</span>
          </div>
        )}
      </div>

      {/* Thumb strip — 4×3 grid, max 12 shown + overflow count */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, marginBottom: 14 }}>
        {works.slice(0, 12).map((o) => (
          <div
            key={o.OeuvreID}
            className="thumb"
            style={{ aspectRatio: '1', cursor: 'pointer', position: 'relative' }}
            onClick={() => onOpen(o)}
          >
            {o.txtImageNameLink
              ? <img src={thumbUrl(o.txtImageNameLink, 128) ?? ''} loading="lazy" alt="" />
              : <div className="ph" style={{ fontSize: 8 }}>—</div>}
            <button
              onClick={(e) => {
                e.stopPropagation()
                const ns = new Set(selection)
                ns.delete(o.OeuvreID)
                setSelection(ns)
              }}
              style={{
                position: 'absolute', top: 2, right: 2,
                width: 14, height: 14,
                background: 'rgba(10,10,11,0.8)',
                color: 'var(--tx2)', fontSize: 9,
                border: '1px solid var(--bd2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Retirer"
            >×</button>
          </div>
        ))}
        {works.length > 12 && (
          <div style={{
            aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--bd)', color: 'var(--tx3)', fontSize: 10, background: 'var(--bg1)',
          }}>
            +{works.length - 12}
          </div>
        )}
      </div>

      {/* Title list */}
      <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--bd)', marginBottom: 20, background: 'var(--bg1)' }}>
        {works.map((o) => (
          <div key={o.OeuvreID} style={{
            padding: '6px 10px', borderBottom: '1px solid var(--bd)',
            fontSize: 10, display: 'flex', gap: 6, justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--tx3)', width: 40, flexShrink: 0 }}>#{o.OeuvreID}</span>
            <span style={{ flex: 1, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {o.Titre || '—'}
            </span>
            <span style={{ color: 'var(--tx3)' }}>{yearOf(o.Année) ?? '—'}</span>
          </div>
        ))}
      </div>

      {/* Save group */}
      <div style={{ marginBottom: 18 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Enregistrer le groupe</div>
        {savedGrpNm && (
          <div className="t-mono-sm" style={{ color: 'var(--sage)', marginBottom: 6 }}>
            ✓ Sauvegardé : {savedGrpNm}
          </div>
        )}
        <div className="row gap-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du groupe…"
            style={{
              flex: 1, padding: '6px 10px',
              background: 'var(--bg1)', border: '1px solid var(--bd)',
              fontSize: 10.5, color: 'var(--tx)',
            }}
          />
          <button
            className="btn sm primary"
            onClick={handleSaveGroup}
            disabled={saving}
          >{saving ? '…' : '+'}</button>
        </div>
      </div>

      <div className="hairline-d" style={{ margin: '16px 0' }}></div>

      {/* Private link */}
      <div style={{ marginBottom: 18 }}>
        <div className="t-label" style={{ marginBottom: 8 }}>Lien privé</div>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Destinataire (facultatif)…"
          style={{
            width: '100%', padding: '6px 10px',
            background: 'var(--bg1)', border: '1px solid var(--bd)',
            fontSize: 10.5, color: 'var(--tx)', marginBottom: 6,
          }}
        />
        <div className="row gap-sm" style={{ marginBottom: 8 }}>
          <label className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Expire dans</label>
          <select
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            style={{ padding: '4px 8px', background: 'var(--bg1)', border: '1px solid var(--bd)', fontSize: 10.5, color: 'var(--tx)' }}
          >
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </select>
        </div>
        <button
          className="btn primary"
          onClick={handleGenerateLink}
          disabled={linkLoading}
          style={{ width: '100%' }}
        >{linkLoading ? 'Génération…' : 'Générer le lien'}</button>

        {linkError && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--rust)' }}>{linkError}</div>
        )}

        {showLink && (
          <div style={{ marginTop: 10, padding: 10, background: 'var(--bg2)', border: '1px solid var(--bd2)' }}>
            <div
              style={{ fontSize: 10, color: 'var(--ac)', fontFamily: 'monospace', wordBreak: 'break-all', cursor: 'pointer' }}
              onClick={() => navigator.clipboard?.writeText(showLink.url)}
              title="Copier"
            >{showLink.url}</div>
            <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 4 }}>
              Pour {showLink.recipient} · expire dans {showLink.expires} jours · cliquez pour copier
            </div>
          </div>
        )}
      </div>

      <div className="hairline-d" style={{ margin: '16px 0' }}></div>

      {/* Exports */}
      <div>
        <div className="t-label" style={{ marginBottom: 8 }}>Export</div>
        <div className="col gap-sm">
          <button className="btn" style={{ justifyContent: 'space-between' }} onClick={() => setShowPdf(true)}>
            <span>Checklist disponibilités</span>
            <span style={{ color: 'var(--tx3)' }}>PDF</span>
          </button>
          <button className="btn" style={{ justifyContent: 'space-between' }}>
            <span>Dossier d&apos;exposition</span>
            <span style={{ color: 'var(--tx3)' }}>PDF</span>
          </button>
        </div>
      </div>

      {showPdf && (
        <ChecklistPreview works={works} tM={tM} sM={sM} onClose={() => setShowPdf(false)} />
      )}
    </div>
  )
}

// ── ChecklistPreview — print-ready modal ────────────────────────────

function ChecklistPreview({
  works, tM, sM, onClose,
}: {
  works:   Oeuvre[]
  tM:      Record<number, string>
  sM:      Record<number, string>
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 700, maxHeight: '90vh',
          background: '#f5efe4', color: '#1a1a1a',
          overflow: 'auto', position: 'relative',
          fontFamily: "'Instrument Serif', Georgia, serif",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            color: '#1a1a1a', borderColor: '#1a1a1a',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '4px 10px', fontSize: 10,
            background: 'transparent', border: '1px solid #1a1a1a',
            cursor: 'pointer',
          }}
        >Fermer</button>

        <div style={{ padding: '56px 64px 40px' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#666', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
            Checklist
          </div>
          <div style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24 }}>
            Œuvres disponibles — sélection
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 40, fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · {works.length} œuvres
          </div>

          <div style={{ borderTop: '1px solid #1a1a1a' }}>
            {works.map((o) => (
              <div
                key={o.OeuvreID}
                style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 90px',
                  gap: 20, padding: '14px 0',
                  borderBottom: '1px solid #ddd3c0', alignItems: 'center',
                }}
              >
                {/* Thumb */}
                <div style={{ width: 64, height: 64, background: '#e5dcc9', flexShrink: 0 }}>
                  {o.txtImageNameLink && (
                    <img
                      src={thumbUrl(o.txtImageNameLink, 128) ?? ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      alt=""
                    />
                  )}
                </div>
                {/* Info */}
                <div>
                  <div style={{ fontSize: 18, lineHeight: 1.2, marginBottom: 4 }}>{o.Titre || '—'}</div>
                  <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                    {o.Technique != null ? (tM[o.Technique] ?? '—') : '—'}
                    {o.Support != null && sM[o.Support] ? ` sur ${sM[o.Support].toLowerCase()}` : ''}
                    {o.Hauteur && o.Largeur ? ` · ${o.Hauteur} × ${o.Largeur} cm` : ''}
                    {yearOf(o.Année) ? ` · ${yearOf(o.Année)}` : ''}
                  </div>
                </div>
                {/* Price */}
                <div style={{ textAlign: 'right', fontSize: 11, color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>
                  {o.Prix && o.Prix > 0 ? `€${o.Prix.toLocaleString('fr-FR')}` : 'sur demande'}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 40, fontSize: 10, color: '#666',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Atelier PEM</span>
            <span>Document confidentiel — ne pas diffuser</span>
          </div>
        </div>
      </div>
    </div>
  )
}
