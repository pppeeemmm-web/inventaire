'use client'

// R1 Idées: weight (Petite / Recherche) and maturity (Graine · Pousse · Mûre). Maturity, not heat:
// neutral marks, no red, no counter.

import { useI18n } from '@/lib/i18n/context'
import { IDEA_MATURITIES, type IdeaMaturity, type IdeaWeight } from './concept-constants'

export const MATURITY_KEY = {
  graine: 'ideas_maturity_graine',
  pousse: 'ideas_maturity_pousse',
  mure: 'ideas_maturity_mure',
} as const satisfies Record<IdeaMaturity, string>

export const WEIGHT_KEY = {
  petite: 'ideas_weight_petite',
  recherche: 'ideas_weight_recherche',
} as const satisfies Record<IdeaWeight, string>

/** Three short steps, filled up to the idea's maturity. */
export function MaturityMark({ maturity }: { maturity: IdeaMaturity }) {
  const { t } = useI18n()
  const label = t(MATURITY_KEY[maturity])
  const reached = IDEA_MATURITIES.indexOf(maturity)
  return (
    <span
      role="img"
      aria-label={t('ideas_maturity_aria').replace('{m}', label)}
      title={label}
      data-testid="idea-maturity-mark"
      style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}
    >
      {IDEA_MATURITIES.map((m, i) => (
        <span
          key={m}
          style={{ width: 5, height: 6 + i * 3, background: i <= reached ? 'var(--ac)' : 'var(--bg2)', border: '1px solid var(--bd)' }}
        />
      ))}
    </span>
  )
}
