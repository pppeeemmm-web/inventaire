export function ConceptEnergieDot({ e }: { e: number | null }) {
  if (!e) return null
  const colors = ['', '#888', '#a0b060', '#e08020', '#e04040', '#c020c0']
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < e ? colors[e] : 'var(--bg2)',
        }} />
      ))}
    </span>
  )
}
