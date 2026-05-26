'use client'

import { useEffect, useId, useRef } from 'react'

type StackEntry = { id: string; close: () => void }

const stack: StackEntry[] = []
let listenerAttached = false

/** Skip Esc-to-close while the user is typing in a field (native Esc still works in inputs). */
export function shouldIgnoreEscapeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return (
      type === 'text' ||
      type === 'search' ||
      type === 'email' ||
      type === 'password' ||
      type === 'url' ||
      type === 'tel' ||
      type === 'number'
    )
  }
  if (target.isContentEditable) return true
  return false
}

function onDocumentKeyDown(ev: KeyboardEvent) {
  if (ev.key !== 'Escape' || stack.length === 0) return
  if (shouldIgnoreEscapeTarget(ev.target)) return
  const top = stack[stack.length - 1]
  if (!top) return
  ev.preventDefault()
  ev.stopPropagation()
  top.close()
}

function ensureListener() {
  if (listenerAttached) return
  listenerAttached = true
  window.addEventListener('keydown', onDocumentKeyDown, true)
}

/**
 * Register a modal/overlay on a global Escape stack (topmost closes first).
 * Use capture-phase listener so nested overlays beat underlying shells.
 */
export function useEscapeClose(enabled: boolean, onClose: () => void) {
  const id = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled) return
    ensureListener()
    const entry: StackEntry = { id, close: () => onCloseRef.current() }
    stack.push(entry)
    return () => {
      const idx = stack.findIndex((e) => e.id === id)
      if (idx >= 0) stack.splice(idx, 1)
    }
  }, [enabled, id])
}
