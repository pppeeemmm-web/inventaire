'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PEM_Z_INDEX } from '@/components/shared/BottomStack'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Props = {
  children: ReactNode
  onClose: () => void
  panelStyle?: CSSProperties
}

/** Full-screen modal shell portaled to document.body (escapes BottomStack pointer-events / z-index trap). */
export function PemModalOverlay({ children, onClose, panelStyle }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEscapeClose(mounted, onClose)
  if (!mounted) return null

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: PEM_Z_INDEX.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          pointerEvents: 'auto',
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
