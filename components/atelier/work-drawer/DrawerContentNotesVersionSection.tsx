'use client'

import { WorkVersionHistory } from '../WorkVersionHistory'
import { FIS, SectionTitle } from './drawer-widgets'

export function DrawerContentNotesVersionSection({
  oeuvreId,
  t,
  commentaires,
  setCommentaires,
  historique,
  setHistorique,
  onVersionRestored,
}: {
  oeuvreId: number
  t: (k: import('@/lib/i18n/dictionary').DictKey) => string
  commentaires: string
  setCommentaires: (v: string) => void
  historique: string
  setHistorique: (v: string) => void
  onVersionRestored: () => void
}) {
  return (
    <>
      <section>
        <SectionTitle title={t('wf_comments')} />
        <textarea
          className="input"
          value={commentaires}
          onChange={(e) => setCommentaires(e.target.value)}
          style={{ ...FIS, minHeight: 80, resize: 'vertical', fontSize: 12 }}
          placeholder={t('wf_comments_placeholder')}
        />
        <div style={{ marginTop: 12 }}>
          <div className="t-label" style={{ fontSize: 10, marginBottom: 4 }}>
            {t('wf_history_title')}
          </div>
          <textarea
            className="input"
            value={historique}
            onChange={(e) => setHistorique(e.target.value)}
            style={{ ...FIS, minHeight: 88, resize: 'vertical', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            placeholder={t('wf_history_placeholder')}
          />
          <div className="t-mono-xs" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>
            {t('wf_history_hint')}
          </div>
        </div>
      </section>

      <WorkVersionHistory oeuvreId={oeuvreId} onRestored={onVersionRestored} />
    </>
  )
}
