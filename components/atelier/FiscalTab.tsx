'use client'

// FiscalTab — expenses tracker + French BNC tax framework for artists.
// Régimes: Micro-BNC (abattement 34%) or Déclaration contrôlée (réel).
// URSSAF cotisations ~21.1%. TVA franchise thresholds.

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'

// ── Constants ──────────────────────────────────────────────────────────

const YEAR_NOW = new Date().getFullYear()

// French BNC thresholds (2024/2025)
const MICRO_BNC_SEUIL  = 77_700   // CA max pour micro-BNC
const TVA_FRANCHISE    = 36_800   // Franchise TVA services/arts
const TVA_FRANCHISE_2  = 44_500   // Seuil majoré tolérance
const URSSAF_RATE      = 0.211    // ~21.1% sur revenus bruts
const MICRO_ABATTEMENT = 0.34     // Abattement forfaitaire micro-BNC

const CATEGORIES = [
  'Matériaux artistiques',
  'Outillage & équipement',
  'Atelier (loyer / charges)',
  'Transport & déplacement',
  'Communication',
  'Documentation & formation',
  'Promotion & marketing',
  'Frais bancaires & assurances',
  'Informatique & logiciels',
  'Autres frais professionnels',
].sort((a, b) => a.localeCompare(b, 'fr'))

// ── Types ──────────────────────────────────────────────────────────────

interface Expense {
  id:          number
  date:        string
  libelle:     string
  category:    string | null
  type:        'bill' | 'receipt' | 'docket' | 'other' | null
  contact_id:  number | null
  montant_ht:  number | null
  tva_rate:    number | null
  montant_ttc: number
  notes:       string | null
  receipt_ref: string | null
  fiscal_year: number | null
}

interface Props {
  oeuvres: Oeuvre[]
  contacts?: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]
}

// ── Helpers ────────────────────────────────────────────────────────────

const FIS: React.CSSProperties = {
  padding: '6px 9px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', width: '100%',
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtEur(n: number) { return `${fmt(n, 2)} €` }

function Badge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{
      fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
      padding: '2px 7px', border: `1px solid ${ok ? 'var(--green)' : 'var(--rust)'}`,
      color: ok ? 'var(--green)' : 'var(--rust)', whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${warn ? 'var(--rust)' : 'var(--bd)'}`,
      padding: '14px 18px', background: 'var(--bg1)',
    }}>
      <div className="t-label" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: warn ? 'var(--rust)' : 'var(--tx)', letterSpacing: -0.5 }}>
        {value}
      </div>
      {sub && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4, fontSize: 10 }}>{sub}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────

export function FiscalTab({ oeuvres, contacts = [] }: Props) {
  const { t } = useI18n()
  const [year,     setYear]     = useState(YEAR_NOW)
  const [regime,   setRegime]   = useState<'micro' | 'reel'>('micro')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading,  setLoading]  = useState(true)
  const [section,  setSection]  = useState<'dashboard' | 'expenses' | 'framework'>('dashboard')
  const [editing,  setEditing]  = useState<Expense | 'new' | null>(null)

  useEffect(() => {
    setLoading(true)
    const sb = createClient()
    ;(sb.from('expense') as any)
      .select('*')
      .eq('fiscal_year', year)
      .order('date', { ascending: false })
      .then(({ data, error }: { data: Expense[] | null; error: { message: string } | null }) => {
        if (error) {
          console.error('[FiscalTab] expense fetch error:', error.message)
          // Table may not exist yet — surface a clear message instead of empty list
          if (error.message?.includes('does not exist')) {
            console.warn('[FiscalTab] Table `expense` missing in DB. Run fix_expense_and_document.sql.')
          }
        }
        setExpenses(data ?? [])
        setLoading(false)
      })
  }, [year])

  // Recettes: sold works this year (statusId 4 = Sold)
  const recettes = useMemo(() =>
    oeuvres
      .filter((o) => {
        if (o.statusId !== 4) return false
        const y = o.DateLivraison
          ? new Date(o.DateLivraison).getFullYear()
          : o.Année ? parseInt(String(o.Année)) : null
        return y === year
      })
      .reduce((sum, o) => sum + (Number((o as any).PrixFinal ?? (o as any).Prix ?? 0)), 0),
    [oeuvres, year],
  )

  const totalDepenses = useMemo(() =>
    expenses.reduce((s, e) => s + Number(e.montant_ttc), 0),
    [expenses],
  )

  const totalDepensesHT = useMemo(() =>
    expenses.reduce((s, e) => s + Number(e.montant_ht ?? e.montant_ttc), 0),
    [expenses],
  )

  // Tax estimates
  const bnc = regime === 'micro'
    ? recettes * (1 - MICRO_ABATTEMENT)
    : Math.max(0, recettes - totalDepensesHT)

  const urssaf       = recettes * URSSAF_RATE
  const impotAssiette = Math.max(0, bnc - urssaf)  // simplified
  const tvaOk        = recettes < TVA_FRANCHISE
  const microOk      = recettes < MICRO_BNC_SEUIL

  const catBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    expenses.forEach((e) => {
      const cat = e.category ?? 'Autres'
      m.set(cat, (m.get(cat) ?? 0) + Number(e.montant_ttc))
    })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses])

  const years = useMemo(() => {
    const ys = new Set<number>()
    for (let y = YEAR_NOW; y >= YEAR_NOW - 5; y--) ys.add(y)
    return [...ys]
  }, [])

  const navBtn = (s: typeof section, label: string) => (
    <button
      onClick={() => setSection(s)}
      style={{
        padding: '12px 20px', background: 'none', border: 'none',
        borderBottom: section === s ? '2px solid var(--ac)' : '2px solid transparent',
        color: section === s ? 'var(--ac)' : 'var(--tx3)',
        cursor: 'pointer', fontSize: 10, letterSpacing: 1.5,
        textTransform: 'uppercase', fontFamily: 'inherit',
        fontWeight: section === s ? 600 : 400,
      }}
    >{label}</button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {editing !== null && (
        <ExpenseModal
          expense={editing === 'new' ? null : editing}
          year={year}
          onClose={() => setEditing(null)}
          onSaved={(e) => {
            setExpenses((prev) =>
              editing === 'new'
                ? [e, ...prev]
                : prev.map((x) => x.id === e.id ? e : x)
            )
            setEditing(null)
          }}
          onDeleted={(id) => {
            setExpenses((prev) => prev.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}

      {/* Sub-nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', flexShrink: 0,
        padding: '0 28px', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex' }}>
          {navBtn('dashboard', 'Tableau de bord')}
          {navBtn('expenses', `Dépenses (${expenses.length})`)}
          {navBtn('framework', 'Cadre fiscal')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Year selector */}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            style={{ ...FIS, width: 'auto', padding: '4px 8px', fontSize: 10 }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Regime selector */}
          <select value={regime} onChange={(e) => setRegime(e.target.value as 'micro' | 'reel')}
            style={{ ...FIS, width: 'auto', padding: '4px 8px', fontSize: 10 }}>
            <option value="micro">Micro-BNC</option>
            <option value="reel">Déclaration contrôlée</option>
          </select>
        </div>
      </div>

      {/* ── Dashboard ── */}
      {section === 'dashboard' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, border: '1px solid var(--bd)', marginBottom: 24 }}>
            <StatCard label={t('income')} value={fmtEur(recettes)} sub={`Ventes ${year}`} />
            <StatCard label={t('expenses')} value={fmtEur(totalDepenses)} sub={`TTC (${expenses.length})`} />
            <StatCard label="BNC" value={fmtEur(bnc)} sub={regime === 'micro' ? 'Net (abattement 34%)' : 'Réel (CA - Frais)'} />
          </div>

          {/* Thresholds */}
          <div style={{ marginBottom: 24 }}>
            <div className="t-label" style={{ marginBottom: 12 }}>Seuils réglementaires {year}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Badge label={`Micro-BNC : ${microOk ? 'Éligible' : 'Dépassé'}`} ok={microOk} />
              <Badge label={`TVA franchise : ${tvaOk ? 'Exonéré' : 'TVA due'}`} ok={tvaOk} />
              {!tvaOk && recettes < TVA_FRANCHISE_2 && (
                <Badge label="Dans seuil majoré de tolérance" ok={true} />
              )}
            </div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 8, fontSize: 9, lineHeight: 1.8 }}>
              Micro-BNC ≤ {fmt(MICRO_BNC_SEUIL)} € · Franchise TVA ≤ {fmt(TVA_FRANCHISE)} € · Seuil majoré {fmt(TVA_FRANCHISE_2)} €
            </div>
          </div>

          {/* Expenses by category */}
          {catBreakdown.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="t-label" style={{ marginBottom: 12 }}>Dépenses par catégorie</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {catBreakdown.map(([cat, total]) => {
                  const pct = totalDepenses > 0 ? total / totalDepenses : 0
                  return (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="t-mono-sm" style={{ minWidth: 220, color: 'var(--tx2)', fontSize: 10 }}>{cat}</div>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                        <div style={{ width: `${pct * 100}%`, height: '100%', background: 'var(--ac)', borderRadius: 2 }} />
                      </div>
                      <div className="t-mono-sm" style={{ minWidth: 80, textAlign: 'right', color: 'var(--tx3)', fontSize: 10 }}>
                        {fmtEur(total)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Résumé fiscal simplifié */}
          <div style={{ border: '1px solid var(--bd)', padding: 20, background: 'var(--bg1)', maxWidth: 520 }}>
            <div className="t-label" style={{ marginBottom: 12 }}>Synthèse fiscale estimée — {year}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Recettes brutes', fmtEur(recettes)],
                regime === 'micro'
                  ? [`Abattement forfaitaire (34%)`, `− ${fmtEur(recettes * MICRO_ABATTEMENT)}`]
                  : [`Charges réelles déductibles`, `− ${fmtEur(totalDepensesHT)}`],
                ['BNC net', fmtEur(bnc), true],
                ['Cotisations URSSAF', `− ${fmtEur(urssaf)}`],
                ['Assiette IR (estimée)', fmtEur(impotAssiette), true],
              ].map(([label, value, bold]) => (
                <div key={label as string} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0', borderBottom: '1px solid var(--bd)',
                  fontWeight: bold ? 600 : 400,
                }}>
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{label}</span>
                  <span style={{ fontSize: 11, color: bold ? 'var(--tx)' : 'var(--tx2)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 10, fontSize: 9, lineHeight: 1.7 }}>
              Estimations indicatives. Consultez un expert-comptable pour votre situation personnelle.
              Barème IR selon votre tranche (non inclus ici).
            </div>
          </div>
        </div>
      )}

      {/* ── Expenses list ── */}
      {section === 'expenses' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            padding: '10px 28px', borderBottom: '1px solid var(--bd)',
            display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
          }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
              {expenses.length} dépense{expenses.length > 1 ? 's' : ''} · Total {fmtEur(totalDepenses)} TTC
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn ghost sm" onClick={() => setEditing('new')}>
              + Nouvelle dépense
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 32 }} className="t-mono-sm">Chargement…</div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 32, color: 'var(--tx3)' }} className="t-mono-sm">
              Aucune dépense enregistrée pour {year}. Cliquez sur « + Nouvelle dépense » pour commencer.
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('label')}</th>
                    <th>{t('category')}</th>
                    <th style={{ textAlign: 'right' }}>HT</th>
                    <th style={{ textAlign: 'right' }}>TVA %</th>
                    <th style={{ textAlign: 'right' }}>TTC</th>
                    <th>Ref.</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} onClick={() => setEditing(e)} style={{ cursor: 'pointer' }}>
                      <td className="t-mono-sm" style={{ whiteSpace: 'nowrap', color: 'var(--tx3)' }}>
                        {new Date(e.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td>{e.libelle}</td>
                      <td className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{e.category ?? '—'}</td>
                      <td className="t-mono-sm" style={{ textAlign: 'right', color: 'var(--tx3)' }}>
                        {e.montant_ht != null ? fmtEur(Number(e.montant_ht)) : '—'}
                      </td>
                      <td className="t-mono-sm" style={{ textAlign: 'right', color: 'var(--tx3)' }}>
                        {e.tva_rate != null && Number(e.tva_rate) > 0 ? `${e.tva_rate}%` : '—'}
                      </td>
                      <td className="t-mono-sm" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {fmtEur(Number(e.montant_ttc))}
                      </td>
                      <td className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{e.receipt_ref ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tax framework reference ── */}
      {section === 'framework' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px', maxWidth: 760 }}>
          <div className="t-label" style={{ marginBottom: 20 }}>Cadre fiscal — Artiste-auteur en France</div>

          <FrameworkBlock title="Régime Micro-BNC" accent>
            <FRow2 label="Condition" value={`CA ≤ ${fmt(MICRO_BNC_SEUIL)} € par an`} />
            <FRow2 label="Abattement" value="34% forfaitaire sur les recettes brutes" />
            <FRow2 label="Base imposable" value="66% des recettes → soumis au barème IR" />
            <FRow2 label="Avantage" value="Pas de comptabilité des charges réelles" />
            <FRow2 label="Déclaration" value="Formulaire 2042 C PRO" />
          </FrameworkBlock>

          <FrameworkBlock title="Déclaration contrôlée (BNC réel)">
            <FRow2 label="Condition" value={`CA > ${fmt(MICRO_BNC_SEUIL)} € ou sur option`} />
            <FRow2 label="Base imposable" value="Recettes − charges professionnelles réelles" />
            <FRow2 label="Déclaration" value="Formulaire 2035" />
            <FRow2 label="Avantage" value="Déduction des vraies charges (atelier, matériaux, transport…)" />
            <FRow2 label="Obligation" value="Livre de recettes + registre des achats" />
          </FrameworkBlock>

          <FrameworkBlock title="URSSAF — Sécurité sociale des artistes-auteurs">
            <FRow2 label="Taux global" value={`≈ ${(URSSAF_RATE * 100).toFixed(1)}% des revenus bruts`} />
            <FRow2 label="Détail" value="Maladie (8.23%) + Retraite complémentaire (12.88%) + autres" />
            <FRow2 label="Assiette minimum" value="≈ 600 × SMIC horaire (~6 500 €) pour affiliation" />
            <FRow2 label="Déclaration" value="Déclaration revenus artistes-auteurs en ligne (URSSAF.fr)" />
          </FrameworkBlock>

          <FrameworkBlock title="TVA">
            <FRow2 label="Franchise en base" value={`Exonération si CA < ${fmt(TVA_FRANCHISE)} €/an (seuil majoré ${fmt(TVA_FRANCHISE_2)} €)`} />
            <FRow2 label="Taux réduit œuvres" value="5,5% sur les œuvres originales (peintures, sculptures, dessins, photos originales)" />
            <FRow2 label="Taux normal" value="20% sur services (cours, reproductions, licences)" />
            <FRow2 label="Si assujetti" value="Déclaration CA3 mensuelle ou trimestrielle" />
          </FrameworkBlock>

          <FrameworkBlock title="Charges déductibles (régime réel)">
            <FRow2 label="Matériaux" value="Toiles, pigments, supports, encres, argile, etc." />
            <FRow2 label="Outillage" value="Pinceaux, outils, équipement de studio" />
            <FRow2 label="Atelier" value="Loyer (proratisé si domicile), charges, assurance" />
            <FRow2 label="Déplacements" value="Vernissages, livraisons, foires — barème kilométrique ou réel" />
            <FRow2 label="Documentation" value="Livres d'art, abonnements professionnels" />
            <FRow2 label="Frais bancaires" value="Frais de compte professionnel, commissions" />
            <FRow2 label="Téléphone / Internet" value="Quote-part professionnelle" />
            <FRow2 label="Non déductibles" value="Amendes, pénalités, dépenses personnelles" />
          </FrameworkBlock>

          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 20, fontSize: 9, lineHeight: 1.8, padding: '12px 16px', border: '1px solid var(--bd)' }}>
            ⚠ Informations indicatives basées sur la législation 2024/2025. Consultez un expert-comptable
            ou le site impots.gouv.fr pour votre situation personnelle. Seuils révisés chaque année.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Framework sub-components ───────────────────────────────────────────

function FrameworkBlock({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      marginBottom: 20, border: `1px solid ${accent ? 'var(--ac)' : 'var(--bd)'}`,
      padding: '14px 18px', background: 'var(--bg1)',
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
        color: accent ? 'var(--ac)' : 'var(--tx3)', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  )
}

function FRow2({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid var(--bd)' }}>
      <div className="t-mono-sm" style={{ minWidth: 160, color: 'var(--tx3)', flexShrink: 0, fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

// ── Expense modal ──────────────────────────────────────────────────────

function ExpenseModal({
  expense, year, onClose, onSaved, onDeleted,
}: {
  expense:   Expense | null
  year:      number
  onClose:   () => void
  onSaved:   (e: Expense) => void
  onDeleted: (id: number) => void
}) {
  const isNew = !expense
  const FIS   = FIS

  const [form, setForm] = useState({
    date:        expense?.date        ?? `${year}-01-01`,
    libelle:     expense?.libelle     ?? '',
    category:    expense?.category    ?? '',
    type:        expense?.type       ?? 'receipt',
    contact_id:  String(expense?.contact_id ?? ''),
    montant_ht:  String(expense?.montant_ht  ?? ''),
    tva_rate:    String(expense?.tva_rate    ?? '0'),
    montant_ttc: String(expense?.montant_ttc ?? ''),
    notes:       expense?.notes       ?? '',
    receipt_ref: expense?.receipt_ref ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  // Auto-compute TTC from HT + TVA rate
  function handleHtOrTva(field: 'montant_ht' | 'tva_rate', val: string) {
    const updated = { ...form, [field]: val }
    const ht  = parseFloat(updated.montant_ht)
    const tva = parseFloat(updated.tva_rate)
    if (!isNaN(ht) && !isNaN(tva)) {
      updated.montant_ttc = (ht * (1 + tva / 100)).toFixed(2)
    }
    setForm(updated)
  }

  async function handleSave() {
    setBusy(true); setErr(null)
    try {
      const sb = createClient()
      const payload = {
        date:        form.date,
        libelle:     form.libelle   || null,
        category:    form.category  || null,
        type:        form.type      || 'receipt',
        contact_id:  form.contact_id ? parseInt(form.contact_id) : null,
        montant_ht:  form.montant_ht  ? parseFloat(form.montant_ht)  : null,
        tva_rate:    form.tva_rate    ? parseFloat(form.tva_rate)    : 0,
        montant_ttc: parseFloat(form.montant_ttc),
        notes:       form.notes       || null,
        receipt_ref: form.receipt_ref || null,
      }
      if (isNaN(payload.montant_ttc)) throw new Error('Montant TTC invalide')

      if (isNew) {
        const { data, error } = await (sb.from('expense') as any)
          .insert(payload).select().single()
        if (error) throw new Error(error.message)
        if (!data) throw new Error('Aucune donnée retournée par la base')
        onSaved(data as Expense)
      } else {
        const { data, error } = await (sb.from('expense') as any)
          .update(payload).eq('id', expense!.id).select().single()
        if (error) throw new Error(error.message)
        if (!data) throw new Error('Aucune donnée retournée par la base')
        onSaved(data as Expense)
      }
    } catch (e) { setErr(String(e)) }
    finally { setBusy(false) }
  }

  async function handleDelete() {
    setBusy(true); setErr(null)
    try {
      const sb = createClient()
      const { error } = await (sb.from('expense') as any).delete().eq('id', expense!.id)
      if (error) throw new Error(error.message)
      onDeleted(expense!.id)
    } catch (e) { setErr(String(e)); setBusy(false) }
  }

  function f(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--bd)',
        width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflow: 'auto', padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }}>
            {isNew ? 'Nouvelle dépense' : `Modifier dépense #${expense!.id}`}
          </div>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Date</div>
              <input type="date" value={form.date} onChange={f('date')} style={FIS} />
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Catégorie</div>
              <select value={form.category} onChange={f('category')} style={FIS}>
                <option value="">— Choisir</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Type</div>
              <select value={form.type || ''} onChange={f('type')} style={FIS}>
                <option value="receipt">Ticket / Docket</option>
                <option value="bill">Facture</option>
                <option value="docket">Bon de livraison</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Contact / Fournisseur</div>
              <select value={form.contact_id} onChange={f('contact_id')} style={FIS}>
                <option value="">— Aucun</option>
                {contacts.sort((a,b) => (a.NomInstitution||a.Nom||'').localeCompare(b.NomInstitution||b.Nom||'', 'fr')).map(c => (
                  <option key={c.ContactID} value={c.ContactID}>
                    {c.NomInstitution || `${c.Prénom||''} ${c.Nom||''}`.trim() || `#${c.ContactID}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="t-label" style={{ marginBottom: 3 }}>Libellé</div>
            <input value={form.libelle} onChange={f('libelle')} placeholder="Description de la dépense" style={FIS} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: 8, alignItems: 'end' }}>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Montant HT (€)</div>
              <input
                type="number" step="0.01" value={form.montant_ht}
                onChange={(e) => handleHtOrTva('montant_ht', e.target.value)}
                placeholder="0.00" style={FIS}
              />
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>TVA %</div>
              <select
                value={form.tva_rate}
                onChange={(e) => handleHtOrTva('tva_rate', e.target.value)}
                style={FIS}
              >
                <option value="0">0% (exo)</option>
                <option value="5.5">5,5%</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
              </select>
            </div>
            <div>
              <div className="t-label" style={{ marginBottom: 3 }}>Montant TTC (€) *</div>
              <input
                type="number" step="0.01" value={form.montant_ttc}
                onChange={f('montant_ttc')}
                placeholder="0.00" style={FIS}
              />
            </div>
          </div>

          <div>
            <div className="t-label" style={{ marginBottom: 3 }}>Référence justificatif / numéro dossier</div>
            <input value={form.receipt_ref} onChange={f('receipt_ref')} placeholder="ex: FACT-2025-003, Ticket Leroy Merlin…" style={FIS} />
          </div>

          <div>
            <div className="t-label" style={{ marginBottom: 3 }}>Notes</div>
            <textarea value={form.notes} onChange={f('notes')} rows={2}
              style={{ ...FIS, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Notes libres…" />
          </div>
        </div>

        {err && <div style={{ fontSize: 11, color: 'var(--rust)', marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!isNew && (
              confirmDel ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="t-mono-sm" style={{ color: 'var(--rust)', fontSize: 10 }}>Supprimer ?</span>
                  <button className="btn ghost sm" style={{ color: 'var(--rust)', borderColor: 'var(--rust)' }}
                    onClick={() => void handleDelete()} disabled={busy}>Oui</button>
                  <button className="btn ghost sm" onClick={() => setConfirmDel(false)}>Non</button>
                </div>
              ) : (
                <button className="btn ghost sm" style={{ color: 'var(--rust)', borderColor: 'var(--rust)' }}
                  onClick={() => setConfirmDel(true)}>Supprimer</button>
              )
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={onClose} disabled={busy}>Annuler</button>
            <button className="btn primary sm" onClick={() => void handleSave()} disabled={busy}>
              {busy ? '…' : isNew ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
