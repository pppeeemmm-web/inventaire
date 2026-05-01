const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function processImports() {
  console.log('--- Processing Couleurs Leroux (#28532) ---');
  const lerouxItems = [
    { n: "Jaune de chrome Orange Véritable **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Bleu de Manganèse Nuancé Véritable **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Bleu Charron Véritable **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Bleu de Cobalt Turquoise Marina Véritable **** - Tube 60 ml", q: 1, u: "60ml" },
    { n: "Ocre jaune de Puisaye **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Brun Van Dyck **** - Tube 60 ml", q: 1, u: "60ml" },
    { n: "Terre d'Ombre Brûlée **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Noir d'Ivoire **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Noir de Vigne Véritable **** - Tube 60 ml", q: 1, u: "60ml" },
    { n: "Jaune de Cadmium Citron Véritable **** - Tube 60 ml", q: 1, u: "60ml" },
    { n: "Vermillon de Chine (ton) **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Pâte à peindre et à nuancer Leroux - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Blanc de Lithopone **** - Pot 500 ml", q: 1, u: "500ml" },
    { n: "Laque de Garance Ordinaire **** - Tube 60 ml", q: 1, u: "60ml" },
    { n: "Huile de Lin clarifiée - Haute gamme - 1/4 litre", q: 1, u: "250ml" },
    { n: "Rouge Pozzuoli **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Jaune de chrome Clair Véritable **** - Tube 175 ml", q: 1, u: "175ml" },
    { n: "Jaune de chrome Foncé Véritable **** - Tube 175 ml", q: 1, u: "175ml" }
  ];

  for (const it of lerouxItems) {
    await supabase.from('stock_item').insert({
      name: it.n,
      category: it.n.includes('Huile') || it.n.includes('Litre') ? 'Solvent' : (it.n.includes('Pâte') ? 'Medium à peindre' : 'Pigment'),
      quantity: it.q,
      unit: it.u,
      supplier_id: 3,
      notes: "Imported from Order #28532"
    });
  }

  await supabase.from('expense').insert({
    date: '2024-07-10',
    libelle: 'Couleurs Leroux Order #28532',
    category: 'Matériel',
    montant_ht: 369.05, // Approximation 442.86 / 1.2
    tva_rate: 20.0,
    montant_ttc: 442.86,
    notes: 'Bulk pigment/paint order'
  });

  console.log('--- Processing Kremer Pigmente (#R24011079) ---');
  const kremerItems = [
    { n: "Bone Black exclusive", q: 1, u: "100g" },
    { n: "Spinel Black deepest black", q: 1, u: "50g" },
    { n: "Nero Bernino gray-green slate", q: 1, u: "50g" },
    { n: "Epidote yellow-green earth", q: 1, u: "50g" },
    { n: "French Ochre, very light yellow", q: 1, u: "100g" },
    { n: "Japanese Paper Wenzhou, roll", q: 1, u: "roll" },
    { n: "Alizarine Crimson Light bright red", q: 1, u: "20g" },
    { n: "Temperone Venetian painting medium", q: 1, u: "100ml" },
    { n: "Natural White Earth Vicenza", q: 1, u: "1kg" },
    { n: "Zenexo Golden White", q: 1, u: "10g" },
    { n: "Kremer Tempera medium", q: 1, u: "100ml" },
    { n: "Chalk from Champagne", q: 1, u: "1kg" },
    { n: "Stone Chalk, white", q: 1, u: "1kg" },
    { n: "Dolomite, pure white", q: 1, u: "1kg" },
    { n: "Carborundum F 120", q: 1, u: "100g" },
    { n: "Tripoli, Rotten Stone", q: 1, u: "100g" },
    { n: "Scouring Rush, shredded", q: 1, u: "100g" },
    { n: "Natural red earth Germany", q: 1, u: "100g" },
    { n: "Bismuth-Vanadate Yellow", q: 1, u: "100g" },
    { n: "Iron Oxide Black", q: 1, u: "1kg" }
  ];

  for (const it of kremerItems) {
    await supabase.from('stock_item').insert({
      name: `Kremer - ${it.n}`,
      category: it.n.includes('Paper') ? 'Papier' : (it.n.includes('medium') || it.n.includes('Temperone') ? 'Medium à peindre' : 'Pigment'),
      quantity: it.q,
      unit: it.u,
      supplier_id: 9,
      notes: "Imported from Invoice #R24011079"
    });
  }

  await supabase.from('expense').insert({
    date: '2024-01-15',
    libelle: 'Kremer Pigmente Invoice #R24011079',
    category: 'Matériel',
    montant_ht: 176.00,
    tva_rate: 23.0,
    montant_ttc: 216.48,
    notes: 'Bulk pigments and paper'
  });

  console.log('Import finished.');
}

processImports();
