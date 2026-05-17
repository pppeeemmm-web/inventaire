import type { Metadata } from 'next'
import { FieldInboxClient } from '@/components/atelier/FieldInboxClient'
import { getFieldPulseData } from './data'
import { dict } from '@/lib/i18n/dictionary'

export const metadata: Metadata = {
  title: dict.fr.field_inbox_title,
  robots: { index: false, follow: false },
}

export default async function FieldInboxPage() {
  const pulse = await getFieldPulseData()
  return <FieldInboxClient pulse={pulse} />
}
