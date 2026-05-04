const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testWorksPageLogic() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: themeRecords } = await supabase.from('tblTheme').select('ThemeID, Nom');
  const { data: oeuvreThemes } = await supabase.from('OeuvreTheme').select('OeuvreID, ThemeID');
  
  const oeuvreIds = [...new Set((oeuvreThemes || []).map((ot) => ot.OeuvreID))];
  console.log('TOTAL OEUVRE IDS WITH THEMES:', oeuvreIds.length);

  const { data: rawWorks, error: rawError } = await supabase.from('Oeuvres')
    .select('OeuvreID, Titre, Annee, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('is_public', true)
    .in('OeuvreID', oeuvreIds);
  
  if (rawError) console.error('RAW ERROR:', rawError);
  console.log('PUBLIC WORKS WITH THEMES:', rawWorks?.length);

  const oeuvreThemeMap = new Map();
  if (themeRecords && oeuvreThemes) {
    const idToName = Object.fromEntries(themeRecords.map(r => [r.ThemeID, r.Nom]));
    oeuvreThemes.forEach(ot => {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, []);
      const name = idToName[ot.ThemeID];
      if (name) oeuvreThemeMap.get(ot.OeuvreID).push(name);
    });
  }

  const works = (rawWorks || []).map(w => ({
    OeuvreID: w.OeuvreID,
    Titre: w.Titre,
    themes: oeuvreThemeMap.get(w.OeuvreID) ?? [],
  }));

  const targetTheme = "CoG 26";
  const matches = works.filter(w => w.themes.includes(targetTheme));
  console.log(`WORKS MATCHING "${targetTheme}":`, matches.length);
}

testWorksPageLogic();
