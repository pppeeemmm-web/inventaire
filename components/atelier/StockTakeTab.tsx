'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StockItem {
  id:           number
  name:         string
  category:     string | null
  quantity:     number    // recorded
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

export function StockTakeTab({ contacts }: Props) {
  const [items,      setItems]      = useState<StockItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [counts,     setCounts]     = useState<Record<number, number>>({}) // id -> actual count
  const [busy,       setBusy]       = useState(false)
  const [history,    setHistory]    = useState<{ date: string; message: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('stock_item').select('*').order('category').order('name')
    if (data) {
      setItems(data)
      // Initialize counts with recorded values
      const initial: Record<number, number> = {}
      data.forEach(it => { initial[it.id] = it.quantity })
      setCounts(initial)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const cats = new Set(items.map(it => it.category || 'Non classé'))
    return Array.from(cats).sort()
  }, [items])

  async function handleApply() {
    if (!confirm('Appliquer les nouveaux stocks ? Cela mettra à jour l\'inventaire officiel.')) return
    setBusy(true)
    const sb = createClient()
    
    // For each item where count changed, update DB
    const updates = items.filter(it => counts[it.id] !== it.quantity)
    
    if (updates.length === 0) {
      setBusy(false)
      return
    }

    const results = await Promise.all(updates.map(it => 
      sb.from('stock_item').update({ quantity: counts[it.id] }).eq('id', it.id)
    ))

    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      alert(`Erreur lors de la mise à jour de ${errors.length} articles.`)
    } else {
      alert(`${updates.length} articles mis à jour avec succès.`)
      await load()
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 32px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>Inventaire Physique (Stock-take)</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
            Vérifiez et ajustez les quantités réelles en rayon.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <button className="btn ghost sm" onClick={() => load()}>Actualiser</button>
           <button className="btn primary sm" onClick={handleApply} disabled={busy || loading}>
             {busy ? 'Mise à jour…' : 'Appliquer les changements'}
           </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        {loading ? (
           <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>Chargement…</div>
        ) : items.length === 0 ? (
           <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>Aucun article trouvé.</div>
        ) : (
          <table className="tbl" style={{ border: 'none' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg2)' }}>
              <tr>
                <th style={{ paddingLeft: 20 }}>Article</th>
                <th>Fournisseur</th>
                <th className="num">Théorique</th>
                <th className="num" style={{ width: 120 }}>Réel</th>
                <th className="num" style={{ width: 80 }}>Diff.</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <Fragment key={cat}>
                  <tr style={{ background: 'var(--bg0)' }}>
                    <td colSpan={6} style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: 'var(--tx3)', padding: '8px 20px', textTransform: 'uppercase' }}>
                      {cat}
                    </td>
                  </tr>
                  {items.filter(it => (it.category || 'Non classé') === cat).map(it => {
                    const diff = counts[it.id] - it.quantity
                    const sup = contacts.find(c => c.ContactID === it.supplier_id)
                    const supName = sup ? (sup.NomInstitution || `${sup.Prénom || ''} ${sup.Nom || ''}`.trim()) : '—'
                    
                    return (
                      <tr key={it.id}>
                        <td style={{ paddingLeft: 20, fontWeight: 500 }}>{it.name} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--tx3)', marginLeft: 4 }}>({it.unit})</span></td>
                        <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{supName}</td>
                        <td className="num t-mono" style={{ opacity: 0.6 }}>{it.quantity}</td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <button className="btn sm ghost" style={{ padding: '2px 6px', minWidth: 0 }} onClick={() => setCounts(prev => ({...prev, [it.id]: Math.max(0, (prev[it.id] || 0) - 1)}))}>-</button>
                            <input 
                              type="number" 
                              value={counts[it.id] ?? 0}
                              onChange={e => setCounts(prev => ({...prev, [it.id]: Number(e.target.value)}))}
                              style={{ width: 50, textAlign: 'center', padding: '4px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 11, fontWeight: 600 }}
                            />
                            <button className="btn sm ghost" style={{ padding: '2px 6px', minWidth: 0 }} onClick={() => setCounts(prev => ({...prev, [it.id]: (prev[it.id] || 0) + 1}))}>+</button>
                          </div>
                        </td>
                        <td className="num t-mono" style={{ 
                          fontWeight: 600,
                          color: diff > 0 ? 'var(--sage)' : diff < 0 ? 'var(--rust)' : 'var(--tx3)'
                        }}>
                          {diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff}
                        </td>
                        <td>
                          {diff !== 0 && (
                            <button className="btn sm ghost" style={{ padding: '2px 6px' }} title="Reset" onClick={() => setCounts(prev => ({...prev, [it.id]: it.quantity}))}>↺</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
