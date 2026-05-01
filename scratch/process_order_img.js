const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function processOrder() {
  console.log('Processing order #FR000017398...');

  const items = [
    { name: "Williamsburg : Peinture à l'Huile: 37ml :Interference Blue", price: 21.20 },
    { name: "Williamsburg : Peinture à l'Huile: 37ml :Interference Green", price: 21.20 },
    { name: "Williamsburg : Peinture à l'Huile: 37ml :Davy's Grey Deep", price: 8.77 },
    { name: "Williamsburg : Peinture à l'Huile: 37ml :Lamp Black", price: 8.77 }
  ];

  // 1. Add/Update items in stock_item
  for (const it of items) {
    const { data: existing } = await supabase.from('stock_item').select('id, quantity').ilike('name', `%${it.name}%`).single();
    
    if (existing) {
      console.log(`Updating ${it.name} (+1)...`);
      await supabase.from('stock_item').update({ quantity: (existing.quantity || 0) + 1 }).eq('id', existing.id);
    } else {
      console.log(`Creating ${it.name}...`);
      await supabase.from('stock_item').insert({
        name: it.name,
        category: "Couleur à l'huile",
        quantity: 1,
        unit: "u",
        notes: "Fabricant: Williamsburg",
        supplier_id: 5 // Jackson's
      });
    }
  }

  // 2. Log expense
  console.log('Logging expense...');
  const { error: expErr } = await supabase.from('expense').insert({
    date: '2026-04-10',
    libelle: 'Williamsburg Order #FR000017398',
    category: 'Matériel',
    montant_ht: 46.49,
    tva_rate: 21.79,
    montant_ttc: 56.62,
    notes: 'Interference Blue, Interference Green, Davy\'s Grey Deep, Lamp Black'
  });

  if (expErr) console.error('Error logging expense:', expErr.message);
  else console.log('Order processed successfully!');
}

processOrder();
