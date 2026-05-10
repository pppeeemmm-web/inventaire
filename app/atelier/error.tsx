'use client'

export default function AtelierError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: 48, maxWidth: 560, margin: '0 auto', color: 'var(--tx)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 16, color: 'var(--rust)' }}>Erreur Atelier</h1>
      <p style={{ fontSize: 13, color: 'var(--tx2)', marginBottom: 12 }}>
        La page n’a pas pu être générée. Vérifiez la console du serveur (terminal Next) pour le détail.
      </p>
      <pre
        style={{
          fontSize: 11,
          padding: 12,
          background: 'var(--bg2)',
          border: '1px solid var(--bd)',
          borderRadius: 4,
          overflow: 'auto',
          color: 'var(--tx3)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {error.message}
      </pre>
      <button type="button" className="btn sm" style={{ marginTop: 20 }} onClick={() => reset()}>
        Réessayer
      </button>
    </div>
  )
}
