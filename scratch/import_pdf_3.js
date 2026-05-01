const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function processThirdPdf() {
  console.log('--- Processing Sennelier Devis (#24001434) ---');
  const sennelierItems = [
    { n: "Huile solide KAMA - Ocre jaune clair", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Ocre rouge", q: 1, u: "15ml" },
    { n: "Fixatif SENNELIER Aérosol (Bombe) - 400 ml", q: 1, u: "400ml" },
    { n: "Gofun JAPONAIS CDQV - Blanc d'huitre - Tube 40 ml", q: 1, u: "40ml" },
    { n: "Encre aquarelle JAPONAISE - Indigo Outremer", q: 1, u: "godet" },
    { n: "Encre aquarelle JAPONAISE - Bleu Nuit", q: 1, u: "godet" },
    { n: "Encre aquarelle JAPONAISE - Blanc d'Huitre", q: 1, u: "godet" },
    { n: "Encre aquarelle JAPONAISE - Ocre jaune", q: 1, u: "godet" },
    { n: "Huile solide KAMA - Blanc de titane", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Noir de Mars", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Jaune de Naples", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Rouge de naphtol", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Violet de quinacridone", q: 1, u: "15ml" },
    { n: "Huile solide KAMA - Ton de chair", q: 1, u: "60ml" }
  ];

  for (const it of sennelierItems) {
    await supabase.from('stock_item').insert({
      name: it.n,
      category: it.n.includes('Huile') ? "Couleur à l'huile" : (it.n.includes('Encre') ? 'Pigment' : 'Autre'),
      quantity: it.q,
      unit: it.u,
      supplier_id: 37, // Sennelier
      notes: "Imported from Devis #24001434"
    });
  }

  await supabase.from('expense').insert({
    date: '2024-10-22',
    libelle: 'Sennelier Devis #24001434',
    category: 'Matériel',
    montant_ht: 100.73,
    tva_rate: 20.0,
    montant_ttc: 130.89,
    notes: 'KAMA oil sticks and Japanese inks'
  });

  console.log('Third PDF processed.');
}

processThirdPdf();
