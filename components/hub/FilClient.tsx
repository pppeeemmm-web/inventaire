'use client'

// R1 step 6 — the Fil, phone deck (docs/design/2026-11-17/R1_InputsFeed.notes.md « Feed rules »,
// « Gestures »; PhoneToday.notes.md phone 7). Tabs Création · Fiches · Kaizen, one shared SwipeDeck
// for the open tab: left = discard (Retirer / Refuser), right = keep (Garder / Valider), 6 s « Annuler ».
// Items left alone more than 14 days fold into « Refroidies » (read only, never lost).
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl } from '@/lib/data'
import { PENDING_CHECKBOX_KEYS } from '@/lib/work-pending-keys'
import { PhoneInputBar } from '@/components/shared/PhoneInputBar'
import { SwipeDeck, type SwipeDecision, type SwipeResult } from '@/components/shared/SwipeDeck'
import { decideFil, listFil, type FilItem, type FilSection } from '@/app/atelier/fil/actions'

const VoiceNoteSheet = dynamic(
  () => import('@/components/shared/VoiceNoteSheet').then((m) => m.VoiceNoteSheet),
  { ssr: false },
)

const SECTIONS: FilSection[] = ['creation', 'fiches', 'kaizen']
const TAB_LABEL = { creation: 'fil_tab_creation', fiches: 'fil_tab_fiches', kaizen: 'fil_tab_kaizen' } as const
const CHECKBOX_KEYS = new Set<string>(PENDING_CHECKBOX_KEYS)
const BODY_MAX = 600

const workHref = (id: number) => `/atelier/inventory?work=${id}`
const muted: CSSProperties = { fontSize: 13, color: 'var(--tx3)', margin: 0 }

function Thumb({ file, size }: { file: string | null; size: number }) {
  const src = thumbUrl(file)
  const box: CSSProperties = { width: size, height: size, borderRadius: 6, objectFit: 'cover', background: 'var(--bg2)', flex: 'none' }
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" width={size} height={size} loading="lazy" style={box} /> : <span style={{ ...box, display: 'inline-block' }} />
}

function changeValue(key: string, value: string | null): string {
  if (value == null || value === '') return '—'
  if (CHECKBOX_KEYS.has(key)) return value === '1' ? '✓' : '✗'
  return value.length > 80 ? `${value.slice(0, 80)}…` : value
}

export function FilClient() {
  const { t } = useI18n()
  const [items, setItems] = useState<FilItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(true)
  const [tab, setTab] = useState<FilSection | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)

  useEffect(() => {
    void listFil()
      .then((res) => {
        if (!('error' in res)) setItems(res.items)
        else if (res.error === 'admin' || res.error === 'auth') setIsAdmin(false)
        else setFailed(true)
      })
      .catch(() => setFailed(true))
    void import('@/components/shared/VoiceNoteSheet')
  }, [])

  const live = useMemo(() => (items ?? []).filter((i) => !i.cooled), [items])
  const cooled = useMemo(() => (items ?? []).filter((i) => i.cooled), [items])
  const counts = useMemo(() => {
    const c: Record<FilSection, number> = { creation: 0, fiches: 0, kaizen: 0 }
    for (const i of live) c[i.section] += 1
    return c
  }, [live])
  // Open on the first section with something in it (until Pem picks a tab).
  const active: FilSection = tab ?? SECTIONS.find((s) => counts[s] > 0) ?? 'creation'

  // Sent by the deck once the 6 s undo window is over; the item then leaves the lists and counts.
  const onDecide = useCallback(async (item: FilItem, decision: SwipeDecision): Promise<SwipeResult> => {
    const res = await decideFil(item.kind, item.id, decision)
    if ('ok' in res) setItems((prev) => (prev ? prev.filter((i) => i.key !== item.key) : prev))
    return res
  }, [])

  const fiches = active === 'fiches'

  return (
    <div
      data-testid="hub-fil-root"
      style={{
        minHeight: '100dvh', background: 'var(--bg0)', color: 'var(--tx)', overflowX: 'hidden',
        paddingBottom: 'max(80px, calc(76px + env(safe-area-inset-bottom)))',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Right padding keeps the header clear of the floating signed-in badge (LoggedInBar). */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 48px 4px 8px' }}>
          <Link href="/hub" data-testid="hub-fil-back" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 8px', color: 'var(--tx2)', textDecoration: 'none', fontSize: 13 }}>
            {t('fil_back')}
          </Link>
          <h1 style={{ fontSize: 22, margin: 0, flex: 1 }}>{t('fil_title')}</h1>
        </header>

        {!isAdmin ? (
          <p data-testid="hub-fil-admin-only" style={{ ...muted, padding: '12px 16px' }}>{t('fil_admin_only')}</p>
        ) : (
          <>
            <p style={{ ...muted, padding: '0 16px 10px', fontSize: 12 }}>{t('fil_intro')}</p>

            <div role="tablist" aria-label={t('fil_tabs_aria')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderBottom: '1px solid var(--bd)' }}>
              {SECTIONS.map((s) => {
                const on = s === active
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-testid={`hub-fil-tab-${s}`}
                    onClick={() => setTab(s)}
                    style={{
                      minHeight: 44, minWidth: 0, background: 'none', border: 0, cursor: 'pointer',
                      borderBottom: `2px solid ${on ? 'var(--ac)' : 'transparent'}`,
                      color: on ? 'var(--tx)' : 'var(--tx3)', fontSize: 14,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {t(TAB_LABEL[s])}
                    <span data-testid={`hub-fil-tab-${s}-count`} style={{ fontSize: 12, color: counts[s] ? 'var(--tx2)' : 'var(--tx3)' }}>{items ? counts[s] : '·'}</span>
                  </button>
                )
              })}
            </div>

            <div style={{ padding: '14px 16px' }}>
              {failed ? (
                <p style={{ ...muted, color: 'var(--rust)' }}>{t('fil_load_error')}</p>
              ) : !items ? (
                <p style={muted}>{t('fil_loading')}</p>
              ) : (
                <SwipeDeck<FilItem>
                  key={active}
                  testId="hub-fil-deck"
                  items={live.filter((i) => i.section === active)}
                  getKey={(i) => i.key}
                  renderCard={(i) => <FilCard item={i} />}
                  onDecide={onDecide}
                  keepLabel={t(fiches ? 'fil_approve' : 'fil_keep')}
                  discardLabel={t(fiches ? 'fil_reject' : 'fil_discard')}
                  emptyText={t('fil_empty')}
                />
              )}
            </div>

            {cooled.length ? (
              <details className="pem-fold" data-testid="hub-fil-cooled" style={{ padding: '4px 16px 14px', borderTop: '1px solid var(--bd)' }}>
                <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--tx2)' }}>
                  {t('fil_cooled')}
                  <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{cooled.length}</span>
                </summary>
                <p style={{ ...muted, fontSize: 12, margin: '0 0 10px' }}>{t('fil_cooled_hint')}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  {cooled.map((i) => (
                    <FilCard key={i.key} item={i} compact />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>

      <PhoneInputBar onVoice={() => setVoiceOpen(true)} workHref="/atelier/session/new" />
      {voiceOpen ? <VoiceNoteSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} oeuvreOptions={[]} /> : null}
    </div>
  )
}

/** One Fil item: who, where it was written, the text. */
function FilCard({ item, compact = false }: { item: FilItem; compact?: boolean }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const date = new Date(item.at).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })

  const kindLabel =
    item.kind === 'idea'
      ? t('fil_idea')
      : item.kind === 'kaizen_item'
        ? t('fil_kaizen')
        : item.kind === 'pending_change'
          ? t(item.changeKind === 'create' ? 'fil_fiche_create' : item.changeKind === 'image_add' ? 'fil_fiche_image' : 'fil_fiche_change')
          : item.lineKind === 'proposal'
            ? t('fil_proposal')
            : null

  const body = item.body.length > BODY_MAX ? `${item.body.slice(0, BODY_MAX)}…` : item.body
  const image = item.image ? thumbUrl(item.image) : null

  return (
    <article
      data-testid={`hub-fil-card-${item.kind}`}
      style={{
        border: '1px solid var(--bd)', borderRadius: 8, background: 'var(--bg1)',
        padding: compact ? 10 : 14, minHeight: compact ? undefined : 160,
        display: 'grid', gap: 8, overflowWrap: 'anywhere',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        {item.flagged ? <span style={{ color: 'var(--ac)' }}>{t('fil_flagged')}</span> : null}
        {kindLabel ? <span>{kindLabel}</span> : null}
        <span>{[item.author, date].filter(Boolean).join(' · ')}</span>
      </div>

      {item.work ? (
        <Link href={workHref(item.work.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, color: 'var(--tx)', textDecoration: 'none' }}>
          <Thumb file={item.work.thumb} size={44} />
          <span style={{ fontSize: 13, lineHeight: 1.3, minWidth: 0 }}>
            {item.kind === 'note_line' && item.lineKind === 'work' ? (
              <span style={{ display: 'block', color: 'var(--tx3)' }}>{t('fil_in_work').replace('{id}', String(item.work.id))}</span>
            ) : (
              <span style={{ color: 'var(--tx3)' }}>#{item.work.id}{item.work.title ? ' · ' : ''}</span>
            )}
            {item.work.title ?? (item.kind === 'note_line' && item.lineKind === 'work' ? t('fil_untitled') : null)}
          </span>
        </Link>
      ) : null}

      {item.title ? <h2 style={{ fontSize: 16, margin: 0, lineHeight: 1.3 }}>{item.title}</h2> : null}
      {body ? <p style={{ fontSize: 14, lineHeight: 1.45, margin: 0, whiteSpace: 'pre-wrap' }}>{compact && body.length > 220 ? `${body.slice(0, 220)}…` : body}</p> : null}

      {item.newLines ? (
        <p style={{ ...muted, fontSize: 12 }}>
          {item.newLines === 1 ? t('fil_new_line_one') : t('fil_new_lines').replace('{n}', String(item.newLines))}
        </p>
      ) : null}

      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 6, justifySelf: 'start' }} />
      ) : null}

      {item.changes?.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4, fontSize: 13 }}>
          {item.changes.map((c) => (
            <li key={c.key}>
              <span style={{ color: 'var(--tx3)' }}>{c.key}</span>
              {' : '}
              <span style={{ color: 'var(--tx3)', textDecoration: c.before ? 'line-through' : undefined }}>{changeValue(c.key, c.before)}</span>
              {' → '}
              {changeValue(c.key, c.after)}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
