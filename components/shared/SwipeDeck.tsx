'use client'

// Shared swipe deck — R1 + R2 build step 4 (docs/design/2026-11-17/R1_InputsFeed.notes.md, Build plan):
// one card at a time; swipe left = discard, right = keep (or the ✕ / ✓ buttons, or ← / → keys).
// Nothing is final at once: the card leaves, a toast offers « Annuler » for ~6 s, and only then is the
// decision sent. Leaving the page sends what is still waiting. First users: Hub Triage; later the Fil.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { dismissToast, toast } from '@/lib/ui/toast'

export type SwipeResult = { ok: true } | { error: string }
export type SwipeDecision = 'keep' | 'discard'

const UNDO_MS = 6000
const SWIPE_PX = 72

type Pending<T> = { item: T; decision: SwipeDecision; timer: number; toastId: string }

export function SwipeDeck<T>({
  items,
  getKey,
  renderCard,
  onDecide,
  keepLabel,
  discardLabel,
  emptyText,
  testId = 'swipe-deck',
}: {
  items: T[]
  getKey: (item: T) => string
  renderCard: (item: T) => ReactNode
  /** Sent once the undo window is over (or when the page is left). */
  onDecide: (item: T, decision: SwipeDecision) => Promise<SwipeResult>
  keepLabel: string
  discardLabel: string
  emptyText: string
  testId?: string
}) {
  const { t } = useI18n()
  /** Keys decided here (waiting or sent): they stay out of the deck until the list changes. */
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [dx, setDx] = useState(0)
  const startX = useRef<number | null>(null)
  const pending = useRef<Pending<T> | null>(null)
  // Props in refs: `send` / `flush` stay stable, so the unmount flush runs on real unmount only.
  const onDecideRef = useRef(onDecide)
  onDecideRef.current = onDecide
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey

  const visible = items.filter((it) => !gone.has(getKey(it)))
  const card = visible[0]

  const send = useCallback(
    (p: Pending<T>) => {
      void onDecideRef.current(p.item, p.decision).then((res) => {
        if ('error' in res) {
          toast.error(res.error)
          // The decision did not go through: the card comes back.
          setGone((g) => {
            const next = new Set(g)
            next.delete(getKeyRef.current(p.item))
            return next
          })
        }
      })
    },
    [],
  )

  /** Send the waiting decision now (another swipe, or leaving the page). */
  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    window.clearTimeout(p.timer)
    dismissToast(p.toastId)
    send(p)
  }, [send])

  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      flush()
    }
  }, [flush])

  const decide = useCallback(
    (decision: SwipeDecision) => {
      if (!card) return
      flush()
      const key = getKey(card)
      setGone((g) => new Set(g).add(key))
      setDx(0)
      const undo = () => {
        const p = pending.current
        if (!p || getKey(p.item) !== key) return
        pending.current = null
        window.clearTimeout(p.timer)
        setGone((g) => {
          const next = new Set(g)
          next.delete(key)
          return next
        })
      }
      const toastId = toast.info(t('sd_done').replace('{action}', decision === 'keep' ? keepLabel : discardLabel), {
        ttlMs: UNDO_MS,
        action: { label: t('sd_undo'), onClick: undo },
      })
      const p: Pending<T> = {
        item: card,
        decision,
        toastId,
        timer: window.setTimeout(() => {
          if (pending.current === p) {
            pending.current = null
            send(p)
          }
        }, UNDO_MS),
      }
      pending.current = p
    },
    [card, flush, getKey, send, t, keepLabel, discardLabel],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowLeft') decide('discard')
      else if (e.key === 'ArrowRight') decide('keep')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide])

  if (!card) {
    return (
      <p data-testid={`${testId}-empty`} className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx3)' }}>
        {emptyText}
      </p>
    )
  }

  const tilt = Math.max(-1, Math.min(1, dx / 160))
  return (
    <div data-testid={testId}>
      <p className="t-mono-sm" data-testid={`${testId}-count`} style={{ fontSize: 11, color: 'var(--tx3)', margin: '0 0 8px', textAlign: 'right' }}>
        {t('sd_count').replace('{n}', String(visible.length))}
      </p>
      <div
        data-testid={`${testId}-card`}
        onTouchStart={(e) => {
          startX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchMove={(e) => {
          if (startX.current == null) return
          setDx((e.touches[0]?.clientX ?? startX.current) - startX.current)
        }}
        onTouchEnd={() => {
          const d = dx
          startX.current = null
          if (Math.abs(d) >= SWIPE_PX) decide(d < 0 ? 'discard' : 'keep')
          else setDx(0)
        }}
        style={{
          transform: `translateX(${dx}px) rotate(${tilt * 4}deg)`,
          transition: startX.current == null ? 'transform 160ms ease-out' : 'none',
          touchAction: 'pan-y',
          outline: dx === 0 ? 'none' : `2px solid ${dx < 0 ? 'var(--rust)' : 'var(--sage, var(--ac))'}`,
          borderRadius: 8,
        }}
      >
        {renderCard(card)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="btn ghost"
          data-testid={`${testId}-discard`}
          onClick={() => decide('discard')}
          style={{ minHeight: 48, flex: 1, color: 'var(--rust)' }}
        >
          <span aria-hidden="true">✕ </span>
          {discardLabel}
        </button>
        <button
          type="button"
          className="btn primary"
          data-testid={`${testId}-keep`}
          onClick={() => decide('keep')}
          style={{ minHeight: 48, flex: 1 }}
        >
          <span aria-hidden="true">✓ </span>
          {keepLabel}
        </button>
      </div>
      <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center', margin: '8px 0 0' }}>
        {t('sd_hint')}
      </p>
    </div>
  )
}
