// /atelier/works/[id] — the URL printed on work QR labels (lib/atelier/work-physical-bridge-url.ts)
// and given by "Copy link". The work opens in the WorkDrawer on /atelier.
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkLinkPage({ params }: Props) {
  const { id } = await params
  const oid = parseInt(id, 10)
  if (Number.isNaN(oid)) notFound()
  redirect(`/atelier?work=${oid}`)
}
