const XLSX = require('xlsx');
const path = require('path');

const file = '2023.materials.xlsx';
const filePath = path.join(__dirname, '..', '..', file);
console.log(`--- Inspecting all sheets of ${file} ---`);

try {
  const workbook = XLSX.readFile(filePath);
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet: ${sheetName} - ${data.length} rows.`);
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample row:', JSON.stringify(data[0], null, 2));
    }
  });
} catch (e) {
  console.error(`Error: ${e.message}`);
}
