import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function normalizeKinds() {
  const { data, error } = await supabase
    .from('document')
    .update({ kind: 'autre' })
    .eq('kind', 'other')
  
  if (error) {
    console.error('Update error:', error)
  } else {
    console.log('Successfully normalized "other" to "autre"')
  }
}

normalizeKinds()
