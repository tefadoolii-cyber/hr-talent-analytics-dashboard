const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const targetPath = 'C:\\Users\\LapTop 13.2\\Downloads\\فرز_فندقه_1_aa_.xlsx';
const wb = xlsx.readFile(targetPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

console.log('Total Raw Rows from Excel:', rawRows.length);

function getCleanVal(row, fieldName) {
  const target = fieldName.replace(/\s+/g, '').toLowerCase();
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = key.replace(/\s+/g, '').toLowerCase();
    if (cleanKey === target) {
      return val;
    }
  }
  return '';
}

function parseMonthsToYears(val) {
  let num = parseFloat(val);
  if (isNaN(num) || num < 0) return 0;
  if (num > 600) return 0; // تنقية القيم الشاذة أو غير المنطقية
  return +(num / 12).toFixed(1);
}

function getMonths(val) {
  let num = parseFloat(val);
  if (isNaN(num) || num < 0 || num > 600) return 0;
  return num;
}

const cleanedList = rawRows.map((row, idx) => {
  const id = getCleanVal(row, 'رقم الهوية') || (1000000000 + idx);
  let gender = String(getCleanVal(row, 'الجنس')).trim() || 'غير محدد';
  if (gender === 'انثى') gender = 'أنثى';

  const degree = String(getCleanVal(row, 'المؤهل الدراسي')).trim() || 'غير محدد';
  const major = String(getCleanVal(row, 'التخصص')).trim() || 'عام';

  const cert1 = String(getCleanVal(row, 'الدورات والشهادات1') || getCleanVal(row, 'الدورات والشهادات')).trim() || '—';
  const cert2 = String(getCleanVal(row, 'الدورات والشهادات2')).trim() || '—';
  const cert3 = String(getCleanVal(row, 'الدورات والشهادات3')).trim() || '—';
  const extraCerts = String(getCleanVal(row, 'هل يوجد شهادات ودورات غير المذكورة ادناه؟')).trim() || 'لا';

  const totalExpMonths = getMonths(getCleanVal(row, 'عدد سنوات الخبرة الاجمالية'));
  const totalExpYears = parseMonthsToYears(getCleanVal(row, 'عدد سنوات الخبرة الاجمالية'));

  const expField1 = String(getCleanVal(row, 'مجال الخبرة 1')).trim() || '—';
  const expMonths1 = getMonths(getCleanVal(row, 'عدد سنوات الخبرة 1'));
  const expYears1 = parseMonthsToYears(getCleanVal(row, 'عدد سنوات الخبرة 1'));

  const expField2 = String(getCleanVal(row, 'مجال الخبرة 2')).trim() || '—';
  const expMonths2 = getMonths(getCleanVal(row, 'عدد سنوات الخبرة 2'));
  const expYears2 = parseMonthsToYears(getCleanVal(row, 'عدد سنوات الخبرة 2'));

  const expField3 = String(getCleanVal(row, 'مجال الخبرة 3')).trim() || '—';
  const expMonths3 = getMonths(getCleanVal(row, 'عدد سنوات الخبرة 3'));
  const expYears3 = parseMonthsToYears(getCleanVal(row, 'عدد سنوات الخبرة 3'));

  let unmentioned = String(getCleanVal(row, 'هل يوجد خبرات غير المذكوره ادناه؟') || getCleanVal(row, 'هل يوجد خبرات لم تذكر')).trim() || 'لا';
  if (unmentioned === '-' || unmentioned === '0') unmentioned = 'لا';

  let jobTitle = String(getCleanVal(row, 'المسمى الوظيفي المقترح')).trim() || 'غير محدد';
  if (jobTitle === '-' || jobTitle === '0') jobTitle = 'غير محدد';

  let license = String(getCleanVal(row, 'الرخص المهنية')).trim() || 'لا يوجد';
  if (license === '-' || license === '0' || license === 'بدون' || license === 'لا') license = 'لا يوجد';

  return {
    id: idx + 1,
    "رقم الهويه": String(id),
    "الجنس": gender,
    "المؤهل الدراسي": degree,
    "التخصص": major,
    "الدورات والشهادات": cert1,
    "الدورات والشهادات 2": cert2,
    "الدورات والشهادات 3": cert3,
    "شهادات إضافية": extraCerts,
    "عدد السنوات الخبره الاجماليه": totalExpYears,
    "عدد شهور الخبرة الاجمالية": totalExpMonths,
    "مجال الخبره": expField1,
    "عدد سنوات الخبره 1": expYears1,
    "شهور الخبره 1": expMonths1,
    "مجال الخبره 2": expField2,
    "عدد سنوات الخبره 2": expYears2,
    "شهور الخبره 2": expMonths2,
    "مجال الخبره 3": expField3,
    "عددسنوات الخبره 3": expYears3,
    "شهور الخبره 3": expMonths3,
    "هل يوجد خبرات لم تذكر": unmentioned,
    "المسمى الوظيفي المقترح": jobTitle,
    "الرخص المهنية": license
  };
});

const content = 'const INITIAL_TALENT_DATA = ' + JSON.stringify(cleanedList, null, 2) + ';\n';
fs.writeFileSync(path.join(__dirname, 'data.js'), content, 'utf8');

console.log('SUCCESS! Updated data.js with', cleanedList.length, 'normalized records.');
