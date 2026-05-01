'use client'

// TeamPortalClient — fully interactive shell for the /atelier team portal.
// Receives pre-fetched reference data from app/atelier/page.tsx.
// Manages global state: active tab, work drawer, selection, working groups.

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'

import { InventoryTab }        from '@/components/atelier/InventoryTab'
import { WorkDrawer }          from '@/components/atelier/WorkDrawer'
import { CurationPanel }       from '@/components/atelier/CurationPanel'
import { CurationDock }        from '@/components/atelier/CurationDock'
import { ConstellationCanvas } from '@/components/atelier/ConstellationCanvas'
import { VaultTab }            from '@/components/atelier/VaultTab'
import { ProductionTab }       from '@/components/atelier/ProductionTab'
import { LogisticsTab }        from '@/components/atelier/LogisticsTab'
import { SalesTab }            from '@/components/atelier/SalesTab'
import { ContactsTab }         from '@/components/atelier/ContactsTab'
import { WorldMapTab }         from '@/components/atelier/WorldMapTab'
import { PipelineTab }         from '@/components/atelier/PipelineTab'
import { FiscalTab }           from '@/components/atelier/FiscalTab'
import { ConceptsTab }         from '@/components/atelier/ConceptsTab'
import { ExhibitionsTab }      from '@/components/atelier/ExhibitionsTab'
import { ThemesTab }           from '@/components/atelier/ThemesTab'
import { SupplierHub }         from '@/components/atelier/SupplierHub'

// ── Types ────────────────────────────────────────────────────────────

type Tab =
  | 'overview' | 'inventory' | 'constellation' | 'production'
  | 'logistics' | 'sales' | 'exhibitions' | 'vault' | 'contacts' | 'map' | 'pipeline' | 'fiscal' | 'concepts' | 'themes' | 'stock'

interface Props {
  oeuvres:        Oeuvre[]
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  themes:         { ThemeID:     number; Nom:       string }[]
  contacts:       { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  statusLabelMap: Record<number, string>
  initialGroups:  { id: string; name: string }[]
  presentations:  { PresentationID: number; Nom: string | null }[]
  // Optional — not yet passed from page.tsx; defaults to {} to avoid crash
  themeWorkCount?: Record<number, number>
  groupWorkCount?:  Record<string, number>
}

// ── Component ────────────────────────────────────────────────────────

export function TeamPortalClient({
  oeuvres, techniques, supports, formats, themes, contacts,
  statusLabelMap, initialGroups, presentations,
  themeWorkCount = {}, groupWorkCount = {},
}: Props) {
  const { t, lang, setLang } = useI18n()
  const router = useRouter()

  // ── Global state ───────────────────────────────────────────────

  // Always start with 'overview' on server and client — prevents hydration mismatch.
  // Restore last tab from localStorage after first paint.
  const [tab,            setTab]          = useState<Tab>('overview')
  const [reminderCount,  setReminderCount] = useState(0)

  // Poll unread reminders for the landing badge
  useEffect(() => {
    const sb = createClient()
    ;(sb.from('suivi_reminder') as any)
      .select('id', { count: 'exact', head: true })
      .eq('lu', false)
      .then(({ count }: { count: number | null }) => setReminderCount(count ?? 0))
  }, [tab]) // refresh when tab changes

  useEffect(() => {
    const saved = localStorage.getItem('pem_team_tab') as Tab | null
    if (saved) setTab(saved)
  }, [])
  const [inspected,  setInspected]  = useState<Oeuvre | null>(null)
  const [selection,  setSelection]  = useState<Set<number>>(new Set())
  const [groups,     setGroups]     = useState<{ id: string; name: string }[]>(
    [...initialGroups].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  )

  useEffect(() => {
    (window as any).setSelection = setSelection
  }, [])

  function handleSetTab(next: Tab) {
    setTab(next)
    localStorage.setItem('pem_team_tab', next)
  }

  // ── Derived lookup maps ────────────────────────────────────────

  const tM = useMemo(
    () => Object.fromEntries(techniques.map((x) => [x.TechniqueID, x.Technique ?? ''])),
    [techniques],
  )
  const sM = useMemo(
    () => Object.fromEntries(supports.map((x) => [x.SupportID, x.Support ?? ''])),
    [supports],
  )
  const cM = useMemo(
    () => Object.fromEntries(contacts.map((c) => {
      const label = c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
      return [c.ContactID, label]
    })),
    [contacts],
  )
  // locMap: ContactID → "Ville, Pays" — used to resolve work location
  const locMap = useMemo(
    () => Object.fromEntries(
      contacts
        .filter((c) => c.Ville || c.Pays)
        .map((c) => {
          const loc = [c.Ville, c.Pays].filter(Boolean).join(', ')
          return [c.ContactID, loc]
        })
    ),
    [contacts],
  )
  const pM = useMemo(
    () => Object.fromEntries(presentations.map((p) => [p.PresentationID, p.Nom ?? ''])),
    [presentations],
  )

  // ── Save working group (Supabase) ──────────────────────────────

  const handleSaveGroup = useCallback(async (name: string, ids: number[]): Promise<string | null> => {
    const supabase = createClient()
    const { data: grp, error } = await (supabase.from('working_group') as any)
      .insert({ name })
      .select('id')
      .single()

    if (error || !grp) return null

    await (supabase.from('working_group_work') as any).insert(
      ids.map((id, i) => ({ group_id: (grp as any).id, oeuvre_id: id, position: i })),
    )

    setGroups((prev) => [{ id: (grp as any).id, name }, ...prev])
    return (grp as any).id
  }, [])

  // ── Tab definitions ────────────────────────────────────────────

  const TABS: [Tab, string, number?][] = [
    ['overview',      t('overview')],
    ['inventory',     t('inventory'), oeuvres.length],
    ['constellation', t('constellation')],
    ['production',    t('production')],
    ['logistics',     t('logistics')],
    ['sales',         t('sales')],
    ['exhibitions',   t('exhibitions')],
    ['vault',         t('vault')],
    ['contacts',      t('contacts'), contacts.length],
    ['pipeline',      t('pipeline')],
    ['map',           t('map')],
    ['fiscal',        t('fiscal')],
    ['concepts',      t('concepts')],
    ['themes',        t('themes')],
    ['stock',         'Stock'],
  ]

  const showDock = selection.size > 0 && tab !== 'constellation'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', position: 'relative' }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px' }}>
          <div className="row gap-md">
            <button onClick={() => router.push('/hub')} className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
              ← {t('back')}
            </button>
            <div className="vline" style={{ height: 16 }} />
            <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{t('team')}</div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>· {oeuvres.length} {t('works')}</div>
          </div>
          <div className="row gap-sm">
            <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    padding: '4px 8px',
                    background: lang === l ? 'var(--ac)' : 'transparent',
                    color: lang === l ? 'var(--bg0)' : 'var(--tx3)',
                    fontWeight: lang === l ? 600 : 400,
                    borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="btn ghost sm" onClick={() => router.push('/atelier/works/new')}>
              + {t('newWork')}
            </button>
          </div>
        </div>
        <nav style={{ display: 'flex', padding: '0 28px' }}>
          {TABS.map(([k, lb, cnt]) => (
            <button key={k} className={`navtab ${tab === k ? 'active' : ''}`} onClick={() => handleSetTab(k)}>
              {lb}
              {cnt !== undefined && <span className="cnt">{cnt}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {tab === 'overview' && (
          <OverviewTab oeuvres={oeuvres} tM={tM} t={t as (k: string) => string} onGoTab={handleSetTab} reminderCount={reminderCount} />
        )}

        {tab === 'inventory' && (
          <InventoryTab
            oeuvres={oeuvres}
            techniques={[...techniques].sort((a, b) => (a.Technique ?? '').localeCompare(b.Technique ?? '', 'fr'))}
            supports={[...supports].sort((a, b) => (a.Support ?? '').localeCompare(b.Support ?? '', 'fr'))}
            formats={[...formats].sort((a, b) => (a.Format ?? '').localeCompare(b.Format ?? '', 'fr'))}
            themes={[...themes].sort((a, b) => a.Nom.localeCompare(b.Nom, 'fr'))}
            groups={groups}
            tM={tM} sM={sM} cM={cM} pM={pM} locMap={locMap}
            statusLabelMap={statusLabelMap}
            selection={selection}
            setSelection={setSelection}
            onOpen={setInspected}
          />
        )}

        {tab === 'constellation' && (
          <ConstellationCanvas
            oeuvres={oeuvres}
            tM={tM}
            themes={[...themes].sort((a, b) => a.Nom.localeCompare(b.Nom, 'fr'))}
            groups={groups}
            selection={selection}
            setSelection={setSelection}
            onOpen={setInspected}
            onSaveGroup={handleSaveGroup}
          />
        )}

        {tab === 'production' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ProductionTab
              oeuvres={oeuvres}
              tM={tM}
              statusLabelMap={statusLabelMap}
              onOpen={setInspected}
            />
          </div>
        )}
        {tab === 'logistics' && (
          <LogisticsTab cM={cM} />
        )}
        {tab === 'sales' && (
          <SalesTab
            oeuvres={oeuvres}
            statusLabelMap={statusLabelMap}
            contacts={contacts}
            cM={cM}
            tM={tM}
          />
        )}
        {tab === 'exhibitions' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ExhibitionsTab
              oeuvres={oeuvres}
              contacts={contacts}
              selection={selection}
              setSelection={setSelection}
            />
          </div>
        )}
        {tab === 'vault' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <VaultTab oeuvres={oeuvres} tM={tM} />
          </div>
        )}
        {tab === 'contacts' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ContactsTab contacts={contacts} oeuvres={oeuvres} />
          </div>
        )}
        {tab === 'map' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <WorldMapTab
              contacts={contacts}
              oeuvres={oeuvres}
              tM={tM}
              statusLabelMap={statusLabelMap}
              onOpenContact={(id) => {
                handleSetTab('contacts')
                // ContactsTab reads openContactId from sessionStorage
                sessionStorage.setItem('pem_open_contact', String(id))
              }}
            />
          </div>
        )}
        {tab === 'pipeline' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <PipelineTab />
          </div>
        )}
        {tab === 'fiscal' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <FiscalTab oeuvres={oeuvres} contacts={contacts} />
          </div>
        )}
        {tab === 'themes' && (
          <ThemesTab
            initialThemes={[...themes].sort((a, b) => a.Nom.localeCompare(b.Nom, 'fr'))}
            initialGroups={groups}
            themeWorkCount={themeWorkCount}
            groupWorkCount={groupWorkCount}
          />
        )}

        {tab === 'concepts' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <ConceptsTab />
          </div>
        )}
        {tab === 'stock' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <SupplierHub contacts={contacts} />
          </div>
        )}
      </div>

      {/* ── Work Drawer ─────────────────────────────────────────── */}
      {inspected && (
        <WorkDrawer
          o={inspected}
          tM={tM} sM={sM} cM={cM} pM={pM}
          statusLabelMap={statusLabelMap}
          selection={selection}
          setSelection={setSelection}
          onClose={() => setInspected(null)}
        />
      )}

      {/* ── Curation Dock (non-constellation tabs with selection) ── */}
      {showDock && (
        <CurationDock
          selection={selection}
          setSelection={setSelection}
          oeuvres={oeuvres}
          techniques={techniques}
          supports={supports}
          formats={formats}
          contacts={contacts}
          themes={themes}
          tM={tM}
          sM={sM}
          statusLabelMap={statusLabelMap}
          onGoConstellation={() => {
            sessionStorage.setItem('pem_curation_trigger', 'true')
            handleSetTab('constellation')
          }}
          onSaveGroup={handleSaveGroup}
        />
      )}
    </div>
  )
}

// ── Overview tab ─────────────────────────────────────────────────────

function OverviewTab({
  oeuvres, tM, t, onGoTab, reminderCount,
}: {
  oeuvres:       Oeuvre[]
  tM:            Record<number, string>
  t:             (k: string) => string
  onGoTab:       (tab: Tab) => void
  reminderCount: number
}) {
  const thisYear   = new Date().getFullYear()
  const byYear     = oeuvres.filter((o) => o.Année?.startsWith(String(thisYear))).length
  const withPrice  = oeuvres.filter((o) => o.Prix && o.Prix > 0).length
  const exposable  = oeuvres.filter((o) => o.Exposable).length
  const catalogued = oeuvres.filter((o) => o.Catalogué).length

  // Upcoming deadlines from pipeline
  const [upcoming,  setUpcoming]  = useState<{ nom: string; date_fin: string; deadline_time: string | null; type: string }[]>([])
  const [reminders, setReminders] = useState<{ id: string; message: string; remind_at: string }[]>([])

  useEffect(() => {
    const sb = createClient()
    ;(sb.from('suivi_process') as any)
      .select('nom, date_fin, deadline_time, type, statut')
      .not('date_fin', 'is', null)
      .not('statut', 'in', '("perdu","annule","termine")')
      .order('date_fin', { ascending: true })
      .limit(8)
      .then(({ data }: { data: any[] | null }) => {
        if (data) setUpcoming(data.filter((p) => {
          const d = new Date(p.date_fin); d.setHours(0,0,0,0)
          const n = new Date(); n.setHours(0,0,0,0)
          return Math.ceil((d.getTime()-n.getTime())/86400000) <= 45
        }))
      })
    ;(sb.from('suivi_reminder') as any)
      .select('id, message, remind_at')
      .eq('lu', false)
      .order('remind_at')
      .limit(6)
      .then(({ data }: { data: any[] | null }) => { if (data) setReminders(data) })
  }, [])

  // Technique breakdown
  const byTech = oeuvres.reduce<Record<string, number>>((acc, o) => {
    const k = String(o.Technique ?? 'unknown')
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const topTechs = Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 5)

  function urgencyColor(days: number) {
    if (days < 0)   return '#c06060'
    if (days <= 7)  return '#c08040'
    if (days <= 21) return '#a0a040'
    return 'var(--tx3)'
  }

  return (
    <div style={{ padding: '32px 40px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 48, alignItems: 'start' }}>

      {/* Left: inventory stats + techniques */}
      <div>
        <div className="t-eyebrow" style={{ marginBottom: 24 }}>Overview</div>

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, border: '1px solid var(--bd)', marginBottom: 32 }}>
          {[
            { l: t('works_cap'),                    v: oeuvres.length },
            { l: `${t('thisYear')} (${thisYear})`,  v: byYear },
            { l: t('exposable'),                    v: exposable },
            { l: t('catalogued'),                   v: catalogued },
            { l: t('priced'),                       v: withPrice },
          ].map(({ l, v }) => (
            <div key={l} style={{ padding: '20px 24px', borderRight: '1px solid var(--bd)' }}>
              <div className="stat">
                <span className="l">{l}</span>
                <span className="v">{v}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Technique breakdown */}
        <div style={{ marginBottom: 32 }}>
          <div className="t-label" style={{ marginBottom: 12 }}>{t('byTechnique')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topTechs.map(([techId, count]) => {
              const pct = Math.round((count / oeuvres.length) * 100)
              return (
                <div key={techId} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', alignItems: 'center', gap: 12 }}>
                  <div className="t-mono-sm" style={{ color: 'var(--tx2)' }}>{tM[Number(techId)] ?? '—'}</div>
                  <div style={{ height: 4, background: 'var(--bg2)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--ac)' }} />
                  </div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', textAlign: 'right' }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="row gap-sm">
          <button className="btn ghost sm" onClick={() => onGoTab('inventory')}>Inventory →</button>
          <button className="btn ghost sm" onClick={() => onGoTab('constellation')}>Constellation →</button>
          <button className="btn ghost sm" onClick={() => onGoTab('pipeline')}>
            Pipeline {reminderCount > 0 && <span style={{ marginLeft: 4, background: 'var(--rust)', color: '#fff', borderRadius: '50%', width: 14, height: 14, fontSize: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{reminderCount}</span>}
          </button>
        </div>
      </div>

      {/* Right: pipeline deadlines + reminders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {upcoming.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => onGoTab('pipeline')}>
              {t('upcomingDeadlines')} →
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {upcoming.map((p, i) => {
                const days = Math.ceil((new Date(p.date_fin).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                const col  = urgencyColor(days)
                return (
                  <div key={i} onClick={() => onGoTab('pipeline')} style={{
                    padding: '8px 10px', background: 'var(--bg1)',
                    border: '1px solid var(--bd)', cursor: 'pointer',
                    borderLeft: `3px solid ${col}`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{p.nom}</div>
                    <div style={{ fontSize: 9, color: col, marginTop: 2, fontWeight: days <= 7 ? 700 : 400 }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `in ${days}d`}
                      {' · '}{new Date(p.date_fin).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                      {p.deadline_time ? ` · ${p.deadline_time}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {reminders.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>
              Reminders
              <span style={{ marginLeft: 6, color: 'var(--ac)' }}>({reminders.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {reminders.map((r) => {
                const days = Math.ceil((new Date(r.remind_at).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                return (
                  <div key={r.id} style={{ padding: '8px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 10, color: 'var(--tx)', lineHeight: 1.3 }}>{r.message}</div>
                    <div style={{ fontSize: 9, color: urgencyColor(days), marginTop: 2 }}>
                      {new Date(r.remind_at).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {upcoming.length === 0 && reminders.length === 0 && (
          <div
            style={{ padding: '20px 16px', border: '1px solid var(--bd)', cursor: 'pointer', opacity: 0.5 }}
            onClick={() => onGoTab('pipeline')}
          >
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>No upcoming deadlines.</div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>Go to Pipeline →</div>
          </div>
        )}
      </div>
    </div>
  )
}

//