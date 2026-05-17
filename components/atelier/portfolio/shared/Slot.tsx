'use client'

export function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6, fontSize: 9 }}>{label}</label>
      {children}
    </div>
  )
}
