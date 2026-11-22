'use client'

// Under a corrected Journal entry's text: « Corrigée · voir le texte d'origine » (correction writer:
// EntryCorrection.tsx). Its own file so the phone Today screen does not load the editor.
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'

/** Under a corrected entry's text: « Corrigée · voir le texte d'origine ». */
export function CorrectedOriginal({ original }: { original: string | null }) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  if (!original) return null
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-expanded={show}
        className="t-mono-sm"
        style={{ background: 'none', border: 0, padding: '6px 0', minHeight: 32, fontSize: 11, color: 'var(--tx3)', cursor: 'pointer', textAlign: 'left' }}
      >
        {t('je_fix_corrected')} · {t(show ? 'je_fix_hide_original' : 'je_fix_show_original')}
      </button>
      {show ? (
        <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--tx3)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{original}</p>
      ) : null}
    </div>
  )
}
