'use client'

import type { OwnStageId } from '@/lib/work-editor-model'

export function DrawerContentSaveFooter({
  narrow,
  t,
  isSaving,
  isSel,
  ownStage,
  onSave,
  onToggleSel,
  onRequestGift,
  confirmDelete,
  setConfirmDelete,
  deleting,
  onDelete,
  deleteError,
  setDeleteError,
}: {
  narrow: boolean
  t: (k: string) => string
  isSaving: boolean
  isSel: boolean
  ownStage: OwnStageId
  onSave: () => void
  onToggleSel: () => void
  onRequestGift: () => void
  confirmDelete: boolean
  setConfirmDelete: (v: boolean) => void
  deleting: boolean
  onDelete: () => void
  deleteError: string | null
  setDeleteError: (v: string | null) => void
}) {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 14,
        borderTop: '1px solid var(--bd)',
        ...(narrow
          ? {
              position: 'sticky',
              bottom: 0,
              zIndex: 4,
              background: 'var(--bg1)',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }
          : {}),
      }}
    >
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button className="btn primary" type="button" onClick={onSave} disabled={isSaving} style={{ fontSize: 11, minHeight: 44 }}>
          {isSaving ? '…' : t('save')}
        </button>
        <button type="button" className={`btn ${isSel ? 'primary' : 'ghost'}`} onClick={onToggleSel} style={{ fontSize: 11, minHeight: 44 }}>
          {isSel ? t('wf_in_selection_short') : t('wf_add_selection_short')}
        </button>
        {!(ownStage === 'sold' || ownStage === 'gift' || ownStage === 'artist_archive') && (
          <button
            className="btn ghost sm"
            type="button"
            style={{ fontSize: 11, color: 'var(--ac)', borderColor: 'rgba(200,168,110,0.4)', minHeight: 44 }}
            onClick={onRequestGift}
            title={t('workDrawer_gift_body')}
          >
            ⊕ {t('workDrawer_gift_cta')}
          </button>
        )}
        {!confirmDelete ? (
          <button
            type="button"
            className="btn ghost sm"
            style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 10, minHeight: 44 }}
            onClick={() => setConfirmDelete(true)}
          >
            {t('delete')}
          </button>
        ) : (
          <div className="row gap-sm" style={{ marginLeft: 'auto', alignItems: 'center' }}>
            <button type="button" className="btn ghost sm" style={{ color: '#c0392b', minHeight: 44 }} disabled={deleting} onClick={onDelete}>
              {deleting ? '…' : t('btn_confirm')}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>
              ×
            </button>
          </div>
        )}
      </div>
      {deleteError && <div style={{ color: '#c0392b', fontSize: 10, marginTop: 6 }}>{deleteError}</div>}
    </div>
  )
}
