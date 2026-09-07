const xlsx = require('xlsx');
const fs = require('fs');

const targetPath = 'C:\\Users\\LapTop 13.2\\Downloads\\فرز_فندقه_1_aa_.xlsx';

try {
  if (!fs.existsSync(targetPath)) {
    console.error('File does not exist:', targetPath);
    process.exit(1);
  }

  const wb = xlsx.readFile(targetPath);
  console.log('Sheet Names:', wb.SheetNames);
  
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  console.log('Total Rows:', data.length);
  
  if (data.length > 0) {
    console.log('Headers in first row:');
    console.log(JSON.stringify(Object.keys(data[0]), null, 2));
    console.log('\nFirst 3 records:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  }
} catch (err) {
  console.error('Error reading file:', err);
}
