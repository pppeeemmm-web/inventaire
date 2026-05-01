const XLSX = require('xlsx');
const path = require('path');

const files = ['2023.materials.xlsx', 'Fournitures.xlsx'];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', '..', file);
  console.log(`--- Reading ${file} ---`);
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} rows.`);
    if (data.length > 0) {
      console.log('Sample row:', JSON.stringify(data[0], null, 2));
      console.log('Columns:', Object.keys(data[0] || {}));
    }
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
  }
  console.log('\n');
});
