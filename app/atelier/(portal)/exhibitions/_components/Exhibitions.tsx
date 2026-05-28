'use client'

// Exhibitions — full exhibition hub.
// Left sidebar: all pipeline processes (exhibitions / residencies / fairs).
// Right: selected exhibition detail — steps progress, linked works, contact,
//        dates, notes, and (inside "Mise en espace" sub-tab) the floor plan tool.

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import {
  listExhibitionsWithSteps,
  createExhibitionProcess,
  deleteExhibitionProcess,
  updateExhibitionProcess,
} from '@/app/atelier/(portal)/exhibitions/actions'
import { useI18n } from '@/lib/i18n/context'
import { ExhibitionsTabSkeleton } from '@/components/atelier/ExhibitionsTabSkeleton'
import { ExhibitionsListPanel } from '@/components/atelier/exhibitions/ExhibitionsListPanel'
import { ExhibitionDetail } from '@/components/atelier/exhibitions/ExhibitionDetail'
import type { Exhibition, Step, ExhibitionContact } from '@/components/atelier/exhibitions/exhibitions-types'

// ── Exhibitions ───────────────────────────────────────────────────────────────

export function Exhibitions({ oeuvres, contacts, themes, tM, selection, setSelection }: {
  oeuvres:      Oeuvre[]
  contacts:     ExhibitionContact[]
  themes:       { id: number; name: string }[]
  tM:           Record<number, string>
  selection:    Set<number>
  setSelection: (next: Set<number>) => void
}) {
  const { lang, t } = useI18n()
  const [oauthBanner, setOauthBanner] = useState<string | null>(null)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [selected,    setSelected]    = useState<Exhibition | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<'all' | 'en_cours' | 'gagne' | 'termine'>('all')
  const [creating,    setCreating]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [newNom,      setNewNom]      = useState('')
  const [newType,     setNewType]     = useState('exposition')
  const [deepLinkId,  setDeepLinkId]  = useState<string | null>(null)

  // Optional deep-link: /atelier/exhibitions?exhibition=<processId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('exhibition')
    if (id) setDeepLinkId(id)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('calendar')
    if (!c) return
    if (c === 'google_ok') setOauthBanner(t('calendar_oauth_ok_google'))
    else if (c === 'microsoft_ok') setOauthBanner(t('calendar_oauth_ok_microsoft'))
    else if (c === 'google_err' || c === 'microsoft_err') {
      const code = params.get('calendar_err_code') ?? params.get('calendar_detail')
      setOauthBanner(code ? `${t('calendar_oauth_err')} (${code})` : t('calendar_oauth_err'))
    }
    const u = new URL(window.location.href)
    u.searchParams.delete('calendar')
    u.searchParams.delete('calendar_err_code')
    u.searchParams.delete('calendar_detail')
    const q = u.searchParams.toString()
    window.history.replaceState({}, '', `${u.pathname}${q ? `?${q}` : ''}${u.hash}`)
  }, [t])

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listExhibitionsWithSteps()
    const list: Exhibition[] = 'ok' in result
      ? result.exhibitions.map((ex) => ({ ...ex, steps: ex.steps as Step[] }))
      : []
    setExhibitions(list)
    if (list.length > 0 && !selected) {
      const fromDeepLink = deepLinkId ? (list.find((x) => x.id === deepLinkId) ?? null) : null
      setSelected(fromDeepLink ?? list[0])
    }
    setLoading(false)
  }, [selected, deepLinkId])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!selected) return
    if (!confirm(t('exhib_delete_confirm_fmt').replace(/\{name\}/g, selected.nom))) return
    setLoading(true)
    const result = await deleteExhibitionProcess(selected.id)
    if ('ok' in result) {
      const next = exhibitions.filter(e => e.id !== selected.id)
      setExhibitions(next)
      setSelected(next[0] ?? null)
    }
    setLoading(false)
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nom = String(new FormData(e.currentTarget).get('nom') ?? '').trim()
    if (!nom) return
    setCreating(true)
    const result = await createExhibitionProcess({ nom, type: newType })
    setCreating(false)
    if ('ok' in result) {
      setExhibitions((prev) => [result.exhibition as Exhibition, ...prev])
      setSelected(result.exhibition as Exhibition)
      setNewNom(''); setShowNew(false)
    }
  }

  async function handleUpdateStatus(id: string, patch: Partial<Exhibition> & { _isEditing?: boolean }) {
    const current = exhibitions.find((e) => e.id === id)?.steps ?? []
    const result = await updateExhibitionProcess({
      exhibitionId: id,
      patch: { ...patch, steps: patch.steps as Step[] | undefined },
      currentSteps: current,
    })
    if (!('ok' in result)) {
      console.error('[exhibitions] update error:', result.error)
      return
    }
    const syncedPatch = result.steps ? { ...patch, steps: result.steps as Step[] } : patch
    setExhibitions(prev => prev.map(e => e.id === id ? { ...e, ...syncedPatch } : e))
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...syncedPatch } : null)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return exhibitions
    return exhibitions.filter((e) => e.statut === filter)
  }, [exhibitions, filter])

  if (loading && exhibitions.length === 0) return <ExhibitionsTabSkeleton />

  return (
    <div data-testid="exhibitions-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {oauthBanner && (
        <div style={{
          padding: '8px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--bd)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span style={{ fontSize: 12 }}>{oauthBanner}</span>
          <button type="button" className="btn ghost sm" onClick={() => setOauthBanner(null)}>
            {t('close')}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ExhibitionsListPanel
          selectedId={selected?.id ?? null}
          exhibitions={exhibitions}
          filteredExhibitions={filtered}
          filter={filter}
          showNew={showNew}
          creating={creating}
          newNom={newNom}
          newType={newType}
          lang={lang}
          onSelect={(id) => setSelected(exhibitions.find((ex) => ex.id === id) ?? null)}
          onToggleNew={() => setShowNew((v) => !v)}
          onSetFilter={setFilter}
          onCreate={handleCreate}
          onCancelCreate={() => setShowNew(false)}
          onSetNewNom={setNewNom}
          onSetNewType={setNewType}
        />

        {selected ? (
          <ExhibitionDetail
            key={selected.id}
            exhibition={selected}
            oeuvres={oeuvres}
            contacts={contacts}
            themes={themes}
            tM={tM}
            selection={selection}
            setSelection={setSelection}
            onDelete={handleDelete}
            onUpdate={(p) => handleUpdateStatus(selected.id, p)}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>
            {t('exh_select_or_create')}
          </div>
        )}
      </div>
    </div>
  )
}
