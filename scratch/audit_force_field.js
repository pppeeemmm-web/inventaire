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

async function audit() {
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Catalogué, NeedsPhotograph, commercial_status, LocalisationID, statusId, StageProduction');

  if (error) {
    console.error(error);
    return;
  }

  const issues = data.filter(o => {
    // Rule: If not catalogued or needs photo, must be private and in atelier
    const isWIP = !o.Catalogué || o.NeedsPhotograph;
    if (isWIP) {
      if (o.commercial_status !== 'private') return true;
      if (o.LocalisationID !== 13 && o.LocalisationID !== '13') return true;
    }
    return false;
  });

  console.log(`Total works: ${data.length}`);
  console.log(`Works violating Force Field: ${issues.length}`);
  if (issues.length > 0) {
    console.log('Sample issues:', JSON.stringify(issues.slice(0, 5), null, 2));
  }
}

audit();
