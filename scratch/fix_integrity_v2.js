
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixIntegrity() {
  console.log('--- STARTING INTEGRITY AUDIT ---');

  // 1. Fetch all works with production stages that imply they should be at the studio
  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, LocalisationID, StageProduction, Catalogué, NeedsPhotograph')
    .or('StageProduction.eq.atelier,StageProduction.eq.wip,StageProduction.eq.catalogued,StageProduction.eq.shot,StageProduction.is.null');

  if (error) {
    console.error('Error fetching works:', error);
    return;
  }

  console.log(`Auditing ${works.length} works in production stages...`);

  const PEM_ID = 13;
  const STATUS_ATELIER = 1;
  const STATUS_AVAILABLE = 2;

  let fixedCount = 0;

  for (const w of works) {
    const stage = w.StageProduction || (w.Catalogué ? 'catalogued' : 'atelier');
    const isProduction = ['atelier', 'wip', 'catalogued', 'shot'].includes(stage);
    
    let needsUpdate = false;
    const updates = {};

    // RULE A: Production works must be at PEM Atelier
    if (isProduction && w.LocalisationID !== PEM_ID) {
      console.log(`[LOC] Work #${w.OeuvreID} (${w.Titre}) is at ${w.LocalisationID}, forcing to ${PEM_ID}`);
      updates.LocalisationID = PEM_ID;
      needsUpdate = true;
    }

    // RULE B: Production works cannot be "Available" (2) or "Sold" (6) or "Consigned" (7)
    // Exception: Archive (5) is okay if it's explicitly archived.
    if (isProduction && (w.statusId === STATUS_AVAILABLE || w.statusId === 6 || w.statusId === 7 || w.statusId === 8)) {
      console.log(`[STAT] Work #${w.OeuvreID} (${w.Titre}) has status ${w.statusId}, forcing to ${STATUS_ATELIER}`);
      updates.statusId = STATUS_ATELIER;
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: upError } = await supabase
        .from('Oeuvres')
        .update(updates)
        .eq('OeuvreID', w.OeuvreID);
      
      if (upError) console.error(`Failed to update #${w.OeuvreID}:`, upError);
      else fixedCount++;
    }
  }

  console.log(`--- AUDIT COMPLETE: ${fixedCount} works repaired ---`);
}

fixIntegrity();
