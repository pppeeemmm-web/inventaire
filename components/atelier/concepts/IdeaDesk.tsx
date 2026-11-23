'use client'

// One idea's desk (design IdeasDesign.md §3–§5, mockup Ideas_Mockup.html). Its moments (newest first, the
// Journal's own cards — each one also lives on its day), its Texte (the one living text, versions kept by the
// database), Documents (Vault), Œuvres, Branches, Idées liées, and the seed with what it has grown. Writing
// into the idea writes a Journal entry on today linked to it. Phone: one column with segments; desk: Fil |
// Texte in the centre and a rail on the right (`wide`).

import { useCallback, useEffect, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { WorkRef } from '@/components/atelier/WorkRef'
import { EntryCard } from '@/components/journal/JournalStream'
import { ConceptDocuments } from '@/components/atelier/concepts/ConceptDocuments'
import { PlantIdeaSheet } from '@/components/atelier/concepts/PlantIdeaSheet'
import { ideaErrorText, SEED, STAGES, stageOffer, type Stage } from '@/components/atelier/concepts/idea-ui'
import { deleteIdea, saveIdeaText, setIdeaParent, setIdeaStage, writeInIdea } from '@/app/atelier/(portal)/concepts/idea-actions'
import { promoteConcept } from '@/app/atelier/(portal)/concepts/actions'
import { convertConceptToProcess } from '@/app/atelier/(portal)/pipeline/actions'
import { imageUrl } from '@/lib/data'
import { VoiceNoteSheet } from '@/components/shared/VoiceNoteSheet'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import type { IdeaDesk as Desk, IdeaHistory, IdeaListRow } from '@/lib/ideas/read'

type Seg = 'fil' | 'texte' | 'docs' | 'oeuvres' | 'branches'

const h3: CSSProperties = { fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 6px' }
const rowSt: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bd)', fontSize: 13, minHeight: 44, width: '100%', background: 'none', border: 0, borderBlockEnd: '1px solid var(--bd)', textAlign: 'left', color: 'var(--tx)', cursor: 'pointer' }
const small: CSSProperties = { display: 'block', color: 'var(--tx3)', fontSize: 11.5 }

export function IdeaDesk({
  id,
  wide,
  onOpen,
  onBack,
  onChanged,
}: {
  id: string
  wide: boolean
  onOpen: (id: string) => void
  onBack?: () => void
  /** The list should be read again (stage, title, branch or a new moment changed it). */
  onChanged: () => void
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [desk, setDesk] = useState<Desk | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [seg, setSeg] = useState<Seg>('fil')
  const [draft, setDraft] = useState('')
  const [text, setText] = useState('')
  const [planting, setPlanting] = useState(false)
  const [grafting, setGrafting] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    const r = await fetch(`/api/ideas?id=${id}`, { cache: 'no-store' })
    const j = (await r.json().catch(() => ({ error: 'failed' }))) as Desk | { error: string }
    if ('error' in j) {
      setFailed(j.error)
      return
    }
    setFailed(null)
    setDesk(j)
    setText(j.idea.text)
  }, [id])

  useEffect(() => {
    setDesk(null)
    setSeg('fil')
    setPlanting(false)
    setGrafting(false)
    setAsking(false)
    void load()
  }, [load])

  const shortDay = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(locale, { timeZone: iso.length === 10 ? 'UTC' : 'Europe/Paris', day: 'numeric', month: 'short' })

  async function step(fn: () => Promise<{ ok: true } | { error: string }>, done: string | null) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if ('error' in res) {
      toast.error(ideaErrorText(res.error, t))
      return false
    }
    if (done) toast.success(done)
    await load()
    onChanged()
    return true
  }

  if (failed) return <p style={{ color: 'var(--tx3)', padding: 16 }}>{ideaErrorText(failed, t)}</p>
  if (!desk) return <p style={{ color: 'var(--tx3)', padding: 16 }}>{t('it_loading')}</p>

  const i = desk.idea
  const offer = stageOffer({ stage: i.stage, days: i.days, works: i.works, documents: i.documents, hasText: !!i.text.trim() })
  const textDirty = text !== i.text

  const historyLine = (h: IdeaHistory): string => {
    if (h.what === 'planted') return t('it_hist_planted')
    if (h.what === 'stage') return t('it_hist_stage').replace('{seed}', `${SEED[(h.to as Stage) ?? 'graine'] ?? ''} ${t(`ideas_maturity_${h.to}` as never)}`)
    if (h.what === 'title') return t('it_hist_title').replace('{title}', h.to ?? '—')
    if (h.what === 'text') return t('it_hist_text')
    return t(h.to ? 'it_hist_parent' : 'it_hist_trunk')
  }

  // The Fil: moments and the idea's own history, newest first.
  type Item = { at: string; key: string; node: ReactNode }
  const items: Item[] = [
    ...desk.moments.map((e) => ({
      at: `${e.event_on}T${e.created_at.slice(11)}`,
      key: `e${e.id}`,
      node: (
        <div key={`e${e.id}`}>
          <div style={{ fontSize: 12, color: 'var(--ac)', margin: '0 0 4px 2px' }}>
            <a href={`/atelier/journal?day=${e.event_on}`} style={{ color: 'inherit' }}>{shortDay(e.event_on)} ↗</a>
          </div>
          <EntryCard
            e={e}
            isAdmin={desk.isAdmin}
            pending={pending}
            today={todayCalendarDayInParis()}
            refresh={load}
            reloadTop={load}
            run={(fn, done) =>
              start(async () => {
                const res = await fn()
                if ('error' in res) toast.error(ideaErrorText(res.error, t))
                else if (done) toast.success(done)
                await load()
              })
            }
          />
        </div>
      ),
    })),
    ...desk.history.map((h) => ({
      at: h.at,
      key: `h${h.id}`,
      node: (
        <div key={`h${h.id}`} style={{ border: '1px dashed var(--bd2)', borderRadius: 10, padding: '6px 12px', fontSize: 12.5, color: 'var(--tx3)' }}>
          {shortDay(h.at)} · {historyLine(h)}
          {h.by ? ` · ${h.by}` : ''}
        </div>
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const composer = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      {/* 🎤 into the idea (Idées 2026-11-23): the Journal's recorder, aimed here — the note lands on today and in the idea. */}
      <button
        type="button"
        aria-label={t('it_record')}
        title={t('it_record')}
        data-testid="idea-record"
        onClick={() => setVoiceOpen(true)}
        style={{ flex: 'none', width: 52, height: 52, borderRadius: '50%', border: 0, fontSize: 24, cursor: 'pointer', ...MAIN_ACTION_STYLE }}
      >
        🎤
      </button>
      <textarea
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && draft.trim()) void step(() => writeInIdea(id, draft), t('it_written')).then((ok) => ok && setDraft(''))
        }}
        rows={wide ? 2 : 2}
        placeholder={t('it_write_placeholder')}
        data-testid="idea-composer"
        style={{ flex: 1, minWidth: 0, fontSize: 15, padding: 10, minHeight: 44, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        className="btn sm"
        disabled={busy || !draft.trim()}
        data-testid="idea-write"
        onClick={() => void step(() => writeInIdea(id, draft), t('it_written')).then((ok) => ok && setDraft(''))}
        style={{ minHeight: 44, ...(draft.trim() ? MAIN_ACTION_STYLE : {}) }}
      >
        {t('it_write_go')}
      </button>
      {voiceOpen ? (
        <VoiceNoteSheet
          open={voiceOpen}
          conceptId={id}
          onClose={() => setVoiceOpen(false)}
          onSaved={() => {
            void load()
            onChanged()
          }}
        />
      ) : null}
    </div>
  )

  const fil = (
    <div style={{ display: 'grid', gap: 10 }} data-testid="idea-fil">
      {i.sketch && imageUrl(i.sketch) ? (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(i.sketch) ?? ''} alt={t('it_sketch')} style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, objectFit: 'contain' }} />
        </figure>
      ) : null}
      <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('it_fil_hint')}</div>
      {items.length ? items.map((x) => x.node) : <p style={{ color: 'var(--tx3)' }}>{t('it_fil_empty')}</p>}
      {i.oldNotes ? (
        <details style={{ border: '1px dashed var(--bd2)', borderRadius: 10, padding: '8px 12px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--tx3)', fontSize: 13, minHeight: 32 }}>{t('it_old_notes')}</summary>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{i.oldNotes}</p>
        </details>
      ) : null}
    </div>
  )

  const texte = (
    <div style={{ display: 'grid', gap: 8 }}>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('it_text_placeholder')}
        data-testid="idea-text"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: wide ? 420 : 300, fontSize: 16, lineHeight: 1.6, padding: 14, fontFamily: 'Georgia, serif' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" disabled={busy || !textDirty} onClick={() => void step(() => saveIdeaText(id, text), t('it_text_saved'))} data-testid="idea-text-save" style={{ minHeight: 44, ...(textDirty ? MAIN_ACTION_STYLE : {}) }}>
          {t('it_text_save')}
        </button>
        <span style={{ fontSize: 12, color: 'var(--tx3)' }}>
          {t('it_text_versions').replace('{n}', String(desk.history.filter((h) => h.what === 'text').length))}
        </span>
      </div>
    </div>
  )

  const seed = (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 10, background: 'var(--bg1)' }} data-testid="idea-seed">
      <div style={{ display: 'flex', gap: 4, margin: '0 0 8px' }}>
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={i.stage === s}
            disabled={busy || !i.canMoveStage || i.stage === s}
            onClick={() => void step(() => setIdeaStage(id, s), t('it_stage_moved').replace('{stage}', t(`ideas_maturity_${s}` as never)))}
            style={{ flex: 1, minHeight: 44, borderRadius: 8, border: `1px solid ${i.stage === s ? 'var(--ac)' : 'var(--bd2)'}`, background: i.stage === s ? 'var(--bg3)' : 'var(--bg2)', color: i.stage === s ? 'var(--tx)' : 'var(--tx3)', fontSize: 12, cursor: i.canMoveStage ? 'pointer' : 'default' }}
          >
            {SEED[s]}
            <br />
            {t(`ideas_maturity_${s}` as never)}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', fontVariantNumeric: 'tabular-nums' }}>
        {t('it_signals')
          .replace('{m}', String(i.moments))
          .replace('{d}', String(i.days))
          .replace('{w}', String(i.works))
          .replace('{doc}', String(i.documents))
          .replace('{b}', String(i.branches))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>
        {i.mine ? t('it_stage_yours') : i.canMoveStage ? t('it_stage_other_admin').replace('{name}', i.author ?? '—') : t('it_stage_other').replace('{name}', i.author ?? '—')}
      </div>
      {i.canMoveStage && (offer === 'pousse' || offer === 'mure') ? (
        <button type="button" className="btn sm" disabled={busy} onClick={() => void step(() => setIdeaStage(id, offer), t('it_stage_moved').replace('{stage}', t(`ideas_maturity_${offer}` as never)))} style={{ marginTop: 8, minHeight: 44, ...MAIN_ACTION_STYLE }} data-testid="idea-offer">
          {t(offer === 'pousse' ? 'it_offer_pousse' : 'it_offer_mure')}
        </button>
      ) : null}
      {offer === 'done' ? (
        <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 8, display: 'grid', gap: 6 }}>
          <span>{i.becameWork != null ? t('it_became_work').replace('{id}', String(i.becameWork)) : i.becameProject ? t('it_became_project') : t('it_ripe_hint')}</span>
          {desk.isAdmin && i.becameWork == null ? (
            <Become
              busy={busy}
              project={!i.becameProject}
              onProject={() => void step(async () => { const r = await convertConceptToProcess(id, 'autre'); return r && 'error' in r && r.error ? { error: String(r.error) } : { ok: true as const } }, t('it_became_project'))}
              onWork={(n) => void step(() => promoteConcept(id, n), t('it_became_work').replace('{id}', String(n)))}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )

  const docs = <ConceptDocuments key={id} conceptId={id} initialDocs={desk.documents} canEdit={desk.isAdmin} />

  const works = desk.works.length ? (
    desk.works.map((w) => (
      <div key={w.id} style={{ ...rowSt, cursor: 'default' }}>
        <WorkRef id={w.id} href={`/atelier/inventory?work=${w.id}`} />
        <span style={small}>{w.mentions ? t('it_named_in').replace('{n}', String(w.mentions)) : t('it_became_this')}</span>
      </div>
    ))
  ) : (
    <div style={{ color: 'var(--tx3)', fontSize: 13 }}>{t('it_no_works')}</div>
  )

  const branchRow = (b: IdeaListRow) => (
    <button key={b.id} type="button" style={rowSt} onClick={() => onOpen(b.id)} data-testid={`idea-branch-${b.id}`}>
      <span style={{ fontSize: 18 }}>{SEED[b.stage]}</span>
      <span style={{ minWidth: 0 }}>
        {b.title}
        <span style={small}>{t('it_row_counts').replace('{m}', String(b.moments)).replace('{d}', String(b.days))}</span>
      </span>
    </button>
  )

  const branches = (
    <div>
      {desk.branches.length ? desk.branches.map(branchRow) : <div style={{ color: 'var(--tx3)', fontSize: 13 }}>{t('it_no_branches')}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn ghost sm" onClick={() => setPlanting(true)} style={{ minHeight: 44 }} data-testid="idea-add-branch">
          {t('it_add_branch')}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setGrafting((v) => !v)} style={{ minHeight: 44 }} data-testid="idea-graft">
          {t('it_graft')}
        </button>
      </div>
      {planting ? (
        <div style={{ marginTop: 8 }}>
          <PlantIdeaSheet parentId={id} onClose={() => setPlanting(false)} onPlanted={(nid) => { setPlanting(false); onChanged(); onOpen(nid) }} />
        </div>
      ) : null}
      {grafting ? <GraftPicker self={id} current={i.parentId} onPick={(p) => void step(() => setIdeaParent(id, p), t('it_grafted')).then((ok) => ok && setGrafting(false))} /> : null}
      <h3 style={h3}>{t('it_linked')}</h3>
      {desk.linked.length ? (
        desk.linked.map((l) => (
          <button key={l.id} type="button" style={rowSt} onClick={() => onOpen(l.id)}>
            <span style={{ fontSize: 18 }}>{SEED[l.stage]}</span>
            <span>
              {l.title}
              <span style={small}>{t('it_linked_by').replace('{day}', l.day ? shortDay(l.day) : '—')}</span>
            </span>
          </button>
        ))
      ) : (
        <div style={{ color: 'var(--tx3)', fontSize: 13 }}>{t('it_no_linked')}</div>
      )}
      {i.canDelete ? (
        <div style={{ marginTop: 18 }}>
          {asking ? (
            <div role="alertdialog" style={{ padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 13 }}>{t('it_delete_ask')}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn sm" disabled={busy} style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'var(--rust)' }} onClick={() => void deleteIdea(id).then((r) => { if ('error' in r) toast.error(ideaErrorText(r.error, t)); else { toast.success(t('it_deleted')); onChanged(); onBack?.() } setAsking(false) })}>
                  {t('it_delete_yes')}
                </button>
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setAsking(false)}>
                  {t('it_cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn ghost sm" style={{ minHeight: 44, color: 'var(--rust)' }} onClick={() => setAsking(true)}>
              {t('it_delete')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )

  const header = (
    <div style={{ padding: wide ? '14px 20px 8px' : '8px 12px 6px', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {onBack ? (
          <button type="button" aria-label={t('it_back')} onClick={onBack} style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0, fontSize: 22, color: 'var(--tx2)', cursor: 'pointer' }}>
            ‹
          </button>
        ) : null}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {desk.path.length ? (
              desk.path.map((p, n) => (
                <span key={p.id}>
                  {n ? ' › ' : ''}
                  <button type="button" onClick={() => onOpen(p.id)} style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
                    {p.title}
                  </button>
                </span>
              ))
            ) : (
              t('it_trunk')
            )}
            {' · '}
            {i.author ? t('it_planted_by').replace('{name}', i.author) : null}
          </div>
          <h2 style={{ margin: '2px 0 0', fontSize: wide ? 19 : 17, fontWeight: 600, overflowWrap: 'anywhere' }} data-testid="idea-title">
            {SEED[i.stage]} {i.title}
          </h2>
        </div>
      </div>
    </div>
  )

  if (wide) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', height: '100%', minHeight: 0 }} data-testid="idea-desk">
        <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: '1px solid var(--bd)' }}>
          {header}
          <div role="tablist" style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid var(--bd)' }}>
            {(['fil', 'texte'] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={seg === s} onClick={() => setSeg(s)} style={{ background: 'none', border: 0, borderBottom: `2px solid ${seg === s ? 'var(--ac)' : 'transparent'}`, padding: '8px 10px', minHeight: 40, color: seg === s ? 'var(--tx)' : 'var(--tx3)', cursor: 'pointer' }}>
                {t(`it_seg_${s}` as never)}
              </button>
            ))}
          </div>
          {seg === 'fil' ? <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bd)' }}>{composer}</div> : null}
          <div style={{ overflow: 'auto', padding: '12px 20px 40px', flex: 1 }}>{seg === 'texte' ? texte : fil}</div>
        </section>
        <aside style={{ overflow: 'auto', padding: 14, background: 'var(--bg0)' }} data-testid="idea-rail">
          <h3 style={{ ...h3, marginTop: 0 }}>{t('it_stage')}</h3>
          {seed}
          {docs}
          <h3 style={h3}>{t('it_seg_oeuvres')}</h3>
          {works}
          <h3 style={h3}>{t('it_seg_branches')}</h3>
          {branches}
        </aside>
      </div>
    )
  }

  return (
    <div data-testid="idea-desk" style={{ paddingBottom: 24 }}>
      {header}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 12px', borderBottom: '1px solid var(--bd)' }}>
        {(['fil', 'texte', 'docs', 'oeuvres', 'branches'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={seg === s} onClick={() => setSeg(s)} style={{ flex: 'none', minHeight: 36, padding: '0 12px', borderRadius: 999, border: `1px solid ${seg === s ? 'var(--ac)' : 'var(--bd2)'}`, background: 'none', color: seg === s ? 'var(--ac)' : 'var(--tx2)', fontSize: 13, cursor: 'pointer' }}>
            {t(`it_seg_${s}` as never)}
          </button>
        ))}
      </div>
      <div style={{ padding: '10px 12px', display: 'grid', gap: 12 }}>
        {seg === 'fil' ? (
          <>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ac)', marginBottom: 4 }}>{t('it_write_aim').replace('{title}', i.title)}</div>
              {composer}
            </div>
            {seed}
            {fil}
          </>
        ) : seg === 'texte' ? (
          texte
        ) : seg === 'docs' ? (
          docs
        ) : seg === 'oeuvres' ? (
          works
        ) : (
          branches
        )}
      </div>
    </div>
  )
}

/** « Greffer sur… »: pick the idea this one grows on (or make it a trunk). The database refuses a loop. */
function GraftPicker({ self, current, onPick }: { self: string; current: string | null; onPick: (parentId: string | null) => void }) {
  const { t } = useI18n()
  const [rows, setRows] = useState<IdeaListRow[] | null>(null)
  const [pick, setPick] = useState<string>(current ?? '')
  useEffect(() => {
    void fetch('/api/ideas?offset=0', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: IdeaListRow[] } | null) => setRows((j?.rows ?? []).filter((r) => r.id !== self).sort((a, b) => a.title.localeCompare(b.title))))
      .catch(() => setRows([]))
  }, [self])
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }} data-testid="idea-graft-picker">
      <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} style={{ minHeight: 44, fontSize: 15 }}>
        <option value="">{t('it_trunk_option')}</option>
        {(rows ?? []).map((r) => (
          <option key={r.id} value={r.id}>
            {SEED[r.stage]} {r.title}
          </option>
        ))}
      </select>
      <button type="button" className="btn sm" disabled={rows === null || pick === (current ?? '')} onClick={() => onPick(pick || null)} style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>
        {t('it_graft_go')}
      </button>
    </div>
  )
}

/** Mûre: « Devenir un projet » (Pipeline) or « Devenir une œuvre » (its number). Admin doors of the old card. */
function Become({ busy, project, onProject, onWork }: { busy: boolean; project: boolean; onProject: () => void; onWork: (n: number) => void }) {
  const { t } = useI18n()
  const [n, setN] = useState('')
  const num = Number(n.replace(/^#/, ''))
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {project ? (
        <button type="button" className="btn sm" disabled={busy} onClick={onProject} style={{ minHeight: 44 }}>
          {t('it_become_project')}
        </button>
      ) : null}
      <input className="input" value={n} onChange={(e) => setN(e.target.value)} placeholder={t('it_become_work_ph')} inputMode="numeric" style={{ width: 110, minHeight: 44 }} />
      <button type="button" className="btn sm" disabled={busy || !Number.isInteger(num) || num <= 0} onClick={() => onWork(num)} style={{ minHeight: 44 }}>
        {t('it_become_work')}
      </button>
    </div>
  )
}
