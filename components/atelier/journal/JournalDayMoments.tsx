'use client'

import Link from 'next/link'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import type { JournalDayMoment } from '@/app/atelier/(portal)/journal/entry-actions'

/** Touches of the day (People.md §4), read from `moment`: read-only, never copied into the notebook. */
export function JournalDayMoments({ moments }: { moments: JournalDayMoment[] | undefined }) {
  const { t } = useI18n()
  if (!moments?.length) return null
  // « Œuvre ajoutée » moments (WorksAddedMoments.md): one card for the day, not one per work.
  const added = moments.filter((m) => m.kind === 'work_added').flatMap((m) => m.works)
  const touches = moments.filter((m) => m.kind !== 'work_added')
  return (
    <>
      {added.length ? (
        <section data-testid="journal-day-works-added" style={{ display: 'grid', gap: 6 }}>
          <div className="t-eyebrow">{t('jd_works_added')} · {added.length}</div>
          <div style={{ display: 'grid', gap: 4, padding: '6px 12px', border: '1px dashed var(--bd2)', borderRadius: 10, fontSize: 13, color: 'var(--tx3)' }}>
            {added.map((w) => (
              <Link key={w.id} href={`/atelier/inventory?work=${w.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, minWidth: 0, color: 'var(--tx3)' }}>
                {w.thumb ? (
                  <img src={thumbUrl(w.thumb) ?? undefined} alt="" loading="lazy" style={{ width: 32, height: 32, flexShrink: 0, objectFit: 'cover', borderRadius: 4, background: 'var(--bg2)' }} />
                ) : (
                  <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 4, background: 'var(--bg2)' }} />
                )}
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  <span style={{ color: 'var(--tx)' }}>#{w.id} {w.title ?? ''}</span>
                  {w.origin ? <span> · {t(w.origin === 'found' ? 'jd_work_added_found' : 'jd_work_added_new')}</span> : null}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {touches.length ? (
        <section data-testid="journal-day-moments" style={{ display: 'grid', gap: 6 }}>
          <div className="t-eyebrow">{t('jd_moments')}</div>
          {touches.map((m) => (
            <div
              key={m.id}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 44, padding: '6px 12px', border: '1px dashed var(--bd2)', borderRadius: 10, fontSize: 13, color: 'var(--tx3)' }}
            >
              <span style={{ color: 'var(--ac)' }}>{t(`pp_tl_moment_${m.kind}` as never)}</span>
              {m.people.length ? (
                <span>
                  ·{' '}
                  {m.people.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 ? ', ' : ''}
                      <Link href={`/atelier/contacts?contact=${p.id}`} style={{ color: 'var(--tx)' }}>
                        {p.name}
                      </Link>
                    </span>
                  ))}
                </span>
              ) : null}
              {m.summary ? <span>— {m.summary}</span> : null}
              {m.works.map((w) => (
                <Link key={w.id} href={`/atelier/inventory?work=${w.id}`} title={w.title ?? undefined} style={{ display: 'inline-flex' }}>
                  {w.thumb ? (
                    <img src={thumbUrl(w.thumb) ?? undefined} alt={w.title ?? ''} loading="lazy" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, background: 'var(--bg2)' }} />
                  ) : (
                    <span style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg2)' }} />
                  )}
                </Link>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </>
  )
}
