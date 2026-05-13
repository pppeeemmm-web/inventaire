'use client'

interface Props {
  title: string
  cta?: { label: string; onClick: () => void }
}

/** Uniform empty-state for Atelier tab panels. */
export function EmptyState({ title, cta }: Props) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 40,
      opacity: 0.6,
    }}>
      <div className="t-mono-sm" style={{ textAlign: 'center' }}>{title}</div>
      {cta && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={cta.onClick}
          style={{ fontSize: 11, minHeight: 36 }}
        >
          {cta.label}
        </button>
      )}
    </div>
  )
}
