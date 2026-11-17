'use client'

// Work card R3 building blocks (docs/design/2026-11-16/WorkCard.notes.md): one drawer (Création /
// Objet) with its one-line summary, one compact part row under a divider, chips at a fixed height,
// « + champ » for an empty value, and read-first values that turn into inputs on tap.

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { InfoDot, useCaption } from './WorkCardCaption'

/** Chip height: 24 px desktop, 32 px on the phone (inside a 44 px tap row). */
export const chipH = (narrow: boolean) => (narrow ? 32 : 24)

export type ChipTone = 'own' | 'warn' | 'ok' | 'log' | 'ac' | 'muted' | undefined

const TONE: Record<Exclude<ChipTone, undefined>, string> = {
  own: 'var(--cyan)',
  warn: 'var(--yellow)',
  ok: 'var(--sage)',
  log: 'var(--dust)',
  ac: 'var(--ac)',
  muted: 'var(--mt)',
}

export function Chip({
  children,
  tone,
  active,
  onClick,
  title,
  disabled,
  dashed,
  narrow,
  testId,
}: {
  children: ReactNode
  tone?: ChipTone
  active?: boolean
  onClick?: () => void
  title?: string
  disabled?: boolean
  dashed?: boolean
  narrow: boolean
  testId?: string
}) {
  const c = tone ? TONE[tone] : null
  const st: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: chipH(narrow),
    padding: '0 9px',
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    border: `1px ${dashed ? 'dashed' : 'solid'} ${active && c ? c : c && tone !== 'muted' && !onClick ? c : 'var(--bd2)'}`,
    color: disabled ? 'var(--mt)' : active || (c && !onClick) ? (c ?? 'var(--tx)') : 'var(--tx2)',
    background: active && c ? `color-mix(in srgb, ${c} 14%, transparent)` : 'transparent',
    textDecoration: disabled ? 'line-through' : undefined,
    cursor: onClick && !disabled ? 'pointer' : 'default',
    fontFamily: 'inherit',
    flexShrink: 0,
  }
  // `title` = the hover caption (long-press on touch), never the browser's native tooltip.
  const { bind, node } = useCaption(title)
  if (onClick) {
    return (
      <>
        <button
          type="button"
          data-testid={testId}
          aria-pressed={active}
          aria-disabled={disabled || undefined}
          onClick={disabled ? undefined : onClick}
          style={{ ...st, WebkitTouchCallout: 'none' }}
          {...bind}
        >
          {children}
        </button>
        {node}
      </>
    )
  }
  return (
    <>
      <span data-testid={testId} tabIndex={title ? 0 : undefined} style={{ ...st, cursor: title ? 'help' : st.cursor, WebkitTouchCallout: 'none' }} {...bind}>
        {children}
      </span>
      {node}
    </>
  )
}

/** Greyed « + label » that stands for an empty value; tap = edit. */
export function EmptyValue({ label, onClick, testId }: { label: string; onClick?: () => void; testId?: string }) {
  const st: CSSProperties = {
    color: 'var(--mt)',
    fontSize: 12,
    fontFamily: 'inherit',
    background: 'none',
    border: 'none',
    borderBottom: '1px dashed var(--bd2)',
    padding: '1px 0',
    cursor: onClick ? 'pointer' : 'default',
  }
  return onClick ? (
    <button type="button" data-testid={testId} onClick={onClick} style={st}>+ {label}</button>
  ) : (
    <span data-testid={testId} style={st}>+ {label}</span>
  )
}

/**
 * Read first, edit on tap: `display` until tapped, then `children` (the inputs) for as long as the
 * card shows this work (the parent keys it by OeuvreID).
 */
export function TapEdit({
  display,
  empty,
  emptyLabel,
  children,
  testId,
  forceEdit = false,
}: {
  display: ReactNode
  empty: boolean
  emptyLabel: string
  children: ReactNode
  testId?: string
  forceEdit?: boolean
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  if (editing || forceEdit) return <div data-testid={testId ? `${testId}-edit` : undefined} style={{ minWidth: 0 }}>{children}</div>
  if (empty) return <EmptyValue label={emptyLabel} onClick={() => setEditing(true)} testId={testId} />
  return (
    <button
      type="button"
      data-testid={testId}
      title={t('wc_tap_edit')}
      onClick={() => setEditing(true)}
      style={{ background: 'none', border: 'none', padding: '1px 0', color: 'var(--tx)', font: 'inherit', fontSize: 13, textAlign: 'left', cursor: 'text', overflowWrap: 'anywhere', minWidth: 0 }}
    >
      {display}
    </button>
  )
}

/** Création / Objet: a header line (title + one-line summary) and a body hidden — not unmounted — when closed. */
export function CardDrawer({
  title,
  summary,
  open,
  onToggle,
  children,
  narrow,
  testId,
}: {
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  narrow: boolean
  testId?: string
}) {
  return (
    <section data-testid={testId} style={{ borderTop: '1px solid var(--bd)' }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          minHeight: narrow ? 44 : 40,
          padding: 0,
          background: 'none',
          border: 'none',
          color: 'var(--tx)',
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{title}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {summary}
        </span>
        <span aria-hidden style={{ color: 'var(--tx3)', fontSize: 12, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>
      <div hidden={!open} className="wc-dense" style={{ paddingBottom: 8 }}>{children}</div>
    </section>
  )
}

/**
 * One part of a drawer: label left, content right (stacked on the phone / narrow panel), one divider.
 * `selfTitled` = the content brings its own heading; the row then spans the full width.
 */
export function Part({
  label,
  hint,
  muted,
  stacked,
  selfTitled,
  children,
  testId,
  labelColor,
}: {
  label?: string
  hint?: string
  muted?: boolean
  stacked: boolean
  selfTitled?: boolean
  children: ReactNode
  testId?: string
  labelColor?: string
}) {
  const row: CSSProperties = {
    padding: '5px 0',
    borderTop: '1px solid color-mix(in srgb, var(--bd) 60%, transparent)',
    minWidth: 0,
  }
  if (selfTitled || !label) {
    return <div data-testid={testId} className="wc-self" style={{ ...row, opacity: muted ? 0.6 : 1 }}>{children}</div>
  }
  return (
    <div
      data-testid={testId}
      style={{
        ...row,
        display: 'grid',
        gridTemplateColumns: stacked ? 'minmax(0,1fr)' : '150px minmax(0,1fr)',
        gap: stacked ? 4 : 10,
        alignItems: 'start',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: labelColor ?? (muted ? 'var(--mt)' : 'var(--tx2)'), paddingTop: stacked ? 0 : 4 }}>
        {label}
        {hint ? <InfoDot text={hint} narrow={stacked} /> : null}
      </div>
      <div style={{ minWidth: 0, color: muted ? 'var(--mt)' : undefined }}>{children}</div>
    </div>
  )
}

/** Small uppercase label (top block). */
export function TopLabel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 600 }}>
      {children}
      {title ? <InfoDot text={title} /> : null}
    </div>
  )
}

/**
 * Themes / groups: the chosen ones as chips; « + thème » opens the whole list to toggle, « OK » folds it.
 * Values are always the parent's Set (part of the save payload and the unsaved guard).
 */
export function PickChips<K extends string | number>({
  items,
  selected,
  onToggle,
  addLabel,
  narrow,
  testId,
}: {
  items: { id: K; name: string }[]
  selected: Set<K>
  onToggle: (id: K) => void
  addLabel: string
  narrow: boolean
  testId?: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.filter((i) => selected.has(i.id))
  return (
    <div data-testid={testId} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: narrow ? 44 : undefined }}>
      {shown.map((i) => (
        <Chip key={String(i.id)} narrow={narrow} tone="ac" active={selected.has(i.id)} onClick={() => onToggle(i.id)}>
          {i.name}
        </Chip>
      ))}
      {open ? (
        <button type="button" className="btn ghost sm" onClick={() => setOpen(false)} style={{ minHeight: chipH(narrow), padding: '0 10px' }}>
          {t('wc_done')}
        </button>
      ) : (
        <EmptyValue label={addLabel} onClick={() => setOpen(true)} testId={testId ? `${testId}-add` : undefined} />
      )}
    </div>
  )
}
