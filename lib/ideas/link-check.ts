import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * True when the moment is linked to the idea (validated). `createJournalEntry` writes the entry first and only logs a
 * failed link, so a door that promises « written into the idea » checks it (BuildingPrinciples 3: never « ok » when
 * the link is missing).
 */
export async function momentLinkedToIdea(entryId: number, conceptId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('journal_entry_link')
    .select('id')
    .eq('entry_id', entryId)
    .eq('concept_id', conceptId)
    .not('validated_at', 'is', null)
    .limit(1)
  return !!data?.length
}
