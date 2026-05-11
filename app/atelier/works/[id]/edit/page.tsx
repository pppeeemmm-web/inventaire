// /atelier/works/[id]/edit — canonical edit is WorkDrawer on /atelier; deep link redirects.
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditWorkPage({ params }: Props) {
  const { id } = await params
  const oid = parseInt(id, 10)
  if (Number.isNaN(oid)) notFound()
  redirect(`/atelier?work=${oid}`)
}
