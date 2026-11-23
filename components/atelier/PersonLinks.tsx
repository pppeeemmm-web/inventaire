'use client'

// Relations block of the person page (People.md §4c): links between people and « interested in » works.
// Reads readPersonLinks; writes only through the door savePersonLink. Targets come from the shared picker
// searchLinkTargets (`@` people, `#` works).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { thumbUrl } from '@/lib/data'
import {
  readPersonLinks,
  savePersonLink,
  type PersonLink,
  type PersonLinkKind,
} from '@/app/atelier/(portal)/contacts/people-actions'
import { searchLinkTargets, type LinkTarget } from '@/app/atelier/(portal)/journal/link-targets'

const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: '4px 0', fontSize: 13 }
const TILE = 64
const SOURCES = ['kit', 'visit', 'meeting', 'call', 'event', 'enquiry', 'said'] as const
const KINDS: PersonLinkKind[] = ['introduced', 'spouse', 'works_at', 'advises', 'works_with', 'interested_in']
const DIRECTIONAL: PersonLinkKind[] = ['introduced', 'advises', 'works_at']

function sentenceKey(l: PersonLink): DictKey {
  switch (l.kind) {
    case 'introduced':
      return (l.outgoing ? 'pl_s_introduced_out' : 'pl_s_introduced_in') as DictKey
    case 'works_at':
      return (l.outgoing ? 'pl_s_works_at_out' : 'pl_s_works_at_in') as DictKey
    case 'advises':
      return (l.outgoing ? 'pl_s_advises_out' : 'pl_s_advises_in') as DictKey
    case 'spouse':
      return 'pl_s_spouse' as DictKey
    default:
      return 'pl_s_works_with' as DictKey
  }
}

export function PersonLinks({
  contactId,
  narrow,
  onOpen,
  onPendingChange,
}: {
  contactId: number
  narrow: boolean
  /** When given, a person / work click hands the target path here instead of navigating (the caller guards unsaved edits). */
  onOpen?: (href: string) => void
  /** True while the add form holds a half-done link. */
  onPendingChange?: (pending: boolean) => void
}) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const [items, setItems] = useState<PersonLink[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await readPersonLinks(contactId)
    if ('error' in res) {
      setFailed(true)
      setItems([])
    } else {
      setFailed(false)
      setItems(res.items)
    }
    setLoading(false)
  }, [contactId])

  useEffect(() => {
    let live = true
    setLoading(true)
    setAdding(false)
    setRefusal(null)
    void readPersonLinks(contactId).then((res) => {
      if (!live) return
      if ('error' in res) {
        setFailed(true)
        setItems([])
      } else {
        setFailed(false)
        setItems(res.items)
      }
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [contactId])

  const refusedText = (code: string) => {
    const known = ['forbidden', 'not_found', 'bad_field']
    return t((known.includes(code) ? `pl_refused_${code}` : 'pl_refused_error') as DictKey)
  }

  const remove = async (l: PersonLink) => {
    setRefusal(null)
    const otherIsContact = l.otherContactId != null
    const res = await savePersonLink({
      op: 'remove',
      from: l.kind === 'interested_in' || l.outgoing ? contactId : (l.otherContactId as number),
      kind: l.kind,
      toContact: otherIsContact ? (l.outgoing ? l.otherContactId : contactId) : null,
      toWork: l.kind === 'interested_in' ? l.workId : null,
    })
    if ('refused' in res) {
      setRefusal(refusedText(res.refused))
      return
    }
    await load()
  }

  const people = items.filter((l) => l.kind !== 'interested_in')
  const works = items.filter((l) => l.kind === 'interested_in')
  const tap = narrow ? 44 : undefined

  return (
    <div style={{ marginBottom: 14, minWidth: 0 }} data-testid="person-links">
      <div style={{ ...LABEL, marginBottom: 6 }}>
        {t('pl_title')} · {loading ? '…' : items.length}
      </div>
      {failed ? (
        <div style={{ fontSize: 12, color: 'var(--rust)' }}>{t('pl_err')}</div>
      ) : loading ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('pl_loading')}</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('pl_none')}</div>
      ) : (
        <>
          {people.map((l, i) => {
            const name = l.otherName ?? `#${l.otherContactId}`
            const [before, after] = t(sentenceKey(l)).split('{name}')
            return (
              <div key={`${l.kind}-${l.outgoing}-${l.otherContactId}-${i}`} style={ROW}>
                <span>
                  {before}
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      const href = `/atelier/contacts?contact=${l.otherContactId}`
                      if (onOpen) onOpen(href)
                      else router.push(href)
                    }}
                    style={{ minHeight: tap, padding: '0 4px', fontWeight: 600 }}
                  >
                    {name}
                  </button>
                  {after}
                </span>
                <button type="button" className="btn ghost sm" onClick={() => void remove(l)} style={{ minHeight: tap, marginLeft: 'auto', color: 'var(--tx3)' }}>
                  {t('pl_remove')}
                </button>
              </div>
            )
          })}
          {works.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ ...LABEL, marginBottom: 6 }}>{t('pl_interested')}</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {works.map((l, i) => {
                  const src = thumbUrl(l.workImage)
                  const srcLabel = l.sourceKind && (SOURCES as readonly string[]).includes(l.sourceKind) ? t(`pl_src_${l.sourceKind}` as DictKey) : null
                  return (
                    <div key={`${l.workId}-${i}`} style={{ flex: '0 0 auto', width: TILE }}>
                      <Link
                        href={`/atelier/inventory?work=${l.workId}`}
                        onClick={
                          onOpen
                            ? (e) => {
                                e.preventDefault()
                                onOpen(`/atelier/inventory?work=${l.workId}`)
                              }
                            : undefined
                        }
                        aria-label={t('pl_work_open_fmt').replace('{id}', String(l.workId))}
                        title={`#${l.workId}${l.workTitle ? ` ${l.workTitle}` : ''}${l.sourceRef ? ` · ${l.sourceRef}` : ''}`}
                        style={{ display: 'block', color: 'inherit', textDecoration: 'none', minHeight: 44 }}
                      >
                        <span style={{ display: 'block', width: TILE, height: TILE, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt="" width={TILE} height={TILE} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : null}
                        </span>
                        <span className="t-mono-sm" style={{ display: 'block', fontSize: 9, color: 'var(--tx3)' }}>
                          #{l.workId}
                          {srcLabel ? ` · ${srcLabel}` : ''}
                        </span>
                      </Link>
                      <button type="button" className="btn ghost sm" onClick={() => void remove(l)} style={{ minHeight: 44, width: TILE, padding: 0, fontSize: 10, color: 'var(--tx3)' }}>
                        {t('pl_remove')}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
      {refusal ? <div style={{ fontSize: 12, color: 'var(--rust)', marginTop: 4 }}>{refusal}</div> : null}
      {adding ? (
        <AddForm
          key={contactId}
          contactId={contactId}
          narrow={narrow}
          lang={lang}
          refusedText={refusedText}
          onPendingChange={onPendingChange}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false)
            await load()
          }}
        />
      ) : (
        <button type="button" className="btn ghost sm" onClick={() => setAdding(true)} style={{ minHeight: narrow ? 44 : undefined, marginTop: 4 }}>
          {t('pl_add')}
        </button>
      )}
    </div>
  )
}

function AddForm({
  contactId,
  narrow,
  lang,
  refusedText,
  onPendingChange,
  onClose,
  onSaved,
}: {
  contactId: number
  narrow: boolean
  lang: string
  refusedText: (code: string) => string
  onPendingChange?: (pending: boolean) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useI18n()
  const [kind, setKind] = useState<PersonLinkKind>('works_with')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LinkTarget[]>([])
  const [picked, setPicked] = useState<LinkTarget | null>(null)
  const [dir, setDir] = useState<'out' | 'in'>('out')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isWork = kind === 'interested_in'

  const pending = picked != null || q.trim() !== '' || source !== '' || note.trim() !== ''
  const pendingCb = useRef(onPendingChange)
  pendingCb.current = onPendingChange
  useEffect(() => {
    pendingCb.current?.(pending)
  }, [pending])
  useEffect(() => () => pendingCb.current?.(false), [])

  useEffect(() => {
    const term = q.trim()
    if (picked || term.length < 2) {
      setResults([])
      return
    }
    let live = true
    const timer = setTimeout(() => {
      void searchLinkTargets(isWork ? 'hash' : 'at', term).then((res) => {
        if (!live) return
        const want = isWork ? 'oeuvre' : 'contact'
        setResults(res.filter((r) => r.kind === want && !(want === 'contact' && r.id === contactId)))
      })
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, isWork, picked, contactId])

  const kindOptions = KINDS.map((k) => ({ k, label: t(`pl_kind_${k}` as DictKey) })).sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'fr', { sensitivity: 'base' }))
  const complete = picked != null && (!isWork || source !== '')
  const field: React.CSSProperties = { minHeight: narrow ? 44 : 32, width: narrow ? '100%' : undefined, boxSizing: 'border-box' }

  const save = async () => {
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    const pid = Number(picked.id)
    const res = await savePersonLink(
      isWork
        ? { op: 'add', from: contactId, kind, toWork: pid, sourceKind: source, sourceRef: note.trim() || null }
        : dir === 'in' && DIRECTIONAL.includes(kind)
          ? { op: 'add', from: pid, kind, toContact: contactId }
          : { op: 'add', from: contactId, kind, toContact: pid },
    )
    setBusy(false)
    if ('refused' in res) {
      setError(refusedText(res.refused))
      return
    }
    await onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, minWidth: 0 }} data-testid="person-link-form">
      <select
        aria-label={t('pl_kind_label')}
        value={kind}
        onChange={(e) => {
          setKind(e.target.value as PersonLinkKind)
          setPicked(null)
          setQ('')
          setResults([])
        }}
        style={field}
      >
        {kindOptions.map((o) => (
          <option key={o.k} value={o.k}>
            {o.label}
          </option>
        ))}
      </select>
      {!isWork && DIRECTIONAL.includes(kind) ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {(['out', 'in'] as const).map((d) => (
            <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: narrow ? 44 : undefined, fontSize: 13 }}>
              <input type="radio" name="pl-dir" checked={dir === d} onChange={() => setDir(d)} />
              {t(d === 'out' ? 'pl_dir_out' : 'pl_dir_in')}
            </label>
          ))}
        </div>
      ) : null}
      {picked ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={LABEL}>{t('pl_picked')}</span>
          <strong>{picked.label}</strong>
          <button type="button" className="btn ghost sm" onClick={() => setPicked(null)} style={{ minHeight: narrow ? 44 : undefined }}>
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(isWork ? 'pl_search_work' : 'pl_search_person')}
            aria-label={t(isWork ? 'pl_search_work' : 'pl_search_person')}
            style={field}
          />
          {results.map((r) => (
            <button key={`${r.kind}-${r.id}`} type="button" className="btn ghost sm" onClick={() => setPicked(r)} style={{ justifyContent: 'flex-start', minHeight: narrow ? 44 : undefined, textAlign: 'left' }}>
              {r.label}
            </button>
          ))}
        </>
      )}
      {isWork ? (
        <>
          <select aria-label={t('pl_src_label')} value={source} onChange={(e) => setSource(e.target.value)} style={field}>
            <option value="">{t('pl_src_pick')}</option>
            {SOURCES.map((s) => ({ s, label: t(`pl_src_${s}` as DictKey) }))
              .sort((a, b) => a.label.localeCompare(b.label, lang === 'en' ? 'en' : 'fr', { sensitivity: 'base' }))
              .map((o) => (
                <option key={o.s} value={o.s}>
                  {o.label}
                </option>
              ))}
          </select>
          <input type="text" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t('pl_note')} aria-label={t('pl_note')} style={field} />
        </>
      ) : null}
      {error ? <div style={{ fontSize: 12, color: 'var(--rust)' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" disabled={!complete || busy} onClick={() => void save()} style={{ minHeight: narrow ? 44 : undefined }}>
          {t('pl_save')}
        </button>
        <button type="button" className="btn ghost sm" onClick={onClose} style={{ minHeight: narrow ? 44 : undefined }}>
          {t('pl_cancel')}
        </button>
      </div>
    </div>
  )
}
