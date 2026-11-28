'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { toast } from '@/lib/ui/toast'
import { getLiveDictationAvailability, startLiveDictation, type LiveDictationSession } from '@/lib/voice/web-speech'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'
import {
  addStudioPlace, closePcProposal, listEquipment, listPcProposals, saveStockItem, sendWalkToPc,
  type EquipmentCondition, type EquipmentItem, type PcProposal, type StudioKind, type StudioPlace,
} from '@/app/atelier/(portal)/stock/equipment-actions'
import { splitSpokenList } from '@/lib/equipment-lines'

/** The « Sans lieu » node: Équipement lines not placed yet. */
const UNPLACED = -1
const CONDITIONS: EquipmentCondition[] = ['bon', 'a_reparer', 'hors_service', 'prete']
const CHILD_KINDS: Exclude<StudioKind, 'studio'>[] = ['zone', 'furniture', 'container']
const field = { width: '100%', minHeight: 44, fontSize: 16, padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg0)', color: 'var(--tx)' } as const

type Draft = { id: number | null; readUpdatedAt: string | null; name: string; condition: EquipmentCondition | null; year: string; placeId: number | null; notes: string }
type Proposed = { name: string; quantity: number; keep: boolean }
const ERR_CODES = new Set(['auth', 'forbidden', 'bad_field', 'not_found', 'db', 'empty', 'already', 'unchanged'])

/**
 * Équipement (Equipment.md steps 3–4): the studio tree, what sits where, one item's card, and the voice walk —
 * stand at a shelf, say what is there, tick the proposed lines. Phone and desk use the same view (a list reads well
 * on both). Writes: `saveStockItem` (the Stock door) and `addStudioPlace`. The voice walk splits on the device, or
 * « Envoyer au PC » queues it for the studio PC's Ollama (`sendWalkToPc`); its lines come back as « Proposé par le PC ».
 */
export function EquipmentView() {
  const { t, lang } = useI18n()
  const [places, setPlaces] = useState<StudioPlace[]>([])
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [here, setHere] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [newPlace, setNewPlace] = useState<{ name: string; kind: Exclude<StudioKind, 'studio'> } | null>(null)
  const [walk, setWalk] = useState<{ text: string; listening: boolean; proposed: Proposed[] | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pc, setPc] = useState<PcProposal[]>([])
  const [pcOpen, setPcOpen] = useState(false)
  /** Per proposal: its lines as ticked / renamed in the sheet (from the PC's answer until touched). */
  const [pcPick, setPcPick] = useState<Record<number, Proposed[]>>({})
  const session = useRef<LiveDictationSession | null>(null)
  /** False once the walk sheet closes or the view unmounts: a dictation that starts after that is stopped at once. */
  const walkOpen = useRef(false)
  const errText = useCallback((code: string, detail?: string) => (ERR_CODES.has(code) ? t(`eq_err_${code}` as DictKey) : code) + (detail ? ` (${detail})` : ''), [t])

  const load = useCallback(async () => {
    const r = await listEquipment()
    if ('error' in r) toast.error(t('eq_load_error').replace('{e}', errText(r.error)))
    else { setPlaces(r.places); setItems(r.items) }
    const q = await listPcProposals()
    if (!('error' in q)) setPc(q.rows)
    setLoading(false)
  }, [t, errText])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => { walkOpen.current = false; session.current?.stop() }, [])

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const roots = useMemo(() => places.filter((p) => p.parent_id == null || !byId.has(p.parent_id)), [places, byId])
  const children = here == null ? roots : here === UNPLACED ? [] : places.filter((p) => p.parent_id === here)
  // A line whose place is gone from the tree (archived) counts as « Sans lieu », so it never disappears.
  const isUnplaced = (i: EquipmentItem) => i.place_id == null || !byId.has(i.place_id)
  const hereItems = here == null ? [] : items.filter((i) => (here === UNPLACED ? isUnplaced(i) : i.place_id === here))
  const unplacedCount = items.filter(isUnplaced).length
  const current = here != null && here !== UNPLACED ? byId.get(here) : undefined
  const pathLabel = (id: number | null): string => {
    const names: string[] = []
    for (let p = id != null ? byId.get(id) : undefined; p; p = p.parent_id != null ? byId.get(p.parent_id) : undefined) names.unshift(p.name)
    return names.join(' › ')
  }
  const placeOptions = useMemo(() => places.map((p) => {
    const names: string[] = []
    for (let n: StudioPlace | undefined = p; n; n = n.parent_id != null ? byId.get(n.parent_id) : undefined) names.unshift(n.name)
    return { id: p.id, label: names.join(' › ') }
  }).sort((a, b) => a.label.localeCompare(b.label, lang)), [places, byId, lang])
  const kindLabel = (k: StudioKind) => t(`eq_kind_${k}` as DictKey)
  const condLabel = (c: EquipmentCondition) => t(`eq_cond_${c}` as DictKey)
  const countUnder = (id: number) => items.filter((i) => i.place_id === id).length + places.filter((p) => p.parent_id === id).length

  const openItem = (it: EquipmentItem) => setDraft({
    id: it.id, readUpdatedAt: it.updated_at, name: it.name, condition: it.condition,
    year: it.acquired_on ? it.acquired_on.slice(0, 4) : '', placeId: it.place_id, notes: it.notes ?? '',
  })

  const saveDraft = async () => {
    if (!draft || !draft.name.trim()) return
    setBusy(true)
    const year = /^\d{4}$/.test(draft.year.trim()) ? draft.year.trim() : null
    const r = await saveStockItem({
      id: draft.id,
      readUpdatedAt: draft.readUpdatedAt,
      fields: {
        name: draft.name.trim(), condition: draft.condition, place_id: draft.placeId, notes: draft.notes.trim() || null,
        acquired_on: year ? `${year}-01-01` : null, acquired_precision: year ? 'year' : null,
        ...(draft.id == null ? { category: 'Équipement', quantity: 1, unit: '' } : {}),
      },
    })
    setBusy(false)
    if ('error' in r) { toast.error(t('eq_error').replace('{e}', errText(r.error))); return }
    if ('refused' in r) {
      if (r.refused === 'stale' && r.item) { toast.error(t('eq_stale')); openItem(r.item); await load(); return }
      toast.error(t('eq_error').replace('{e}', errText(r.refused, r.detail))); return
    }
    setDraft(null)
    await load()
  }

  const savePlace = async () => {
    if (!newPlace || !newPlace.name.trim() || here == null || here === UNPLACED) return
    setBusy(true)
    const r = await addStudioPlace(newPlace.name, newPlace.kind, here)
    setBusy(false)
    if ('error' in r) { toast.error(t('eq_error').replace('{e}', errText(r.error))); return }
    setNewPlace(null)
    await load()
  }

  const startWalk = async () => {
    walkOpen.current = true
    setWalk({ text: '', listening: false, proposed: null })
    if (getLiveDictationAvailability() !== 'ready') return
    setWalk((w) => (w ? { ...w, listening: true } : w))
    const s = await startLiveDictation(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      onInterim: () => {},
      onFinal: (chunk) => setWalk((w) => (w ? { ...w, text: `${w.text} ${chunk}`.trim() } : w)),
      onError: () => setWalk((w) => (w ? { ...w, listening: false } : w)),
    })
    if (!walkOpen.current) { s.stop(); return }
    session.current = s
    if (!s.ok) setWalk((w) => (w ? { ...w, listening: false } : w))
  }
  const stopListening = () => { session.current?.stop(); session.current = null; setWalk((w) => (w ? { ...w, listening: false } : w)) }
  const closeWalk = () => { walkOpen.current = false; stopListening(); setWalk(null) }
  const propose = () => {
    if (!walk?.text.trim()) return
    stopListening()
    setWalk((w) => (w ? { ...w, proposed: splitSpokenList(w.text).map((l) => ({ ...l, keep: true })) } : w))
  }
  const addProposed = async () => {
    const list = walk?.proposed ?? []
    if (!list.some((p) => p.keep && p.name.trim()) || here == null) return
    setBusy(true)
    let added = 0
    const left: Proposed[] = []
    for (const p of list) {
      if (!p.keep || !p.name.trim()) continue
      const r = await saveStockItem({ fields: { name: p.name.trim(), category: 'Équipement', quantity: p.quantity, unit: '', place_id: here === UNPLACED ? null : here } })
      if ('ok' in r) added++
      else left.push(p)
    }
    setBusy(false)
    await load()
    if (!left.length) { toast.success(t('eq_added_n').replace('{n}', String(added))); closeWalk(); return }
    // Principle 3: what did not save stays in the sheet, ticked, and says so.
    toast.error(t('eq_added_failed').replace('{n}', String(added)).replace('{m}', String(left.length)))
    setWalk((w) => (w ? { ...w, proposed: left } : w))
  }

  const sendToPc = async () => {
    if (!walk?.text.trim() || here == null) return
    stopListening()
    setBusy(true)
    const r = await sendWalkToPc({ walkId: crypto.randomUUID(), text: walk.text, placeId: here === UNPLACED ? null : here, lang: lang === 'en' ? 'en' : 'fr' })
    setBusy(false)
    if ('error' in r) { toast.error(t('eq_error').replace('{e}', errText(r.error))); return }
    toast.success(t('eq_pc_sent'))
    closeWalk()
    await load()
  }

  const pickOf = (p: PcProposal): Proposed[] => pcPick[p.id] ?? p.lines.map((l) => ({ name: l.name, quantity: l.quantity, keep: true }))
  const setPick = (id: number, list: Proposed[]) => setPcPick((m) => ({ ...m, [id]: list }))
  const addFromPc = async (p: PcProposal) => {
    const list = pickOf(p).filter((x) => x.keep && x.name.trim())
    if (!list.length) return
    setBusy(true)
    // Claim the proposal first: a second tap or another phone gets « rien n'a changé », never the lines twice.
    const c = await closePcProposal(p.id, 'accepted')
    if ('error' in c) { setBusy(false); toast.error(t('eq_error').replace('{e}', errText(c.error))); await load(); return }
    // The place it was said in; archived since → « Sans lieu », so nothing is lost.
    const placeId = p.placeId != null && byId.has(p.placeId) ? p.placeId : null
    const left: Proposed[] = []
    for (const x of list) {
      const r = await saveStockItem({ fields: { name: x.name.trim(), category: 'Équipement', quantity: x.quantity, unit: '', place_id: placeId } })
      if (!('ok' in r)) left.push(x)
    }
    setBusy(false)
    await load()
    if (!left.length) { toast.success(t('eq_added_n').replace('{n}', String(list.length))); return }
    // Principle 3: what did not save opens in the walk sheet at that place, ticked, to add again.
    toast.error(t('eq_added_failed').replace('{n}', String(list.length - left.length)).replace('{m}', String(left.length)))
    setPcOpen(false)
    setHere(placeId ?? UNPLACED)
    walkOpen.current = true
    setWalk({ text: p.text, listening: false, proposed: left })
  }
  /** A walk the PC could not read: queue the same words again, then close the failed one. */
  const resendPc = async (p: PcProposal) => {
    setBusy(true)
    const r = await sendWalkToPc({ walkId: crypto.randomUUID(), text: p.text, placeId: p.placeId, lang: lang === 'en' ? 'en' : 'fr' })
    if (!('error' in r)) await closePcProposal(p.id, 'rejected')
    setBusy(false)
    if ('error' in r) toast.error(t('eq_error').replace('{e}', errText(r.error)))
    else toast.success(t('eq_pc_sent'))
    await load()
  }
  const ignorePc = async (p: PcProposal) => {
    const c = await closePcProposal(p.id, 'rejected')
    if ('error' in c) toast.error(t('eq_error').replace('{e}', errText(c.error)))
    await load()
  }

  const inPlace = here != null && here !== UNPLACED

  return (
    <div data-testid="equipment-view" style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', padding: '12px 12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
        {here != null ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setHere(current?.parent_id != null && byId.has(current.parent_id) ? current.parent_id : null)}>{t('eq_back')}</button>
        ) : null}
        <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {here == null ? t('eq_title_root') : here === UNPLACED ? t('eq_unplaced') : pathLabel(here)}
        </h2>
      </div>
      {pc.length ? (
        <div style={{ margin: '8px 0' }}>
          <PhoneChip label={t('eq_pc_proposed_fmt').replace('{n}', String(pc.filter((p) => p.status === 'done').length))} onClick={() => setPcOpen(true)} testId="equipment-pc-proposed" />
        </div>
      ) : null}
      {inPlace || here === UNPLACED ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          <button type="button" className="btn primary sm" data-testid="equipment-say" style={{ minHeight: 44 }} onClick={() => void startWalk()}>{t('eq_say')}</button>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setDraft({ id: null, readUpdatedAt: null, name: '', condition: 'bon', year: '', placeId: inPlace ? here : null, notes: '' })}>{t('eq_add_item')}</button>
          {inPlace ? <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setNewPlace({ name: '', kind: 'furniture' })}>{t('eq_add_place')}</button> : null}
        </div>
      ) : null}

      {loading ? <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('loading')}</p> : null}
      {!loading && here == null && roots.length === 0 ? <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('eq_no_studio')}</p> : null}

      <ul style={{ margin: 0, padding: 0 }}>
        {children.map((p) => (
          <PhoneListRow key={`p${p.id}`} title={p.name} sub={kindLabel(p.kind)} value={String(countUnder(p.id))} onClick={() => setHere(p.id)} testId={`equipment-place-${p.id}`} />
        ))}
        {here == null && unplacedCount > 0 ? (
          <PhoneListRow title={t('eq_unplaced')} value={String(unplacedCount)} onClick={() => setHere(UNPLACED)} testId="equipment-unplaced" />
        ) : null}
        {hereItems.map((it) => (
          <PhoneListRow
            key={`i${it.id}`}
            title={it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name}
            sub={[it.condition ? condLabel(it.condition) : '', it.acquired_on ? it.acquired_on.slice(0, 4) : ''].filter(Boolean).join(' · ')}
            alert={it.condition === 'hors_service' || it.condition === 'a_reparer'}
            value={it.condition && it.condition !== 'bon' ? condLabel(it.condition) : undefined}
            onClick={() => openItem(it)}
            testId={`equipment-item-${it.id}`}
          />
        ))}
      </ul>
      {!loading && here != null && children.length === 0 && hereItems.length === 0 ? <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('eq_empty')}</p> : null}

      {draft ? (
        <PhoneSheet
          title={draft.id == null ? t('eq_add_item') : draft.name}
          onClose={() => setDraft(null)}
          testId="equipment-item-sheet"
          footer={<button type="button" className="btn primary" disabled={busy || !draft.name.trim()} onClick={() => void saveDraft()} style={{ width: '100%', minHeight: 48 }}>{t('eq_save')}</button>}
        >
          <label className="t-eyebrow" style={{ color: 'var(--tx3)' }}>{t('eq_name')}</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={field} />
          <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginTop: 12 }}>{t('eq_condition')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {CONDITIONS.map((c) => <PhoneChip key={c} label={condLabel(c)} active={draft.condition === c} onClick={() => setDraft({ ...draft, condition: draft.condition === c ? null : c })} />)}
          </div>
          <label className="t-eyebrow" style={{ color: 'var(--tx3)', display: 'block', marginTop: 12 }}>{t('eq_acquired_year')}</label>
          <input value={draft.year} inputMode="numeric" maxLength={4} onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, '') })} style={{ ...field, width: 120 }} />
          <label className="t-eyebrow" style={{ color: 'var(--tx3)', display: 'block', marginTop: 12 }}>{t('eq_place')}</label>
          <select value={draft.placeId ?? ''} onChange={(e) => setDraft({ ...draft, placeId: e.target.value ? Number(e.target.value) : null })} style={field}>
            <option value="">{t('eq_unplaced')}</option>
            {placeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label className="t-eyebrow" style={{ color: 'var(--tx3)', display: 'block', marginTop: 12 }}>{t('eq_notes')}</label>
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} style={{ ...field, minHeight: 88 }} />
        </PhoneSheet>
      ) : null}

      {newPlace ? (
        <PhoneSheet
          title={t('eq_add_place')}
          onClose={() => setNewPlace(null)}
          footer={<button type="button" className="btn primary" disabled={busy || !newPlace.name.trim()} onClick={() => void savePlace()} style={{ width: '100%', minHeight: 48 }}>{t('eq_save')}</button>}
        >
          <input value={newPlace.name} autoFocus placeholder={t('eq_name')} onChange={(e) => setNewPlace({ ...newPlace, name: e.target.value })} style={field} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {CHILD_KINDS.map((k) => <PhoneChip key={k} label={kindLabel(k)} active={newPlace.kind === k} onClick={() => setNewPlace({ ...newPlace, kind: k })} />)}
          </div>
        </PhoneSheet>
      ) : null}

      {walk ? (
        <PhoneSheet
          title={walk.proposed ? t('eq_proposed_title') : t('eq_say')}
          onClose={closeWalk}
          testId="equipment-walk-sheet"
          footer={walk.proposed ? (
            <button type="button" className="btn primary" disabled={busy || !walk.proposed.some((p) => p.keep)} onClick={() => void addProposed()} style={{ width: '100%', minHeight: 48 }}>
              {t('eq_add_n').replace('{n}', String(walk.proposed.filter((p) => p.keep).length))}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost" disabled={busy || !walk.text.trim()} onClick={() => void sendToPc()} data-testid="equipment-send-pc" style={{ flex: 1, minHeight: 48 }}>{t('eq_send_pc')}</button>
              <button type="button" className="btn primary" disabled={busy || !walk.text.trim()} onClick={propose} style={{ flex: 1, minHeight: 48 }}>{t('eq_propose')}</button>
            </div>
          )}
        >
          {walk.proposed ? (
            <>
              <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('eq_proposed_split')}</p>
              {walk.proposed.map((p, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderBottom: '1px solid var(--bd)' }}>
                  <input type="checkbox" checked={p.keep} onChange={(e) => setWalk({ ...walk, proposed: walk.proposed!.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)) })} style={{ width: 22, height: 22 }} />
                  <input value={p.name} onChange={(e) => setWalk({ ...walk, proposed: walk.proposed!.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} style={{ ...field, minHeight: 40 }} />
                  {p.quantity > 1 ? <span className="t-mono-sm">×{p.quantity}</span> : null}
                </label>
              ))}
            </>
          ) : (
            <>
              {walk.listening ? (
                <button type="button" className="btn ghost" onClick={stopListening} style={{ width: '100%', minHeight: 48, marginBottom: 8 }}>{t('eq_listening')}</button>
              ) : getLiveDictationAvailability() !== 'ready' ? (
                <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('eq_no_dictation')}</p>
              ) : null}
              <textarea value={walk.text} placeholder={t('eq_typed_ph')} onChange={(e) => setWalk({ ...walk, text: e.target.value })} rows={4} style={{ ...field, minHeight: 110 }} />
            </>
          )}
        </PhoneSheet>
      ) : null}

      {pcOpen ? (
        <PhoneSheet title={t('eq_pc_title')} onClose={() => setPcOpen(false)} testId="equipment-pc-sheet">
          {pc.length === 0 ? <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('eq_pc_none')}</p> : null}
          {pc.map((p) => (
            <section key={p.id} style={{ borderBottom: '1px solid var(--bd)', padding: '10px 0' }}>
              <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>{p.placeId != null && byId.has(p.placeId) ? pathLabel(p.placeId) : t('eq_unplaced')}</div>
              <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--tx2)' }}>« {p.text} »</p>
              {p.status === 'failed' ? (
                <>
                  <p className="t-mono-sm" style={{ color: 'var(--rust)', margin: 0 }}>{t('eq_pc_failed')}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void ignorePc(p)} style={{ flex: 1, minHeight: 44 }}>{t('eq_pc_ignore')}</button>
                    <button type="button" className="btn primary" disabled={busy} onClick={() => void resendPc(p)} style={{ flex: 1, minHeight: 44 }}>{t('eq_pc_resend')}</button>
                  </div>
                </>
              ) : p.status !== 'done' ? (
                <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: 0 }}>{t('eq_pc_waiting')}</p>
              ) : (
                <>
                  {pickOf(p).map((x, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
                      <input type="checkbox" checked={x.keep} onChange={(e) => setPick(p.id, pickOf(p).map((y, j) => (j === i ? { ...y, keep: e.target.checked } : y)))} style={{ width: 22, height: 22 }} />
                      <input value={x.name} onChange={(e) => setPick(p.id, pickOf(p).map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} style={{ ...field, minHeight: 40 }} />
                      {x.quantity > 1 ? <span className="t-mono-sm">×{x.quantity}</span> : null}
                    </label>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void ignorePc(p)} style={{ flex: 1, minHeight: 44 }}>{t('eq_pc_ignore')}</button>
                    <button type="button" className="btn primary" disabled={busy || !pickOf(p).some((x) => x.keep)} onClick={() => void addFromPc(p)} style={{ flex: 1, minHeight: 44 }}>
                      {t('eq_add_n').replace('{n}', String(pickOf(p).filter((x) => x.keep).length))}
                    </button>
                  </div>
                </>
              )}
            </section>
          ))}
        </PhoneSheet>
      ) : null}
    </div>
  )
}
