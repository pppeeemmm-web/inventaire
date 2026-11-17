import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'

/**
 * Notes moved into the Journal (R1 step 7, 2026-11-17): a voice note is a Journal entry spoken instead
 * of written, linked with « Relier » on the entry. Old links keep working: `?note=<id>` (linked-notes
 * blocks on works, ideas, projects) opens the Journal on that note's day.
 */
export default async function NotesRedirect({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const { note } = await searchParams
  if (note && /^[0-9a-f-]{36}$/i.test(note)) {
    const supabase = await createClient()
    const { data } = await supabase.from('voice_note').select('created_at').eq('id', note).maybeSingle()
    if (data?.created_at) redirect(`/atelier/journal?day=${calendarDayInParisFromIso(data.created_at)}`)
  }
  redirect('/atelier/journal')
}
