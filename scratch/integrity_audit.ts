import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function audit() {
  const { data: oeuvres, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, StageProduction, NeedsPhotograph, Catalogué, is_gift, LocalisationID, ContactID')

  if (error) {
    console.error(error)
    return
  }

  const report = {
    catalogued_but_available: [] as any[],
    needs_photo_but_available: [] as any[],
    gift_inconsistencies: [] as any[],
    production_not_at_pem: [] as any[],
  }

  oeuvres.forEach(o => {
    // 1. Catalogued but Available
    if (o.Catalogué && o.statusId === 2) {
        report.catalogued_but_available.push({ id: o.OeuvreID, titre: o.Titre })
    }

    // 2. Needs Photo but Available
    if (o.NeedsPhotograph && o.statusId === 2) {
        report.needs_photo_but_available.push({ id: o.OeuvreID, titre: o.Titre })
    }

    // 3. Gift Inconsistencies (Should be status 11 and archived)
    if (o.is_gift || o.statusId === 11) {
        const isBroken = (o.statusId !== 11) || (o.StageProduction !== 'archive') || (o.LocalisationID === 13)
        if (isBroken) {
            report.gift_inconsistencies.push({ 
                id: o.OeuvreID, 
                titre: o.Titre, 
                statusId: o.statusId, 
                stage: o.StageProduction, 
                loc: o.LocalisationID,
                is_gift: o.is_gift
            })
        }
    }

    // 4. Production not at PEM
    const isProd = ['wip', 'atelier', 'catalogued', 'shot'].includes(o.StageProduction || '') || o.statusId === 1
    if (isProd && o.LocalisationID !== 13 && o.StageProduction !== 'archive') {
        report.production_not_at_pem.push({ id: o.OeuvreID, titre: o.Titre, stage: o.StageProduction, loc: o.LocalisationID })
    }
  })

  console.log("=== ATELIER INTEGRITY REPORT ===")
  console.log(`\n1. CATALOGUED BUT AVAILABLE: ${report.catalogued_but_available.length} works`)
  console.log(`\n2. NEEDS PHOTO BUT AVAILABLE: ${report.needs_photo_but_available.length} works`)
  console.log(`\n3. GIFT INCONSISTENCIES: ${report.gift_inconsistencies.length} works`)
  console.log(`\n4. PRODUCTION NOT AT PEM: ${report.production_not_at_pem.length} works`)
  
  if (report.catalogued_but_available.length > 0) {
      console.log("\nSample Catalogued but Available IDs:", report.catalogued_but_available.slice(0, 20).map(x => x.id).join(', '))
  }
}

audit()
