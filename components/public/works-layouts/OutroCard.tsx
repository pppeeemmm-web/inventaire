'use client'

import { useI18n } from '@/lib/i18n/context'
import type { WorksMode } from '@/components/public/works-utils'

interface Props {
  mode: WorksMode
  variant?: 'inline' | 'trailing'
}

/** "Carte de clôture" — closing text card rendered at the end of each layout
 *  whenever the active mode has outro_fr / outro_en. The string is rich-text
 *  HTML so we inject it via dangerouslySetInnerHTML (same as elsewhere in this app). */
export default function OutroCard({ mode, variant = 'trailing' }: Props) {
  const { lang } = useI18n()
  const html = lang === 'en'
    ? (mode.outro_en || mode.outro_fr || '')
    : (mode.outro_fr || mode.outro_en || '')
  if (!html.trim()) return null
  return (
    <aside
      className="w-outro"
      style={{
        maxWidth: 560,
        margin: variant === 'trailing' ? '64px auto 0' : '32px auto',
        fontFamily: "'Instrument Serif', serif",
        fontSize: 'clamp(14px, 1.8vw, 17px)',
        lineHeight: 1.7,
        textAlign: 'center',
        opacity: 0.85,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
