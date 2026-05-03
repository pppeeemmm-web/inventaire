'use client'

import { useI18n } from '@/lib/i18n/context'
import { statusOf, stageOf, stageColor } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

interface Props {
  o: Oeuvre
  statusLabelMap: Record<number, string>
}

/**
 * Visual tag for production stage. 
 * Unified source of truth for rendering production status labels across the app.
 */
export function StageChip({ o, statusLabelMap }: Props) {
  const { t } = useI18n()
  const st = statusOf(o, statusLabelMap)
  const isGone = st === 'sold' || st === 'gift' || st === 'destroyed' || st === 'lost'
  
  if (isGone) return <span style={{ opacity: 0.3 }}>—</span>

  const isCat = o.Catalogué
  const needsPhoto = (o as any).NeedsPhotograph || (o as any).needsphotograph
  const rawStage = (o as any).StageProduction

  // Priority 1: Explicit Stage from DB (The "River")
  if (rawStage) {
    const sc = stageColor(rawStage)
    let label = t(`stage_${rawStage}` as any)
    
    // Explicit overrides for clarity
    if (rawStage === 'available') label = 'DISPONIBLE'
    if (rawStage === 'catalogued') label = 'FINI'
    if (rawStage === 'atelier') label = 'ATELIER'

    return (
      <span style={{ 
        fontSize: 8, padding: '2px 6px', border: `1px solid ${sc}`, color: sc, 
        textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 2, display: 'inline-block'
      }}>
        {label}
      </span>
    )
  }

  // Priority 2: Fallback to Catalogued flag if no explicit stage set
  if (isCat) {
    return (
      <span style={{ 
        fontSize: 8, padding: '2px 6px', border: '1px solid var(--sage)', color: 'var(--sage)', 
        textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 2, display: 'inline-block'
      }}>
        FINI
      </span>
    )
  }

  // Priority 3: Needs Photo
  if (needsPhoto) {
    return (
      <span style={{ 
        fontSize: 8, padding: '2px 6px', border: '1px solid var(--cyan)', color: 'var(--cyan)', 
        textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 2, display: 'inline-block'
      }}>
        {t('stage_shot' as any)}
      </span>
    )
  }

  // Priority 4: Inferred fallback
  const inferredKey = stageOf(o, statusLabelMap)
  const infRaw = inferredKey.replace('stage_', '')
  const sc = stageColor(infRaw)
  
  return (
    <span style={{ 
      fontSize: 8, padding: '2px 6px', border: `1px solid ${sc}`, color: sc, 
      textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 2, display: 'inline-block'
    }}>
      {t(inferredKey as any)}
    </span>
  )
}
