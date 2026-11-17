import { Suspense } from 'react'
import { getSessionUserDisplay } from '@/lib/session-user'
import { LoggedInBar } from '@/components/shared/LoggedInBar'

/**
 * Protected internal shell — floating signed-in hint only.
 * The pill streams in after the first byte (R2 speed, PhoneToday.notes.md): its name needs two more
 * Supabase reads, about 0.4 s from the server, and it is fixed-position so nothing moves when it lands.
 * The session check itself stays in each layout's `requireSession()`, before anything is sent.
 */
export function InternalSessionChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SessionPill />
      </Suspense>
      {children}
    </>
  )
}

async function SessionPill() {
  const { displayName, fullName } = await getSessionUserDisplay()
  return <LoggedInBar displayName={displayName} fullName={fullName} />
}
