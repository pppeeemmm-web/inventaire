'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

interface StockItem {
  id:           number
  name:         string
  category:    string | null
  quantity:     number
  unit:         string
  min_stock:    number
  supplier_id:  number | null
  cost_unit:    number | null
  notes:        string | null
  updated_at:   string
}

interface Props {
  contacts: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null }[]
}

const CATS = ['Additif', 'Autre', "Couleur à l'huile", 'Liant', 'Lin', 'Medium à peindre', 'Papier', 'Pigment', 'Pinceau', 'Primer', 'Solvent']

export function SupplierHub({ contacts }: Props) {
  const { lang } = useI18n()
  const [items,   setItems]   = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<StockItem> | null>(null)
  const [busy,    setBusy]    = useState(false)

  const suppliers = contacts.filter(c => c.Role?.toLowerCase() === 'supplier' || c.Role?.toLowerCase() === 'fournisseur')

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('stock_item').select('*').order('name')
    if (data) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!editing?.name) return
    setBusy(true)
    const sb = createClient()
    const payload = {
      name:        editing.name,
      category:    editing.category || null,
      quantity:    Number(editing.quantity || 0),
      unit:        editing.unit || 'units',
      min_stock:   Number(editing.min_stock || 0),
      supplier_id: editing.supplier_id || null,
      cost_unit:   editing.cost_unit || null,
      notes:       editing.notes || null,
    }

    if (editing.id) {
      await sb.from('stock_item').update(payload).eq('id', editing.id)
    } else {
      await sb.from('stock_item').insert(payload)
    }
    await load()
    setEditing(null)
    setBusy(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cet article ?')) return
    setBusy(true)
    const sb = createClient()
    await sb.from('stock_item').delete().eq('id', id)
    await load()
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>Stock & Fournisseurs</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
            {items.length} articles inventoriés
          </div>
        </div>
        <button className="btn primary sm" onClick={() => setEditing({})}>
          + Nouvel article
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Article</th>
              <th>Catégorie</th>
              <th className="num">Quantité</th>
              <th>Unité</th>
              <th>Fournisseur</th>
              <th className="num">Prix Unit.</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}>Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}>Aucun article en stock.</td></tr>
            ) : items.map(it => {
              const low = it.quantity <= it.min_stock
              const sup = contacts.find(c => c.ContactID === it.supplier_id)
              const supName = sup ? (sup.NomInstitution || `${sup.Prénom || ''} ${sup.Nom || ''}`.trim()) : '—'
              return (
                <tr key={it.id} style={{ opacity: low ? 1 : 0.8 }}>
                  <td style={{ fontWeight: 500, color: low ? 'var(--rust)' : 'var(--tx)' }}>
                    {it.name} {low && <span style={{ fontSize: 9, marginLeft: 8, color: 'var(--rust)', border: '1px solid var(--rust)', padding: '1px 4px', borderRadius: 2 }}>BAS</span>}
                  </td>
                  <td><span className="t-mono-sm" style={{ opacity: 0.6 }}>{it.category || '—'}</span></td>
                  <td className="num" style={{ fontWeight: 600, color: low ? 'var(--rust)' : 'var(--tx)' }}>{it.quantity}</td>
                  <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{it.unit}</td>
                  <td style={{ fontSize: 10, color: 'var(--tx2)' }}>{supName}</td>
                  <td className="num">{it.cost_unit != null ? `€${it.cost_unit.toFixed(2)}` : '—'}</td>
                  <td className="num">
                    <button className="btn ghost sm" onClick={() => setEditing(it)}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd2)', width: 400, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 20 }}>{editing.id ? 'Modifier article' : 'Nouvel article'}</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Nom</div>
                <input value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>Catégorie</div>
                  <select value={editing.category || ''} onChange={e => setEditing({...editing, category: e.target.value})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }}>
                    <option value="">—</option>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>Unité</div>
                  <input value={editing.unit || ''} placeholder="ex. mètres, ml, unités" onChange={e => setEditing({...editing, unit: e.target.value})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>Quantité Actuelle</div>
                  <input type="number" value={editing.quantity ?? 0} onChange={e => setEditing({...editing, quantity: Number(e.target.value)})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }} />
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>Alerte Stock Bas</div>
                  <input type="number" value={editing.min_stock ?? 0} onChange={e => setEditing({...editing, min_stock: Number(e.target.value)})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }} />
                </div>
              </div>
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Fournisseur</div>
                <select value={editing.supplier_id || ''} onChange={e => setEditing({...editing, supplier_id: e.target.value ? Number(e.target.value) : null})} style={{ width: '100%', padding: 8, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }}>
                  <option value="">— Aucun</option>
                  {suppliers.map(s => (
                    <option key={s.ContactID} value={s.ContactID}>
                      {s.NomInstitution || `${s.Prénom || ''} ${s.Nom || ''}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn primary" style={{ flex: 1 }} onClick={handleSave} disabled={busy || !editing.name}>
                  {busy ? '…' : 'Enregistrer'}
                </button>
                {editing.id && (
                   <button className="btn ghost" style={{ color: 'var(--rust)' }} onClick={() => handleDelete(editing.id!)}>Supprimer</button>
                )}
                <button className="btn ghost" onClick={() => setEditing(null)}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
