'use client'

// Work drawer → "✦ Seen by AI" (A2, owner 2026-11-13: "show them, but instead of accept/reject set
// a useful rating or a slider"). The local vision model's description + echoes, clearly marked AI,
// rated 0 (useless) … 4 (spot on); unrated = not yet judged. Own save, outside the drawer's dirty
// baseline (like Constats). Folded by default; nothing renders for a work never described.

import { useCallback, useEffect, useState } from 'react'
import { getWorkDescription, rateWorkDescription, type WorkDescription } from '@/app/atelier/works/description-actions'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { toast } from '@/lib/ui/toast'

const LEVELS = [0, 1, 2, 3, 4] as const
const LEVEL_KEY = ['wd_level_0', 'wd_level_1', 'wd_level_2', 'wd_level_3', 'wd_level_4'] as const
/** The same work can be open twice (Inventory side card + drawer): a rating reloads every copy. */
const RATED_EVENT = 'pem:work-description-rated'

export function WorkAiDescriptionSection({ oeuvreId }: { oeuvreId: number }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [desc, setDesc] = useState<WorkDescription | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await getWorkDescription(oeuvreId)
    setDesc(res && !('error' in res) ? res : null)
  }, [oeuvreId])
  useEffect(() => {
    setDesc(null)
    void load()
  }, [load])
  useEffect(() => {
    const onRated = (e: Event) => {
      if ((e as CustomEvent<number>).detail === oeuvreId) void load()
    }
    window.addEventListener(RATED_EVENT, onRated)
    return () => window.removeEventListener(RATED_EVENT, onRated)
  }, [load, oeuvreId])

  if (!desc) return null

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const rated = desc.usefulness

  async function rate(next: number | null) {
    if (!desc || busy || next === desc.usefulness) return
    setBusy(true)
    const prev = desc.usefulness
    setDesc({ ...desc, usefulness: next })
    const res = await rateWorkDescription(desc.id, next)
    setBusy(false)
    if ('error' in res) {
      setDesc((d) => (d ? { ...d, usefulness: prev } : d))
      toast.error(t('wd_err'))
      return
    }
    window.dispatchEvent(new CustomEvent(RATED_EVENT, { detail: oeuvreId }))
  }

  const stats = desc.promptStats
  const statsLine =
    stats.avg != null
      ? interpolateMessage(t('wd_prompt_avg'), {
          avg: stats.avg.toLocaleString(locale, { maximumFractionDigits: 1 }),
          rated: stats.rated,
          total: stats.total.toLocaleString(locale),
        })
      : interpolateMessage(t('wd_prompt_none'), { total: stats.total.toLocaleString(locale) })

  return (
    <details data-testid="work-ai-description" style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
      <summary style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
        <span className="t-eyebrow">{t('wd_heading')}</span>
        <span className="t-mono-sm" style={{ marginLeft: 'auto', fontSize: 11, color: rated == null ? 'var(--tx3)' : 'var(--tx2)' }}>
          {rated == null ? t('wd_unrated') : `${rated}/4 · ${t(LEVEL_KEY[rated])}`}
        </span>
      </summary>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{ border: '1px solid var(--bd)', padding: '0 5px', borderRadius: 3, color: 'var(--tx2)', letterSpacing: '0.06em' }}
          >
            {t('wd_ai_badge')}
          </span>
          {interpolateMessage(t('wd_meta'), { engine: desc.engine, date: date(desc.createdAt) })}
        </div>

        <div style={{ borderLeft: '2px dashed var(--bd)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--tx2)', whiteSpace: 'pre-wrap' }}>{desc.body.trim()}</p>
          {desc.echoes?.trim() ? (
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--tx3)' }}>
              <span className="t-mono-sm" style={{ fontSize: 11, marginRight: 6 }}>
                {t('wd_echoes')}
              </span>
              {desc.echoes.trim()}
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: '44px' }} id={`wd-useful-${oeuvreId}`}>
            {t('wd_useful_q')}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 220px', maxWidth: 320 }}>
            <div
              role="radiogroup"
              aria-labelledby={`wd-useful-${oeuvreId}`}
              style={{ display: 'flex', border: '1px solid var(--bd)' }}
            >
              {LEVELS.map((n) => {
                const on = rated === n
                const filled = rated != null && n <= rated
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${n} · ${t(LEVEL_KEY[n])}`}
                    title={t(LEVEL_KEY[n])}
                    disabled={busy}
                    data-testid={`work-ai-useful-${n}`}
                    onClick={() => void rate(n)}
                    style={{
                      flex: '1 1 0',
                      minHeight: 44,
                      border: 'none',
                      borderLeft: n === 0 ? 'none' : '1px solid var(--bd)',
                      background: on
                        ? 'var(--ac)'
                        : filled
                          ? 'color-mix(in srgb, var(--ac) 22%, transparent)'
                          : 'var(--bg0)',
                      color: on ? 'var(--bg0)' : 'var(--tx)',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 13,
                      cursor: busy ? 'wait' : 'pointer',
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <div className="t-mono-sm" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--tx3)' }} aria-hidden="true">
              <span>{t('wd_level_0')}</span>
              <span>{t('wd_level_4')}</span>
            </div>
          </div>
          {rated != null ? (
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => void rate(null)}>
              {t('wd_clear')}
            </button>
          ) : null}
        </div>

        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>
            {rated == null
              ? t('wd_unrated')
              : desc.ratedAt
                ? desc.ratedByName
                  ? interpolateMessage(t('wd_rated_by'), { name: desc.ratedByName, date: date(desc.ratedAt) })
                  : interpolateMessage(t('wd_rated_on'), { date: date(desc.ratedAt) })
                : null}
          </span>
          <span>{statsLine}</span>
          <span>{t('wd_note')}</span>
        </div>
      </div>
    </details>
  )
}
