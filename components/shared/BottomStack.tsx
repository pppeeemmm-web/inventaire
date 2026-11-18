'use client'

import { useLayoutEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'

/**
 * Atelier fixed bottom / overlay z-index ladder.
 * WorkDrawer overlay: 60 · BatchEdit/Export modals (portaled): 152 · VoiceNoteSheet: 155.
 */
export const PEM_Z_INDEX = {
  bottomStackRoot: 40,
  mobileActionBar: 50,
  workDrawer: 60,
  curationDock: 75,
  /** Portaled to document.body — above narrow sidebar (150), below voice sheet (155). */
  modal: 152,
  voiceNoteSheet: 155,
} as const

/**
 * Phone bottom chrome heights as CSS variables on `<html>` (docs/design/2026-11-18/LayoutFixes.notes.md):
 * `--pem-phone-bar-h` = the input bar (`PhoneInputBar`, safe-area padding included), `--pem-selection-bar-h` =
 * the phone selection bar (`CurationDock`). `--pem-bottom-chrome-h` (globals.css) = their sum: toasts and the
 * page's bottom padding sit above it. 0px while the element is not mounted.
 */
export type BottomChromeVar = '--pem-phone-bar-h' | '--pem-selection-bar-h'

export function useBottomChromeHeight(ref: RefObject<HTMLElement | null>, cssVar: BottomChromeVar, active = true) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !active) return
    const root = document.documentElement
    const set = () => root.style.setProperty(cssVar, `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty(cssVar)
    }
  }, [ref, cssVar, active])
}

export type BottomStackLayerId = 'mobileActionBar' | 'curationDock' | 'voiceNote'

const LAYER_Z: Record<BottomStackLayerId, number> = {
  mobileActionBar: PEM_Z_INDEX.mobileActionBar,
  curationDock: PEM_Z_INDEX.curationDock,
  voiceNote: PEM_Z_INDEX.voiceNoteSheet,
}

/**
 * Non-interactive root for portal bottom chrome; children opt in with `BottomStackLayer`.
 * Modals: `PemModalOverlay` only — enforced by `npm run atelier:chrome:check`.
 */
export function BottomStack({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="pem-bottom-stack"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: PEM_Z_INDEX.bottomStackRoot,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}

/** Fixed bottom slot with shared z-index; sets `pointer-events: auto` on the layer. */
export function BottomStackLayer({
  layer,
  visible = true,
  children,
  style,
}: {
  layer: BottomStackLayerId
  visible?: boolean
  children: ReactNode
  style?: CSSProperties
}) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: layer === 'voiceNote' ? 0 : undefined,
        left: layer === 'voiceNote' ? 0 : undefined,
        right: layer === 'voiceNote' ? 0 : undefined,
        bottom: layer === 'voiceNote' ? undefined : 0,
        zIndex: LAYER_Z[layer],
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
