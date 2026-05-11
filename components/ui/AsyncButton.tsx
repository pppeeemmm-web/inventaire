import React from 'react'
import { InlineSpinner } from '@/components/ui/InlineSpinner'

export function AsyncButton({
  pending,
  pendingText,
  children,
  className = 'btn',
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending: boolean
  pendingText?: string
}) {
  const isDisabled = !!disabled || pending
  const label = pending && pendingText ? pendingText : children

  return (
    <button
      {...props}
      className={className}
      disabled={isDisabled}
      aria-busy={pending || undefined}
      style={{
        ...(props.style ?? {}),
        opacity: pending ? 0.85 : (props.style?.opacity as any),
        cursor: isDisabled ? 'default' : (props.style?.cursor as any),
      }}
    >
      {pending ? <InlineSpinner size={14} className="pem-btnSpinner" /> : null}
      <span className="pem-btnLabel">{label}</span>
    </button>
  )
}

