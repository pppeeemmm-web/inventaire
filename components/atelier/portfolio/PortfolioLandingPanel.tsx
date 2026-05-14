'use client'

export function PortfolioLandingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col gap-lg" style={{ gap: 24 }}>
      {children}
    </div>
  )
}
