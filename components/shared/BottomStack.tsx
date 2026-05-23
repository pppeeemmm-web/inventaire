'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Atelier fixed bottom / overlay z-index ladder.
 * WorkDrawer overlay: 60 · BatchEdit/Export modals: 80 · VoiceNoteSheet: 155.
 */
export const PEM_Z_INDEX = {
  bottomStackRoot: 40,
  mobileActionBar: 50,
  workDrawer: 60,
  curationDock: 75,
  modal: 80,
  voiceNoteSheet: 155,
} as const

export type BottomStackLayerId = 'mobileActionBar' | 'curationDock' | 'voiceNote'

const LAYER_Z: Record<BottomStackLayerId, number> = {
  mobileActionBar: PEM_Z_INDEX.mobileActionBar,
  curationDock: PEM_Z_INDEX.curationDock,
  voiceNote: PEM_Z_INDEX.voiceNoteSheet,
}

/** Non-interactive root for portal bottom chrome; children opt in with `BottomStackLayer`. */
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
