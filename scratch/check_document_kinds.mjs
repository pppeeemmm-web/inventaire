import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkKinds() {
  const { data, error } = await supabase
    .from('document')
    .select('kind')
  
  if (error) {
    console.error(error)
    return
  }

  const counts = {}
  data.forEach(d => {
    counts[d.kind] = (counts[d.kind] || 0) + 1
  })
  
  console.log('Document Kinds counts:', JSON.stringify(counts, null, 2))
}

checkKinds()
