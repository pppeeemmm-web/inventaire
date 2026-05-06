const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function applyFix() {
  console.log('--- STARTING GLOBAL FORCE FIELD FIX ---');
  
  const { data: works, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Catalogué, NeedsPhotograph, commercial_status, LocalisationID, statusId, StageProduction');

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  console.log(`Auditing ${works.length} works...`);

  let updatedCount = 0;

  for (const o of works) {
    const updates = {};
    const isCatalogued = !!o['Catalogué'];
    const needsPhoto = !!o.NeedsPhotograph;
    const statusId = o.statusId;
    const isArchive = [6, 7, 11].includes(statusId);

    // 1. Production Gate
    if (!isCatalogued || needsPhoto) {
      if (o.commercial_status !== 'private') updates.commercial_status = 'private';
      if (o.LocalisationID !== 13 && o.LocalisationID !== '13') updates.LocalisationID = 13;
      
      const targetStage = needsPhoto ? 'shot' : 'wip';
      if (o.StageProduction !== targetStage) updates.StageProduction = targetStage;
    } 
    // 2. Archive Gate
    else if (isArchive) {
      if (o.StageProduction !== 'archive') updates.StageProduction = 'archive';
    }
    // 3. Stocked Gate
    else {
      if (o.StageProduction !== 'available') updates.StageProduction = 'available';
      // If it was private but now it's catalogued and not archived, it SHOULD be available
      if (o.commercial_status === 'private') updates.commercial_status = 'available';
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from('Oeuvres')
        .update(updates)
        .eq('OeuvreID', o.OeuvreID);
      
      if (upErr) {
        console.error(`Error updating #${o.OeuvreID}:`, upErr.message);
      } else {
        updatedCount++;
        if (updatedCount % 50 === 0) console.log(`Fixed ${updatedCount} works...`);
      }
    }
  }

  console.log(`--- FINISHED ---`);
  console.log(`Total works fixed: ${updatedCount}`);
}

applyFix();
