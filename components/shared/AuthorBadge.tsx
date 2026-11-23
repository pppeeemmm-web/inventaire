'use client'

/**
 * Who changed a work: initials in a person's colour (the admin keeps the accent), ⚙ for a machine, « ? » for an
 * unknown author, a small ✓ when an admin approved the person's proposal. Not a button. Design:
 * docs/design/2026-11-23/WorkChangeBadges.md §4; rule in supabase/sql/oeuvre_version_author.sql.
 */
import type { CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { ChangeAuthor } from '@/lib/journal/authors'

const HUES = ['var(--cyan)', 'var(--sage)', 'var(--rust)', 'var(--magenta)', 'var(--teal)', 'var(--yellow)']

export function authorTitle(a: ChangeAuthor, t: (k: 'ca_machine' | 'ca_unknown' | 'ca_approved') => string): string {
  if (a.kind === 'machine') return t('ca_machine')
  if (a.kind === 'unknown') return t('ca_unknown')
  return a.approvedBy ? t('ca_approved').replace('{who}', a.name).replace('{ok}', a.approvedBy) : a.name
}

export function AuthorBadge({ author, size = 20, style }: { author: ChangeAuthor; size?: number; style?: CSSProperties }) {
  const { t } = useI18n()
  const label = authorTitle(author, t)
  const base: CSSProperties = {
    position: 'relative',
    display: 'inline-grid',
    placeItems: 'center',
    width: size,
    height: size,
    borderRadius: '50%',
    flex: '0 0 auto',
    fontSize: size >= 22 ? 10 : 9.5,
    fontWeight: 700,
    letterSpacing: '.02em',
    lineHeight: 1,
    ...style,
  }
  if (author.kind !== 'person') {
    const machine = author.kind === 'machine'
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-testid={`author-badge-${author.kind}`}
        style={{
          ...base,
          fontSize: 11,
          color: 'var(--tx3)',
          background: machine ? 'var(--bg3)' : 'transparent',
          border: `1px ${machine ? 'solid' : 'dashed'} var(--bd2)`,
        }}
      >
        {machine ? '⚙' : '?'}
      </span>
    )
  }
  const hue = author.tone === 'accent' ? 'var(--ac)' : author.tone === 'grey' ? 'var(--tx3)' : HUES[author.tone % HUES.length]
  const initials = author.initials.length > 2 ? author.initials.slice(0, 3) : author.initials
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="author-badge-person"
      style={{
        ...base,
        fontSize: initials.length > 2 ? Math.max(7.5, (base.fontSize as number) - 2) : base.fontSize,
        color: hue,
        background: `color-mix(in srgb, ${hue} 18%, var(--bg1))`,
        border: `1px solid color-mix(in srgb, ${hue} 55%, transparent)`,
      }}
    >
      {initials}
      {author.approvedBy ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 11,
            height: 11,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 8,
            color: 'var(--bg0)',
            background: 'var(--ac)',
          }}
        >
          ✓
        </span>
      ) : null}
    </span>
  )
}

/** A line's authors, first change first, overlapping by 3 px; more than 3 → « +n ». */
export function AuthorBadges({ authors, size }: { authors: ChangeAuthor[] | undefined; size?: number }) {
  const { t } = useI18n()
  const phone = useMediaQuery('(max-width: 767px)')
  const px = size ?? (phone ? 22 : 20)
  if (!authors?.length) return null
  const shown = authors.slice(0, 3)
  const rest = authors.length - shown.length
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }} data-testid="author-badges">
      {shown.map((a, i) => (
        <AuthorBadge key={a.key} author={a} size={px} style={i ? { marginLeft: -3 } : undefined} />
      ))}
      {rest > 0 ? (
        <span
          title={authors.slice(3).map((a) => authorTitle(a, t)).join(', ')}
          style={{ marginLeft: 3, fontSize: 11, color: 'var(--tx3)' }}
        >
          {t('ca_more').replace('{n}', String(rest))}
        </span>
      ) : null}
    </span>
  )
}
