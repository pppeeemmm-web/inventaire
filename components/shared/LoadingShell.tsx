'use client'

import { Skeleton } from '@/components/ui/Skeleton'

interface Props {
  title?: string
}

/** Uniform loading placeholder for Atelier tab panels. */
export function LoadingShell({ title }: Props) {
  return (
    <div className="pem-fadeIn" style={{ flex: 1, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {title && (
        <div className="t-mono-sm" style={{ opacity: 0.5, marginBottom: 4 }}>{title}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton w="100%" h={12} radius={2} />
        <Skeleton w="88%" h={12} radius={2} />
        <Skeleton w="76%" h={12} radius={2} />
      </div>
      <div style={{ height: 12 }} />
      <Skeleton w="100%" h={120} radius={4} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton w="33%" h={80} radius={4} />
        <Skeleton w="33%" h={80} radius={4} />
        <Skeleton w="33%" h={80} radius={4} />
      </div>
    </div>
  )
}
