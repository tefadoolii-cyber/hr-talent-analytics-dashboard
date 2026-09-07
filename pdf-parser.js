// محرك قراءة واستخراج البيانات الذكي من ملفات PDF (السير الذاتية والتقارير)
// متوافق مع نظام Mozilla PDF.js

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * قراءة كامل نصوص ملف الـ PDF من كافة الصفحات
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

/**
 * تحليل النصوص واستخراج الحقول المطابقة لمعطيات الداشبورد
 */
function parseCandidateFromText(rawText, fileName = '') {
  const text = rawText.replace(/[\r\t]+/g, ' ').replace(/\s{2,}/g, ' ');

  // 1. استخراج رقم الهوية (رقم وطني أو إقامة 10 أرقام يبدأ بـ 1 أو 2)
  let nationalId = '';
  const idMatch = text.match(/(?:الهوية|السجل\s*المدني|الاقامة|الإقامة|ID|Iqama|National\s*ID)[:\s]*([12]\d{9})/i) 
               || text.match(/\b([12]\d{9})\b/);
  if (idMatch) {
    nationalId = idMatch[1];
  } else {
    // في حال عدم وجود رقم هوية رسمي، يتم توليد رقم مؤقت أو البحث عن أي رقم 10 خانات
    const anyTenDigits = text.match(/\b(\d{10})\b/);
    nationalId = anyTenDigits ? anyTenDigits[1] : `10${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  // 2. استخراج الجنس
  let gender = 'ذكر';
  if (/(?:أنثى|انثى|سيدة|آنسة|Female|Woman)/i.test(text)) {
    gender = 'أنثى';
  } else if (/(?:ذكر|رجل|Male|Man)/i.test(text)) {
    gender = 'ذكر';
  }

  // 3. استخراج المؤهل الدراسي
  let degree = 'بكالوريوس';
  if (/(?:دكتوراه|دكتوراة|PhD|Doctorate)/i.test(text)) {
    degree = 'دكتوراه';
  } else if (/(?:ماجستير|Master)/i.test(text)) {
    degree = 'ماجستير';
  } else if (/(?:دبلوم\s*عالي|Higher\s*Diploma)/i.test(text)) {
    degree = 'دبلوم عالي';
  } else if (/(?:بكالوريوس|Bachelor|ليسانس)/i.test(text)) {
    degree = 'بكالوريوس';
  } else if (/(?:دبلوم|Diploma|معهد)/i.test(text)) {
    degree = 'دبلوم';
  } else if (/(?:ثانوية|ثانوي|High\s*School)/i.test(text)) {
    degree = 'ثانوية عامة';
  }

  // 4. استخراج التخصص الأكاديمي
  let major = 'إدارة أعمال';
  const majorPatterns = [
    { regex: /إدارة\s*(?:أعمال|فندقية|عامة|مستشفيات)/i, val: 'إدارة أعمال' },
    { regex: /موارد\s*بشرية/i, val: 'إدارة موارد بشرية' },
    { regex: /(?:فندقة|ضيافة|سياحة|إرشاد\s*سياحي)/i, val: 'سياحة وفندقة' },
    { regex: /(?:علوم\s*حاسب|هندسة\s*برمجيات|تقنية\s*معلومات|أمن\s*سيبراني|نظم\s*معلومات)/i, val: 'علوم حاسب ونظم معلومات' },
    { regex: /(?:محاسبة|مالية|تمويل|بنوك)/i, val: 'محاسبة ومالية' },
    { regex: /(?:تسويق|إعلام|اتصال\s*مؤسسي|علاقات\s*عامة)/i, val: 'تسويق وإعلام' },
    { regex: /(?:قانون|حقوق|أنظمة|محاماة)/i, val: 'قانون وأنظمة' },
    { regex: /(?:لغة\s*إنجليزية|ترجمة|English)/i, val: 'لغة إنجليزية وترجمة' },
    { regex: /هندسة\s*(?:مدنية|ميكانيكية|كهربائية|صناعية)/i, val: 'هندسة' },
    { regex: /(?:علم\s*نفس|خدمة\s*اجتماعية|علوم\s*اجتماعية)/i, val: 'علم نفس وخدمة اجتماعية' }
  ];
  for (const item of majorPatterns) {
    if (item.regex.test(text)) {
      major = item.val;
      break;
    }
  }

  // 5. استخراج الدورات والشهادات (حتى 3 دورات)
  const coursesFound = [];
  const knownCerts = [
    'PMP إدارة مشاريع',
    'إدارة الموارد البشرية',
    'خدمة العملاء والتميز في الخدمة',
    'الأمن السيبراني',
    'اللغة الإنجليزية التخصصية',
    'الحاسب الآلي وتطبيقات المكاتب ICDL',
    'إدارة الفنادق والضيافة',
    'تدريب المدربين TOT',
    'إدخال البيانات ومعالجة النصوص',
    'المحاسبة المالية وضريبة القيمة المضافة',
    'إدارة الفعاليات والمؤتمرات',
    'السلامة والصحة المهنية OSHA',
    'التسويق الرقمي وإدارة الحملات',
    'تحليل البيانات Power BI / Excel',
    'السكرتارية التنفيذية وإدارة المكاتب'
  ];

  for (const cert of knownCerts) {
    const keyword = cert.split(' ')[0];
    if (text.includes(keyword) || text.includes(cert)) {
      coursesFound.push(cert);
      if (coursesFound.length >= 3) break;
    }
  }

  // البحث عن أسطر تحتوي على دورة أو شهادة
  if (coursesFound.length < 3) {
    const courseLineMatches = text.match(/(?:دورة|شهادة|برنامج|دبلوم تدريبي)\s*[:\-]?\s*([^\n,،.]{4,40})/gi) || [];
    courseLineMatches.forEach(match => {
      const clean = match.trim();
      if (!coursesFound.includes(clean) && coursesFound.length < 3) {
        coursesFound.push(clean);
      }
    });
  }

  const cert1 = coursesFound[0] || 'دورة المهارات المهنية وتطوير الذات';
  const cert2 = coursesFound[1] || 'دورة خدمة العملاء والتواصل الفعال';
  const cert3 = coursesFound[2] || 'أساسيات الحاسب الآلي وتطبيقات المكاتب';
  const extraCerts = coursesFound.length >= 3 || /(?:دورات\s*أخرى|شهادات\s*إضافية)/i.test(text) ? 'نعم' : 'لا';

  // 6. استخراج سنوات ومجالات الخبرة (الافتراضي 0 عند عدم وجود خبرات مسجلة)
  let totalExpYears = 0;
  
  // التحقق أولاً من وجود دلالات عدم وجود خبرة أو حديث تخرج
  const noExpMatch = /(?:بدون\s*خبرة|لا\s*توجد\s*خبرة|لا\s*يوجد\s*خبرات|لا\s*يوجد\s*خبرة\s*سابقة|حديث\s*تخرج|حديثة\s*تخرج|لا\s*يوجد|لايوجد|صفر|0\s*سنة|0\s*سنوات|0\s*شهر|Fresh\s*Graduate|No\s*Experience)/i.test(text);

  if (!noExpMatch) {
    // البحث الدقيق عن سنوات الخبرة المكتوبة صراحة
    const expMatch = text.match(/(?:خبرة|الخبرة|الخبرات|سنوات\s*الخبرة)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:سنوات|سنة|عام|أعوام|years|months|شهر)?/i)
                  || text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:سنوات\s*خبرة|سنوات\s*من\s*الخبرة|سنوات\s*في\s*مجال|سنة\s*خبرة)/i);
    if (expMatch) {
      let rawVal = parseFloat(expMatch[1]);
      if (/شهر|months/i.test(expMatch[0]) && rawVal > 0) {
        rawVal = +(rawVal / 12).toFixed(1);
      }
      if (!isNaN(rawVal) && rawVal > 0 && rawVal <= 45) {
        totalExpYears = rawVal;
      }
    }
  }

  // استخراج مجالات الخبرة
  const expFieldsFound = [];
  const fieldPatterns = [
    { regex: /(?:إدارة\s*المكاتب|سكرتارية|أعمال\s*مكتبية)/i, val: 'إدارة المكاتب والأعمال الإدارية' },
    { regex: /(?:خدمة\s*العملاء|استقبال|كول\s*سنتر)/i, val: 'خدمة العملاء والاستقبال' },
    { regex: /(?:فندقة|ضيافة|حجوزات|إسكان|إشراف\s*داخلي)/i, val: 'الضيافة والتشغيل الفندقي' },
    { regex: /(?:موارد\s*بشرية|توظيف|شؤون\s*الموظفين)/i, val: 'الموارد البشرية وشؤون الموظفين' },
    { regex: /(?:مبيعات|تسويق|علاقات\s*عامة)/i, val: 'المبيعات وتطوير الأعمال' },
    { regex: /(?:محاسبة|مالية|أمين\s*صندوق|تدقيق)/i, val: 'العمليات المالية والمحاسبية' },
    { regex: /(?:دعم\s*فني|صيانة\s*حاسب|شبكات)/i, val: 'الدعم الفني وتقنية المعلومات' }
  ];

  for (const item of fieldPatterns) {
    if (item.regex.test(text)) {
      expFieldsFound.push(item.val);
      if (expFieldsFound.length >= 3) break;
    }
  }

  // عند عدم وجود خبرات يوضع 0 صراحة
  let field1 = 'لا يوجد خبرات مسجلة (بدون خبرة)';
  let years1 = 0;
  let field2 = '—';
  let years2 = 0;
  let field3 = '—';
  let years3 = 0;

  if (totalExpYears > 0) {
    field1 = expFieldsFound[0] || 'العمليات الإدارية وخدمة العملاء';
    years1 = +(totalExpYears * 0.6).toFixed(1);
    if (years1 <= 0) years1 = totalExpYears;

    if (expFieldsFound.length > 1) {
      field2 = expFieldsFound[1];
      years2 = +(totalExpYears - years1).toFixed(1);
    }
    if (expFieldsFound.length > 2) {
      field3 = expFieldsFound[2];
    }
  }

  // 7. استخراج الرخص المهنية
  let license = 'لا يوجد';
  if (/(?:هيئة\s*المهندسين|اعتماد\s*مهني\s*هندسي)/i.test(text)) {
    license = 'شهادة الاعتماد المهني - هيئة المهندسين';
  } else if (/(?:هيئة\s*التخصصات\s*الصحية|تصنيف\s*صحي)/i.test(text)) {
    license = 'تصنيف الهيئة السعودية للتخصصات الصحية';
  } else if (/(?:SOCPA|محاسبين\s*ومراجعين)/i.test(text)) {
    license = 'زمالة الهيئة السعودية للمحاسبين (SOCPA)';
  } else if (/(?:رخصة\s*محاماة|وزارة\s*العدل)/i.test(text)) {
    license = 'رخصة ممارسة المحاماة - وزارة العدل';
  } else if (/(?:رخصة\s*قيادة\s*عمومي|نقل\s*ثقيل)/i.test(text)) {
    license = 'رخصة قيادة عمومي / نقل ثقيل';
  } else if (/(?:رخصة\s*قيادة|قيادة\s*مركبة|Driving\s*License)/i.test(text)) {
    license = 'رخصة قيادة خاصة سارية';
  }

  // 8. استخراج المسمى الوظيفي المقترح
  let jobTitle = 'مشرف عمليات وخدمات فندقية';
  const titlePatterns = [
    { regex: /(?:موارد\s*بشرية|أخصائي\s*توظيف)/i, val: 'أخصائي موارد بشرية' },
    { regex: /(?:إشراف\s*فندقي|مدير\s*فندق|مشرف\s*استقبال)/i, val: 'مشرف عمليات وخدمات فندقية' },
    { regex: /(?:خدمة\s*عملاء|علاقات\s*عملاء|ممثل\s*خدمة)/i, val: 'أخصائي خدمة عملاء وتجربة الضيف' },
    { regex: /(?:مدير\s*مكتب|مساعد\s*إداري|سكرتير)/i, val: 'مساعد إداري أول' },
    { regex: /(?:محاسب|أخصائي\s*مالي)/i, val: 'محاسب مالي' },
    { regex: /(?:أخصائي\s*تسويق|مسوق\s*رقمي)/i, val: 'أخصائي تسويق وتواصل' },
    { regex: /(?:دعم\s*فني|مسؤول\s*شبكات|تقني)/i, val: 'فني دعم تقني ونظم' }
  ];
  for (const item of titlePatterns) {
    if (item.regex.test(text)) {
      jobTitle = item.val;
      break;
    }
  }

  // 9. هل يوجد خبرات لم تذكر
  let unmentioned = 'لا';
  if (/(?:أعمال\s*حرة|تطوع|استشارات|خبرات\s*أخرى|عمل\s*حر)/i.test(text)) {
    unmentioned = 'نعم (أعمال حرة ومشاريع تطوعية)';
  }

  return {
    "رقم الهويه": nationalId,
    "الجنس": gender,
    "المؤهل الدراسي": degree,
    "التخصص": major,
    "الدورات والشهادات": cert1,
    "الدورات والشهادات 2": cert2,
    "الدورات والشهادات 3": cert3,
    "شهادات إضافية": extraCerts,
    "عدد السنوات الخبره الاجماليه": totalExpYears,
    "عدد شهور الخبرة الاجمالية": Math.round(totalExpYears * 12),
    "مجال الخبره": field1,
    "عدد سنوات الخبره 1": years1,
    "شهور الخبره 1": Math.round(years1 * 12),
    "مجال الخبره 2": field2,
    "عدد سنوات الخبره 2": years2,
    "شهور الخبره 2": Math.round(years2 * 12),
    "مجال الخبره 3": field3,
    "عددسنوات الخبره 3": years3,
    "شهور الخبره 3": Math.round(years3 * 12),
    "هل يوجد خبرات لم تذكر": unmentioned,
    "المسمى الوظيفي المقترح": jobTitle,
    "الرخص المهنية": license,
    _sourceFileName: fileName
  };
}

window.extractTextFromPdf = extractTextFromPdf;
window.parseCandidateFromText = parseCandidateFromText;
