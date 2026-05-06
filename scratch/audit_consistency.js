
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log('--- Detailed Available Works Audit ---');
  
  const { data: oeuvres } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, statusId, LocalisationID, StageProduction, Catalogué')
    .eq('statusId', 2); // Available

  console.log(`Total Available works: ${oeuvres.length}`);
  
  const inconsistencies = oeuvres.filter(o => o.LocalisationID !== 13 && o.LocalisationID !== null);
  
  console.log(`\nInconsistent Available works (Location is not 13 or NULL):`);
  inconsistencies.forEach(o => {
    console.log(`  - #${o.OeuvreID}: ${o.Titre} | LocID: ${o.LocalisationID} | Stage: ${o.StageProduction} | Catalogué: ${o.Catalogué}`);
  });

  console.log('\n--- Checking Loc 13 details ---');
  const { data: pemAtelier } = await supabase.from('Contact').select('*').eq('ContactID', 13).single();
  console.log('PEM Atelier Contact:', pemAtelier);
}

audit();
