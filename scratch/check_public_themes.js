const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkThemes() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: themeRecords } = await supabase.from('tblTheme').select('ThemeID, Nom');
  console.log('THEME RECORDS:', themeRecords);

  const { data: works } = await supabase.from('Oeuvres').select('OeuvreID, Titre, is_public, txtImageNameLink').eq('is_public', true);
  console.log('PUBLIC WORKS COUNT:', works?.length);

  const { data: ot } = await supabase.from('OeuvreTheme').select('OeuvreID, ThemeID');
  
  const cogTheme = themeRecords.find(r => r.Nom === 'CoG 26');
  const purinosTheme = themeRecords.find(r => r.Nom === 'Πύρινος [púrinos]');

  if (cogTheme) {
    const cogWorks = ot.filter(r => r.ThemeID === cogTheme.ThemeID).map(r => r.OeuvreID);
    const publicCog = works.filter(w => cogWorks.includes(w.OeuvreID));
    console.log('PUBLIC CoG 26 WORKS:', publicCog.length);
    console.log('WITH IMAGES:', publicCog.filter(w => w.txtImageNameLink).length);
  }

  if (purinosTheme) {
    const purinosWorks = ot.filter(r => r.ThemeID === purinosTheme.ThemeID).map(r => r.OeuvreID);
    const publicPurinos = works.filter(w => purinosWorks.includes(w.OeuvreID));
    console.log('PUBLIC Purinos WORKS:', publicPurinos.length);
    console.log('WITH IMAGES:', publicPurinos.filter(w => w.txtImageNameLink).length);
  }
}

checkThemes();
