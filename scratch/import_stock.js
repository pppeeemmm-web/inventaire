const XLSX = require('xlsx');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mcrzsxrcoexnlwmaunte.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcnpzeHJjb2V4bmx3bWF1bnRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE5Mzc0MSwiZXhwIjoyMDkxNzY5NzQxfQ.1tESf_7SS-fLtC0nt9drhmDMDlB7NPGrxPVGEUSE2U4');

async function importStock() {
  const filePath = path.join(__dirname, '..', '..', 'Fournitures.xlsx');
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  // Fetch contacts to build a map
  const { data: contacts } = await supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom');
  const contactMap = {};
  contacts.forEach(c => {
    const key = (c.NomInstitution || `${c.Prénom || ''} ${c.Nom || ''}`.trim()).toLowerCase();
    contactMap[key] = c.ContactID;
  });

  console.log(`Importing ${data.length} items...`);

  const inserts = data.map(row => {
    const supplierKey = (row.Fournisseur || '').toLowerCase().trim();
    const supplierId = contactMap[supplierKey] || null;

    let notes = row.Notes || '';
    if (row.Fabricant) {
      notes = `Fabricant: ${row.Fabricant}${notes ? ' | ' + notes : ''}`;
    }

    return {
      name:        row.Nom,
      category:    row.TypeFourniture || null,
      quantity:    Number(row.Quantité || 0),
      unit:        row.Mesure || 'units',
      min_stock:   0,
      supplier_id: supplierId,
      notes:       notes || null,
      cost_unit:   null
    };
  });

  // Batch insert
  const { error } = await supabase.from('stock_item').insert(inserts);
  if (error) {
    console.error('Error importing:', error.message);
  } else {
    console.log('Import successful!');
  }
}

importStock();
