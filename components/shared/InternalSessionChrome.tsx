import { getSessionUserDisplay } from '@/lib/session-user'
import { LoggedInBar } from '@/components/shared/LoggedInBar'

/** Protected internal shell — floating signed-in hint only. */
export async function InternalSessionChrome({ children }: { children: React.ReactNode }) {
  const { displayName, fullName } = await getSessionUserDisplay()
  return (
    <>
      <LoggedInBar displayName={displayName} fullName={fullName} />
      {children}
    </>
  )
}
