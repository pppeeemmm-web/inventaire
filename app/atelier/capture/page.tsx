import { FieldToolStubPage } from '@/components/atelier/FieldToolStubPage'
import { CaptureCardClient } from '@/components/atelier/capture/CaptureCardClient'
import { CaptureDocClient } from '@/components/atelier/capture/CaptureDocClient'

type Props = { searchParams: Promise<{ mode?: string }> }

export default async function CapturePage({ searchParams }: Props) {
  const { mode } = await searchParams
  if (mode === 'doc') return <CaptureDocClient />
  if (mode === 'card') return <CaptureCardClient />
  return <FieldToolStubPage kind="capture" />
}
