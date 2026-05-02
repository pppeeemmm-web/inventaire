const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

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
  
  console.log('Document Kinds counts:', counts)
}

checkKinds()
