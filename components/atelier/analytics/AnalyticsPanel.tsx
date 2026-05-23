'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { getAnalyticsStats, type AnalyticsResult } from '@/app/atelier/(portal)/analytics/actions'
import type { Oeuvre } from '@/lib/types/database'
import { BarList } from './BarList'
import { Sparkline } from './Sparkline'

export function AnalyticsPanel({
  themes,
  oeuvres,
  themePublicStats,
}: {
  themes: { id: number; name: string }[]
  oeuvres: Oeuvre[]
  themePublicStats: Record<number, { total: number; pub: number }>
}) {
  const { t, lang } = useI18n()
  const numLocale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const narrow = useMediaQuery('(max-width: 767px)')
  const periods = useMemo(
    () => [
      { days: 7 as const, label: t('analytics_period_7d') },
      { days: 30 as const, label: t('analytics_period_30d') },
      { days: 90 as const, label: t('analytics_period_90d') },
    ],
    [t],
  )
  const [days, setDays] = useState(30)
  const [scope, setScope] = useState<'public_site' | 'all'>('public_site')
  const [result, setResult] = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(false)

  const cataloguePublic = useMemo(
    () => oeuvres.filter((o) => o.is_public === true).length,
    [oeuvres]
  )

  const themeRows = useMemo(() => {
    return [...themes]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((th) => {
        const s = themePublicStats[th.id]
        return { id: th.id, name: th.name, pub: s?.pub ?? 0, total: s?.total ?? 0 }
      })
      .filter((r) => r.total > 0)
  }, [themes, themePublicStats])

  const load = useCallback(async (d: number, sc: 'public_site' | 'all') => {
    setLoading(true)
    setResult(await getAnalyticsStats(d, { scope: sc, lang }))
    setLoading(false)
  }, [lang])

  useEffect(() => { load(days, scope) }, [load, days, scope, lang])

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflow: 'hidden',
      maxWidth: '100%',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 10px',
        padding: narrow
          ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))'
          : '8px 10px',
        background: 'var(--bg0)',
        border: '1px solid var(--bd)',
        flexShrink: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <span className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1 }}>{t('analytics_toolbar_catalogue')}</span>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-serif, serif)' }}>
          {cataloguePublic.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')} / {oeuvres.length.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
        </span>
        <span className="t-mono-xs" style={{ color: 'var(--tx3)' }}>
          {' · '}
          {themeRows.length === 1
            ? t('analytics_themes_one').replace('{n}', String(themeRows.length))
            : t('analytics_themes_other').replace('{n}', String(themeRows.length))}
        </span>
        <span style={{ width: 1, height: 14, background: 'var(--bd)', flexShrink: 0 }} aria-hidden />
        <span className="t-mono-xs" style={{ color: 'var(--tx3)', letterSpacing: 1 }}>{t('analytics_toolbar_traffic')}</span>
        {(['public_site', 'all'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} style={{
            padding: narrow ? '10px 12px' : '6px 12px', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: scope === s ? 'var(--ac)' : 'none',
            color: scope === s ? 'white' : 'var(--tx3)',
            borderColor: scope === s ? 'var(--ac)' : 'var(--bd)',
            minHeight: 44,
          }}>
            {s === 'public_site' ? t('analytics_scope_public_site') : t('analytics_scope_all_raw')}
          </button>
        ))}
        {periods.map((p) => (
          <button key={p.days} type="button" onClick={() => setDays(p.days)} style={{
            padding: narrow ? '10px 12px' : '6px 12px', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
            fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--bd)',
            background: days === p.days ? 'var(--ac)' : 'none',
            color: days === p.days ? 'white' : 'var(--tx3)',
            borderColor: days === p.days ? 'var(--ac)' : 'var(--bd)',
            minHeight: 44,
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: 12 }}>{t('loading')}</div>
      )}

      {!loading && result && 'error' in result && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg0)',
          border: '1px solid var(--bd)',
          color: 'var(--tx3)',
          fontSize: 12,
          flexShrink: 0,
        }}>
          {result.error}
        </div>
      )}

      {!loading && result && 'ok' in result && (
        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{
            display: narrow ? 'flex' : 'grid',
            flexDirection: narrow ? 'column' : undefined,
            gridTemplateColumns: narrow ? undefined : 'minmax(104px, 1fr) minmax(104px, 1fr) minmax(104px, 1fr) minmax(160px, 2fr)',
            gap: 8,
            flexShrink: 0,
            minHeight: narrow ? undefined : 132,
          }}>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 0,
            }}>
              <div className="t-label" style={{ marginBottom: 6, fontSize: 10 }}>
                {result.scope === 'public_site' ? t('analytics_page_views_site') : t('analytics_page_views_raw')}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 300,
                lineHeight: 1,
                color: 'var(--tx)',
                fontFamily: 'var(--font-serif, serif)',
                letterSpacing: -0.5,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {result.pageviews.toLocaleString(numLocale)}
              </div>
              {result.scope === 'public_site' && result.offSitePageviews != null && result.offSitePageviews > 0 && (
                <div className="t-mono-xs" style={{ color: 'var(--tx3)', marginTop: 6, lineHeight: 1.35 }}>
                  {t('analytics_off_routes_plus_fmt').replace('{count}', result.offSitePageviews.toLocaleString(numLocale))}
                </div>
              )}
            </div>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 0,
            }}>
              <div className="t-label" style={{ marginBottom: 6, fontSize: 10 }}>
                {t('analytics_unique_visitors')}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 300,
                lineHeight: 1,
                color: 'var(--tx)',
                fontFamily: 'var(--font-serif, serif)',
                letterSpacing: -0.5,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {result.uniqueVisitors.toLocaleString(numLocale)}
              </div>
            </div>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              minHeight: 0,
            }}>
              <div className="t-label" style={{ marginBottom: 6, fontSize: 10 }}>
                {t('analytics_net_visitors')}
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 300,
                lineHeight: 1,
                color: 'var(--tx)',
                fontFamily: 'var(--font-serif, serif)',
                letterSpacing: -0.5,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {result.netUniqueVisitors.toLocaleString(numLocale)}
              </div>
              <div className="t-mono-xs" style={{ color: 'var(--tx3)', marginTop: 6, lineHeight: 1.3, fontSize: 9 }}>
                {t('analytics_net_visitors_hint')}
              </div>
            </div>
            <div style={{
              padding: '8px 12px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}>
              <div className="t-label" style={{ marginBottom: 6, fontSize: 10, flexShrink: 0 }}>{t('analytics_trend_views_per_day')}</div>
              <div style={{ flex: 1, minHeight: 112, overflow: 'visible', padding: '2px 4px 0' }}>
                <Sparkline trend={result.trend} />
              </div>
            </div>
          </div>
          {result.pageviews > 0 && result.uniqueVisitors === 0 && (
            <div className="t-mono-xs" style={{ color: 'var(--tx3)', padding: '0 2px', lineHeight: 1.35 }}>
              {t('analytics_visitor_coverage_note')}
            </div>
          )}

          <div style={{
            flex: '1 1 0',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_pages')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topPages} labelKey="path" valueKey="views" maxRows={10} />
              </div>
            </div>
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            }}>
              <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_countries')}</div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <BarList items={result.topCountries} labelKey="country" valueKey="views" maxRows={10} />
              </div>
            </div>
          </div>

          <div style={{
            flex: '1 1 0',
            minHeight: 0,
            padding: '8px 10px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
          }}>
            <div className="t-label" style={{ marginBottom: 8, fontSize: 10, flexShrink: 0 }}>{t('analytics_top_sources')}</div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <BarList items={result.topReferrers} labelKey="referrer" valueKey="views" maxRows={10} />
            </div>
          </div>

          <div
            className="t-mono-xs"
            style={{
              color: 'var(--tx3)',
              opacity: 0.55,
              flexShrink: 0,
              lineHeight: 1.35,
              fontSize: 10,
            }}
          >
            {t('analytics_data_footnote')}
          </div>
        </div>
      )}
    </div>
  )
}
