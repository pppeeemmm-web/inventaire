'use client'

import { useEffect, useState } from 'react'
import { subscribeToasts, type ToastItem } from '@/lib/ui/toast'

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null

  return (
    <div className="pem-toastHost" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pem-toast pem-toast--${t.kind}${t.action ? ' pem-toast--interactive' : ''}`}
          role="status"
        >
          <span className="pem-toastIcon" aria-hidden>
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'i'}
          </span>
          <div className="pem-toastBody">
            <span className="t-mono-sm pem-toastMsg">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="pem-toastAction t-mono-sm"
                onClick={() => t.action?.onClick()}
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
