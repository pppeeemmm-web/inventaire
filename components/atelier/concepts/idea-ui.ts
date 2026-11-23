// Small shared pieces of the Idées screens (design IdeasDesign.md): the seed signs and refusal words.

export const SEED = { graine: '🌰', pousse: '🌱', mure: '🌳' } as const
export type Stage = keyof typeof SEED
export const STAGES: Stage[] = ['graine', 'pousse', 'mure']

type T = (k: never) => string

/** A door's refusal code → a sentence (`it_err_*`). */
export function ideaErrorText(code: string, t: T): string {
  const tt = t as unknown as (k: string) => string
  const known = ['idea_loop', 'idea_stage_not_allowed', 'not_allowed', 'empty', 'not_found', 'in_use', 'auth', 'link_failed', 'admin']
  return known.includes(code) ? tt(`it_err_${code}`) : tt('it_err_failed')
}

/** The next step the desk offers, from what the idea has grown (never moves it by itself). */
export function stageOffer(i: { stage: Stage; days: number; works: number; documents: number; hasText: boolean }): Stage | 'done' | null {
  if (i.stage === 'graine' && i.days >= 2) return 'pousse'
  if (i.stage === 'pousse' && i.hasText && (i.works > 0 || i.documents > 0)) return 'mure'
  if (i.stage === 'mure') return 'done'
  return null
}
