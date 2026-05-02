const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: works } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, txtImageNameLink, is_public')
    .eq('is_public', true)

  const { data: themes } = await supabase.from('OeuvreTheme').select('OeuvreID, ThemeID')
  const { data: themeNames } = await supabase.from('tblTheme').select('ThemeID, Nom')

  const thMap = {}
  themeNames.forEach(t => thMap[t.ThemeID] = t.Nom)

  const pubWorks = works.map(w => {
    const tIds = themes.filter(t => t.OeuvreID === w.OeuvreID).map(t => thMap[t.ThemeID])
    return { ...w, themes: tIds }
  })

  console.log("Total public works:", pubWorks.length)
  const purinos = pubWorks.filter(w => w.themes.includes("Pürinos"))
  console.log("Works in Pürinos theme:", purinos.length)
  console.log("Sample Pürinos works:", purinos.slice(0, 3))
}

run()
