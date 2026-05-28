'use client'

export function UnsavedChangesModal({
  saving,
  t,
  onDiscard,
  onCancel,
  onSaveAndClose,
}: {
  saving: boolean
  t: (k: import('@/lib/i18n/dictionary').DictKey) => string
  onDiscard: () => void
  onCancel: () => void
  onSaveAndClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-drawer-unsaved-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => {
        if (saving) return
        onCancel()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          borderRadius: 10,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div id="work-drawer-unsaved-title" style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", marginBottom: 8, color: 'var(--tx)' }}>
          {t('workDrawerUnsavedTitle')}
        </div>
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 20, lineHeight: 1.45 }}>
          {t('workDrawerUnsavedBody')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn ghost sm"
            disabled={saving}
            onClick={onDiscard}
            style={{ color: 'var(--rust)', borderColor: 'rgba(192,57,43,0.35)' }}
          >
            {t('workDrawerDiscard')}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={saving}
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
          <button type="button" className="btn primary sm" disabled={saving} onClick={onSaveAndClose}>
            {saving ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
