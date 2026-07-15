'use client'

import { useMediaQuery } from '@/lib/useMediaQuery'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'

export function NewWorkPageShell({ children }: { children: React.ReactNode }) {
  const narrow = useMediaQuery('(max-width: 767px)')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {narrow && (
        <FieldHubBackLink
          style={{
            marginTop: 0,
            flexShrink: 0,
            margin: '8px max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))',
          }}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
    </div>
  )
}
