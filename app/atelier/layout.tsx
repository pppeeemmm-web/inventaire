// Atelier layout — auth is enforced by middleware.ts.
// This layout is a thin wrapper; the real shell lives in TeamPortal.
export default function AtelierLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
