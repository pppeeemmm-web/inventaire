import { redirect } from 'next/navigation'
import { CaptureCardClient } from '@/components/atelier/capture/CaptureCardClient'
import { CaptureDocClient } from '@/components/atelier/capture/CaptureDocClient'
import { CaptureInspirationClient } from '@/components/atelier/capture/CaptureInspirationClient'

type Props = { searchParams: Promise<{ mode?: string }> }

export default async function CapturePage({ searchParams }: Props) {
  const { mode } = await searchParams
  if (mode === 'doc') return <CaptureDocClient />
  if (mode === 'card') return <CaptureCardClient />
  // Inspiration photo (R1 / R2): the screen exists before its SQL; it saves nothing until INSPIRATION_SQL_LIVE.
  if (mode === 'inspiration') return <CaptureInspirationClient />
  redirect('/hub')
}
