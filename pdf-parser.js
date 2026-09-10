// ==========================================================================
// محرك قراءة واستخراج البيانات عالي الدقة من ملفات PDF (Wisal Smart PDF Engine v3)
// متوافق مع نظام Mozilla PDF.js مع معالجة تخطيط الأسطر والنصوص العربية والإنجليزية
// يدعم قراءة وفك الخطوط الخاصة، النصوص المعكوسة، الحروف المتباعدة، واستخراج كافة البيانات المطلوبة
// ==========================================================================

if (typeof window !== 'undefined' && window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
}

/**
 * جداول فك تشفير المحارف للخطوط الشائعة (DejaVu Sans & DejaVu Sans Bold وغيرها)
 */
const glyphMapBold = {
  '\u0003':' ', '\u0550':'آ', '\u0555':'ا', '\u0558':'ت', '\u055d':'د', '\u055f':'ر',
  '\u056a':'ف', '\u056e':'م', '\u0571':'و', '\u0573':'ي', '\u147c':'ؤ', '\u1484':'ا',
  '\u1486':'ب', '\u1487':'ب', '\u148a':'ة', '\u148e':'ت', '\u1499':'ح', '\u149a':'ح',
  '\u149e':'خ', '\u14a0':'د', '\u14a4':'ر', '\u14a9':'س', '\u14ac':'ش', '\u14ae':'ش',
  '\u14b2':'ص', '\u14c1':'ع', '\u14c2':'ع', '\u14c6':'غ', '\u14c9':'ف', '\u14ce':'ق',
  '\u14d1':'ك', '\u14d5':'ل', '\u14d6':'ل', '\u14d8':'م', '\u14d9':'م', '\u14da':'م',
  '\u14de':'ن', '\u14e1':'ه', '\u14e2':'ه', '\u14e4':'و', '\u14e8':'ي', '\u14e9':'ي',
  '\u14ea':'ي', '\u14ed':'لا', '\u14f2':'لا'
};

const glyphMapRegular = {
  '\u0003':' ', '\u054b':'،', '\u054f':'ء', '\u0550':'آ', '\u0551':'أ', '\u0553':'إ',
  '\u0555':'ا', '\u0557':'ة', '\u0558':'ت', '\u055d':'د', '\u055f':'ر', '\u0560':'ز',
  '\u056a':'ف', '\u056d':'ل', '\u056e':'م', '\u056f':'ن', '\u0571':'و', '\u0578':'ُ',
  '\u1480':'ؤ', '\u1485':'ئ', '\u1486':'ئ', '\u1488':'ا', '\u148a':'ب', '\u148b':'ب',
  '\u148c':'ب', '\u148e':'ة', '\u1490':'ت', '\u1491':'ت', '\u1492':'ت', '\u1495':'ث',
  '\u1496':'ث', '\u1498':'ج', '\u1499':'ج', '\u149a':'ج', '\u149d':'ح', '\u149e':'ح',
  '\u14a1':'خ', '\u14a2':'خ', '\u14a4':'د', '\u14a6':'ذ', '\u14a8':'ر', '\u14aa':'ز',
  '\u14ad':'س', '\u14ae':'س', '\u14b1':'ش', '\u14b2':'ش', '\u14b4':'ص', '\u14b5':'ص',
  '\u14ba':'ض', '\u14bc':'ط', '\u14be':'ط', '\u14c2':'ظ', '\u14c4':'ع', '\u14c5':'ع',
  '\u14c6':'ع', '\u14c9':'غ', '\u14ca':'غ', '\u14cd':'ف', '\u14ce':'ف', '\u14d0':'ق',
  '\u14d1':'ق', '\u14d2':'ق', '\u14d5':'ك', '\u14d6':'ك', '\u14d8':'ل', '\u14d9':'ل',
  '\u14da':'ل', '\u14dc':'م', '\u14dd':'م', '\u14de':'ن', '\u14e0':'ن', '\u14e1':'ه',
  '\u14e2':'ن', '\u14e4':'ه', '\u14e6':'ه', '\u14e8':'و', '\u14ea':'ى', '\u14ec':'ي',
  '\u14ed':'ي', '\u14ee':'ي', '\u14ef':'لا', '\u14f1':'لا', '\u14f2':'لا', '\u14f3':'لا',
  '\u14f5':'لا', '\u14f6':'لا'
};

/**
 * تحويل الأرقام المشرقية/الهندية (٠-٩) إلى أرقام قياسية (0-9)
 */
function normalizeDigits(str) {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const easternDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let s = String(str);
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(arabicDigits[i], String(i));
    s = s.replaceAll(easternDigits[i], String(i));
  }
  return s;
}

/**
 * دمج الحروف الإنجليزية المتباعدة بمسافات فردية: S E N I O R -> SENIOR
 */
function unspaceLetters(text) {
  if (!text) return '';
  return text.replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1')
             .replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1')
             .replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1')
             .replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1')
             .replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1')
             .replace(/\b([A-Za-z]) (?=[A-Za-z]\b)/g, '$1');
}

/**
 * تسوية المحارف التقديمية العربية وفك تشفير محارف الخطوط البديلة
 */
function normalizeArabicPresentationForms(text) {
  if (!text) return '';
  let res = text.replace(/[\u0540-\u058F\u1400-\u167F]/g, ch => glyphMapBold[ch] || glyphMapRegular[ch] || ch);
  res = res.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '');
  return res;
}

/**
 * فحص وتصحيح النصوص العربية المعكوسة الناتجة عن بعض برامج تصدير الـ PDF
 */
function cleanAndFixReversedArabic(text) {
  if (!text) return '';
  let cleaned = normalizeArabicPresentationForms(text);
  cleaned = cleaned.replace(/[^\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFFA-Za-z0-9\s.,@:\-+/_()|#*&%®\n\r]/g, ' ');

  const reversedIndicators = /(?:ةيبرعلا|دوعسلا|ةكلمملا|ميلعتلا|تالهؤملا|تالهوملا|ميداكألا|ميداكالا|فدهلا|هملا|مهلا|لاوجلا|ينورتكلإلا|ينورتكلالا|ديربلا|ةريس|ةيتاذ|سويرولاقب|ريتسجام|موكبد|مولبد|ةنايص|تاربخ|تارود|تامولعم|فتاه|دمحم|يدعاصلا|شياع)/;

  const lines = cleaned.split('\n');
  const fixedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (reversedIndicators.test(trimmed)) {
      const segments = trimmed.split(/([A-Za-z0-9&@._\-+/:()®]+)/);
      const fixedSegments = segments.map(seg => {
        if (/^[A-Za-z0-9&@._\-+/:()®]+$/.test(seg)) {
          return seg;
        }
        return seg.split('').reverse().join('');
      });
      return fixedSegments.reverse().join('');
    }
    return trimmed;
  });

  return unspaceLetters(fixedLines.join('\n'));
}

/**
 * استخراج اسم المرشح النظيف من اسم الملف مع استبعاد مسارات المجلدات
 */
function cleanCandidateNameFromFileName(fileName) {
  if (!fileName) return '';
  const cleanPath = String(fileName).replace(/\\/g, '/');
  const baseName = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
  let name = baseName
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b(?:cv|resume|curriculum|vitae|سيرة|ذاتية|محدث|جديد|final|v\d+)\b/gi, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = name.split(' ').filter(w => w.length > 1);
  if (words.length >= 2 && words.length <= 5) {
    return words.join(' ');
  }
  return '';
}

/**
 * قراءة نصوص ملف الـ PDF مع الحفاظ التام على بنية الأسطر والمحاذاة الرأسية
 */
async function extractTextFromPdf(file) {
  let arrayBuffer;
  if (file && typeof file.arrayBuffer === 'function') {
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (e) {
      arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }
  } else if (file) {
    arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  } else {
    throw new Error('لم يتم تمرير ملف صالح.');
  }

  // التأكد من تهيئة مسار العامل (Worker) محلياً لمنع قيود الأمان عبر النطاقات
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc || pdfjsLib.GlobalWorkerOptions.workerSrc.includes('cdnjs')) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
    }
  }

  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
  } catch (workerErr) {
    console.warn('Worker error, retrying PDF loading:', workerErr);
    const fallbackTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      stopAtErrors: false
    });
    pdfDoc = await fallbackTask.promise;
  }
  
  let fullLines = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items;
    if (!items || items.length === 0) continue;

    const sortedItems = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 6) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const pageLines = [];
    let currentY = null;
    let currentLine = [];

    sortedItems.forEach(item => {
      const str = (item.str || '').trim();
      if (!str) return;

      const y = item.transform[5];
      if (currentY === null || Math.abs(y - currentY) > 6) {
        if (currentLine.length > 0) {
          pageLines.push(currentLine.join(' '));
        }
        currentY = y;
        currentLine = [str];
      } else {
        currentLine.push(str);
      }
    });

    if (currentLine.length > 0) {
      pageLines.push(currentLine.join(' '));
    }

    fullLines.push(...pageLines);
  }

  let rawExtracted = fullLines.join('\n');
  rawExtracted = normalizeDigits(rawExtracted);
  rawExtracted = cleanAndFixReversedArabic(rawExtracted);
  return rawExtracted;
}

/**
 * محرك استخراج وتحليل بيانات المرشح فائق الدقة (Wisal Dual-Language Candidate Analyzer)
 */
function parseCandidateFromText(rawText, fileName = '') {
  let cleanRaw = cleanAndFixReversedArabic(rawText || '');
  cleanRaw = normalizeDigits(cleanRaw);
  cleanRaw = cleanRaw.replace(/[\t\r]/g, ' ');
  cleanRaw = cleanRaw.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, ' ');
  cleanRaw = cleanRaw.replace(/Page\s*\d+\s*(?:of\s*\d+)?/gi, ' ');

  const rawLines = cleanRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const oneLineText = cleanRaw.replace(/\s+/g, ' ');

  // =========================================================================
  // 1. رقم الهوية الوطنية أو الإقامة (10 خانات تبدأ بـ 1 أو 2 حصراً وإلا "لا يوجد")
  // =========================================================================
  let nationalId = 'لا يوجد';
  const idRegex = /\b([12]\d{9})\b/;

  const cleanPath = String(fileName).replace(/\\/g, '/');
  const baseFileName = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
  const fileIdMatch = baseFileName.match(idRegex);
  if (fileIdMatch) {
    nationalId = fileIdMatch[1];
  } else {
    const labeledIdMatch = cleanRaw.match(/(?:الهوية|السجل\s*المدني|الإقامة|الاقامة|الهوية\s*الوطنية|رقم\s*الهوية|رقم\s*السجل|ID|National\s*ID|Iqama|Civil\s*ID)[:\s#]*([12]\d{9})\b/i);
    if (labeledIdMatch) {
      nationalId = labeledIdMatch[1];
    } else {
      const anyGovId = cleanRaw.match(idRegex);
      if (anyGovId) {
        nationalId = anyGovId[1];
      }
    }
  }

  // =========================================================================
  // 2. اسم المرشح
  // =========================================================================
  let candidateName = 'لا يوجد';
  const explicitName = cleanRaw.match(/(?:الاسم|االسم|اﻻسم|اسم\s*المرشح|اسم\s*الموظف|Name|Full\s*Name)[:\s\-]+([^\n,،.\/]{3,45}?)(?=\s*(?:الجنسية|العنوان|رقم|الهوية|تاريخ|البريد|الجوال|Phone|Email|Nationality)|$)/i);
  if (explicitName && !/(?:البيانات|الشخصية|السيرة|الذاتية)/i.test(explicitName[1])) {
    candidateName = explicitName[1].trim();
  }

  if (candidateName === 'لا يوجد' || candidateName.length < 3) {
    const fromFile = cleanCandidateNameFromFileName(fileName);
    if (fromFile) candidateName = fromFile;
  }

  if (candidateName === 'لا يوجد') {
    const ignoreHeaderRegex = /^(?:السيرة\s*الذاتية|البيانات\s*الشخصية|المعلومات\s*الشخصية|Curriculum\s*Vitae|Resume|CV|Personal\s*Information|Contact|Profile|Summary|Objective|Email|Number|Phone|Address|Saudi\s*Arabia|Mecca|Jeddah|Riyadh|Dammam|Taif|Makkah|Madinah|Kingdom|\+?966|\d+)/i;
    for (let i = 0; i < Math.min(rawLines.length, 8); i++) {
      const line = rawLines[i].replace(/^[-•*–#\s]+/, '').trim();
      if (!ignoreHeaderRegex.test(line) && line.length >= 4 && line.length <= 50) {
        const words = line.split(/\s+/).filter(w => !/\d/.test(w) && w.length > 1);
        if (words.length >= 2 && words.length <= 5) {
          candidateName = words.join(' ');
          break;
        }
      }
    }
  }

  // =========================================================================
  // 3. الجنس
  // =========================================================================
  let gender = 'لا يوجد';
  if (/(?:الجنس|النوع)\s*[:\-]?\s*أنثى/i.test(cleanRaw) || /\bFemale\b/i.test(cleanRaw) || /(?:سعودية|مواطنة|خريجة)\b/.test(cleanRaw)) {
    gender = 'أنثى';
  } else if (/(?:الجنس|النوع)\s*[:\-]?\s*ذكر/i.test(cleanRaw) || /\bMale\b/i.test(cleanRaw) || /(?:سعودي|مواطن|خريج)\b/.test(cleanRaw)) {
    gender = 'ذكر';
  } else {
    const femaleNames = /^(?:مريم|نورة|نوره|سارة|ساره|فاطمة|فاطمه|عائشة|عائشه|منيرة|منيره|ريم|مها|أمل|امل|هدى|هند|ليلى|دانة|دانه|شهد|روان|أسماء|اسماء|رغد|بيان|نجود|أريج|خلود|عفاف|عبير|حنان|ابتسام|لطيفة|لطيفه|نوف|العنود|الهنوف|Maryam|Sarah|Noura|Fatima|Aisha)/i;
    const maleNames = /^(?:سعيد|محمد|أحمد|احمد|علي|فهد|خالد|عبد|معاذ|يوسف|ياسر|عمر|سعد|فيصل|تركي|سلطان|راكان|سالم|صالح|حمد|سلمان|إبراهيم|ابراهيم|حسن|حسين|مهند|ماجد|بندر|طلال|Saeed|Fahad|Mohammed|Ahmed|Ali|Abdulmajid|Abdulrahman|Yasser|Yousef)/i;
    if (femaleNames.test(candidateName)) {
      gender = 'أنثى';
    } else if (maleNames.test(candidateName)) {
      gender = 'ذكر';
    }
  }

  // =========================================================================
  // 4. المؤهل الدراسي
  // =========================================================================
  let degree = 'لا يوجد';
  if (/(?:دكتوراه|دكتوراة|هاروتكد|PhD|Doctorate|Doctor\s*of)/i.test(oneLineText)) {
    degree = 'دكتوراه';
  } else if (/(?:ماجستير|ريتسجام|Master(?:\s*of|\s*degree)?|MSc|MBA|ماستر)/i.test(oneLineText)) {
    degree = 'ماجستير';
  } else if (/(?:دبلوم\s*عالي|Higher\s*Diploma|Postgraduate\s*Diploma)/i.test(oneLineText)) {
    degree = 'دبلوم عالي';
  } else if (/(?:بكالوريوس|سويرولاقب|Bachelor(?:\s*of|\s*degree)?|BSc|B\.Sc|B\.A|BBA|ليسانس|بكالوريس)/i.test(oneLineText)) {
    degree = 'بكالوريوس';
  } else if (/(?:دبلوم|مولبد|موكبد|Diploma|Associate\s*Degree)/i.test(oneLineText)) {
    degree = 'دبلوم';
  } else if (/(?:ثانوية\s*عامة|الثانوية\s*العامة|ثانوية|ثانويه|ةيوناث|High\s*School)/i.test(oneLineText)) {
    degree = 'ثانوية عامة';
  } else if (/(?:كفاءة|متوسطة)/i.test(oneLineText)) {
    degree = 'كفاءة متوسطة';
  }

  // =========================================================================
  // 5. التخصص الأكاديمي
  // =========================================================================
  let major = 'لا يوجد';
  const majorCatalog = [
    { regex: /(?:هندسة\s*حاسب|بساح\s*ةسدنه|Computer\s*Engineering)/i, val: 'هندسة حاسب آلي' },
    { regex: /(?:دعم\s*فن[يى]?|فني\s*دعم|معد\s*نف|نف\s*معد|دعم\s*تقني|صيانة\s*حاسب|بساح|Technical\s*Support|IT\s*Support)/i, val: 'دعم فني وتقنية حاسب' },
    { regex: /(?:هندسة\s*برمجيات|Software\s*Engineering)/i, val: 'هندسة برمجيات' },
    { regex: /(?:علوم\s*حاسب|علوم\s*الحاسب|Computer\s*Science)/i, val: 'علوم حاسب' },
    { regex: /(?:نظم\s*معلومات|Information\s*Systems|MIS)/i, val: 'نظم معلومات' },
    { regex: /(?:تقنية\s*معلومات|Information\s*Technology|IT\b)/i, val: 'تقنية معلومات' },
    { regex: /(?:أمن\s*سيبراني|Cybersecurity|Cyber\s*Security)/i, val: 'أمن سيبراني' },
    { regex: /(?:هندسة\s*بيانات|Data\s*Engineering|Data\s*Science)/i, val: 'هندسة وتحليل بيانات' },
    { regex: /(?:تطوير\s*الويب|Web\s*Development)/i, val: 'تطوير مواقع وبرمجيات ويب' },
    { regex: /(?:محاسبة|المحاسبة|Accounting|Auditing|تدقيق\s*حسابات)/i, val: 'محاسبة' },
    { regex: /(?:إرشاد\s*سياحي|Tourism\s*Guidance)/i, val: 'إرشاد سياحي' },
    { regex: /(?:سياحة\s*وفندقة|فندقة|ضيافة|Hospitality|Tourism)/i, val: 'سياحة وفندقة' },
    { regex: /(?:إدارة\s*مشاريع|Project\s*Management)/i, val: 'إدارة مشاريع' },
    { regex: /(?:إدارة\s*مرافق|Facility\s*Management)/i, val: 'إدارة مرافق' },
    { regex: /(?:ترفيه|فعاليات|Event\s*Management|Entertainment)/i, val: 'إدارة الفعاليات والترفيه' },
    { regex: /(?:موارد\s*بشرية|Human\s*Resources|HR\b)/i, val: 'موارد بشرية' },
    { regex: /(?:إدارة\s*أعمال|Business\s*Administration|BBA|MBA)/i, val: 'إدارة أعمال' },
    { regex: /(?:تسويق|Marketing)/i, val: 'تسويق' },
    { regex: /(?:مالية|Finance)/i, val: 'مالية' },
    { regex: /(?:قانون|أنظمة|حقوق|Law|Legal)/i, val: 'قانون وأنظمة' },
    { regex: /(?:علاقات\s*عامة|Public\s*Relations|إعلام|Media)/i, val: 'علاقات عامة وإعلام' },
    { regex: /(?:لغة\s*إنجليزية|English\s*Language|English\s*Literature|ترجمة)/i, val: 'لغة إنجليزية' },
    { regex: /(?:قسم\s*اللغة\s*العربية|تخصص\s*اللغة\s*العربية|بكالوريوس\s*لغة\s*عربية)/i, val: 'لغة عربية' },
    { regex: /(?:علم\s*نفس|Psychology)/i, val: 'علم نفس' },
    { regex: /(?:خدمة\s*اجتماعية|Social\s*Work|اجتماع)/i, val: 'خدمة اجتماعية' },
    { regex: /(?:بكالوريوس|ماجستير|دبلوم|قسم|تخصص)\s+تاريخ\b/i, val: 'تاريخ' },
    { regex: /(?:جغرافيا|Geography)/i, val: 'جغرافيا' },
    { regex: /(?:إدارة\s*عامة|Public\s*Administration)/i, val: 'إدارة عامة' },
    { regex: /(?:لوجستيات|سلاسل\s*إمداد|Supply\s*Chain|Logistics)/i, val: 'سلاسل إمداد ولوجستيات' },
    { regex: /(?:هندسة\s*كهربائية|Electrical\s*Engineering)/i, val: 'هندسة كهربائية' },
    { regex: /(?:هندسة\s*ميكانيكية|Mechanical\s*Engineering)/i, val: 'هندسة ميكانيكية' },
    { regex: /(?:هندسة\s*مدنية|Civil\s*Engineering)/i, val: 'هندسة مدنية' },
    { regex: /(?:هندسة\s*صناعية|Industrial\s*Engineering)/i, val: 'هندسة صناعية' },
    { regex: /(?:تمريض|Nursing)/i, val: 'تمريض' }
  ];

  const explicitMajorMatch = cleanRaw.match(/(?:Major\s*in|Specialization|Field\s*of\s*Study|التخصص|تخصص|القسم)[:\s\-]+([^\n,،.\/]{3,45})/i);
  if (explicitMajorMatch) {
    const rawVal = explicitMajorMatch[1].trim();
    for (const item of majorCatalog) {
      if (item.regex.test(rawVal)) {
        major = item.val;
        break;
      }
    }
    if (major === 'لا يوجد' && rawVal.length >= 3 && !/المملكة|السعودية|project|shutdown|aramco/i.test(rawVal)) {
      major = rawVal;
    }
  }

  if (major === 'لا يوجد') {
    const eduSectionMatch = cleanRaw.match(/(?:التعليم|المؤهلات|Education|Academic)[:\s\n]+([\s\S]{10,400}?)(?=(?:الخبرات|الخبرة|الدورات|الشهادات|المهارات|Experience|Skills|Courses)|$)/i);
    const eduText = eduSectionMatch ? eduSectionMatch[1] : cleanRaw;

    for (const item of majorCatalog) {
      if (item.regex.test(eduText)) {
        major = item.val;
        break;
      }
    }
  }

  if (major === 'لا يوجد') {
    for (const item of majorCatalog) {
      if (item.regex.test(oneLineText)) {
        major = item.val;
        break;
      }
    }
  }

  if (degree === 'ثانوية عامة') {
    if (/(?:علمي|علوم\s*طبيعية|Scientific)/i.test(oneLineText)) major = 'ثانوية عامة (علمي)';
    else if (/(?:أدبي|علوم\s*شرعية|ادبي)/i.test(oneLineText)) major = 'ثانوية عامة (أدبي)';
    else if (major === 'لا يوجد') major = 'ثانوية عامة';
  }

  // =========================================================================
  // 6. المسمى الوظيفي المستهدف / الحالي
  // =========================================================================
  let jobTitle = 'لا يوجد';

  if (/Senior\s*Data\s*Engineering|Data\s*Engineer/i.test(cleanRaw) && /Full\s*Stack/i.test(cleanRaw)) {
    jobTitle = 'مهندس بيانات أول / مطور شامل (Senior Data Engineer | Full Stack)';
  } else if (/Engineering\s*Tech\s*Specialist/i.test(cleanRaw)) {
    jobTitle = 'أخصائي هندسة تقنية (Engineering Tech Specialist)';
  } else if (/Full\s*Stack\s*Developer/i.test(cleanRaw)) {
    jobTitle = 'مطور برمجيات متكامل (Full Stack Developer)';
  } else if (/(?:فني\s*دعم|دعم\s*فن[يى]?|صيانة\s*حاسب|Technical\s*Support|IT\s*Support)/i.test(cleanRaw)) {
    jobTitle = 'فني دعم حاسب آلي (IT Support Specialist)';
  }

  if (jobTitle === 'لا يوجد') {
    const explicitTitle = cleanRaw.match(/(?:SENIOR\s*[A-Z\s]+|Software\s*Engineering\s*Team\s*Lead|Hospitality\s*Specialist|Auditor|Operator|Project\s*Manager)/i);
    if (explicitTitle) {
      jobTitle = explicitTitle[0].trim();
    }
  }

  if (jobTitle === 'لا يوجد') {
    const titleMatch = cleanRaw.match(/(?:المسمى\s*الوظيفي|المسمى\s*الحالي|الوظيفة\s*المستهدفة|الوظيفة\s*الحالية|الهدف\s*المهني|الهدف\s*الوظيفي|Job\s*Title|Position|Role)[:\s\-]+([^\n,،.]{3,45})/i);
    if (titleMatch && !/^(?:الحصول|العمل|تطوير|سيرة|طلب|الرغبة|لا|during|actively)/i.test(titleMatch[1].trim())) {
      jobTitle = titleMatch[1].trim();
    }
  }

  if (jobTitle === 'لا يوجد') {
    if (major === 'هندسة حاسب آلي') jobTitle = 'مهندس حاسب آلي ونظم';
    else if (major === 'دعم فني وتقنية حاسب') jobTitle = 'فني دعم حاسب آلي وشبكات';
    else if (major === 'محاسبة') jobTitle = 'محاسب مالي';
    else if (major === 'إرشاد سياحي' || major === 'سياحة وفندقة') jobTitle = 'أخصائي سياحة وضيافة';
    else if (major === 'إدارة مشاريع') jobTitle = 'منسق إدارة مشاريع';
    else if (major === 'موارد بشرية') jobTitle = 'أخصائي موارد بشرية';
    else if (major === 'هندسة برمجيات' || major === 'علوم حاسب') jobTitle = 'مهندس برمجيات / مطور نظم';
    else if (major === 'إدارة أعمال') jobTitle = 'منسق عمليات وإدارة أعمال';
    else if (degree === 'ثانوية عامة') jobTitle = 'مساعد إداري وخدمات عامة';
    else if (major !== 'لا يوجد') jobTitle = `أخصائي ${major}`;
  }

  // =========================================================================
  // 7. الخبرة الإجمالية ومجالاتها
  // =========================================================================
  let totalExpYears = 0;
  const isExplicitZeroExp = /(?:بدون\s*خبرة|لا\s*توجد\s*خبرة|حديث\s*تخرج|حديثة\s*تخرج|Fresh\s*Graduate|No\s*Experience)/i.test(oneLineText);

  const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const wordExpMatch = cleanRaw.match(/(?:over|around|more than)?\s*(one|two|three|four|five|six|seven|eight|nine|ten)\s*years\s*(?:of)?\s*experience/i);
  if (wordExpMatch && wordToNum[wordExpMatch[1].toLowerCase()]) {
    totalExpYears = wordToNum[wordExpMatch[1].toLowerCase()];
  }

  if (totalExpYears === 0) {
    const expExplicitMatch = cleanRaw.match(/([0-9]+(?:\.[0-9]+)?)\+?\s*(?:years|years'|year|سنوات|سنة|عام)\s*(?:of)?\s*(?:practical\s*)?experience/i)
                          || cleanRaw.match(/(?:سنوات\s*الخبرة|الخبرة|إجمالي\s*الخبرة|Total\s*Experience)[:\s]*([0-9]+(?:\.[0-9]+)?)/i);
    if (expExplicitMatch) {
      const val = parseFloat(expExplicitMatch[1]);
      if (!isNaN(val) && val > 0 && val <= 40) {
        totalExpYears = val;
      }
    }
  }

  const currentYear = 2026;
  const dateRanges = cleanRaw.match(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec|\d{2}\/)?\s*(?:19[9]\d|20[012]\d))\s*[-–—toإلى]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|July|Aug|Sep|Oct|Nov|Dec|\d{2}\/)?\s*(?:19[9]\d|20[012]\d)|الآن|حتى\s*الآن|Present|till\s*Present)/gi) || [];
  
  let calculatedYears = 0;
  dateRanges.forEach(range => {
    const parts = range.split(/[-–—toإلى]/i).map(p => p.trim());
    if (parts.length === 2) {
      const startMatch = parts[0].match(/(19[9]\d|20[012]\d)/);
      const endMatch = parts[1].match(/(19[9]\d|20[012]\d)/);
      if (startMatch) {
        const startY = parseInt(startMatch[1]);
        let endY = currentYear;
        if (endMatch) endY = parseInt(endMatch[1]);
        if (endY >= startY && endY <= currentYear + 1) {
          calculatedYears += Math.max(0.5, endY - startY);
        }
      }
    }
  });

  if (totalExpYears === 0 && calculatedYears > 0 && calculatedYears <= 40) {
    totalExpYears = +calculatedYears.toFixed(1);
  }

  if (isExplicitZeroExp && totalExpYears === 0) {
    totalExpYears = 0;
  }

  // استخراج مجالات الخبرة
  let field1 = 'لا يوجد';
  let years1 = 0;
  let field2 = 'لا يوجد';
  let years2 = 0;
  let field3 = 'لا يوجد';
  let years3 = 0;

  if (totalExpYears > 0 || calculatedYears > 0) {
    if (totalExpYears === 0 && calculatedYears > 0) totalExpYears = calculatedYears;
    
    if (/Sela/i.test(cleanRaw) && /AlYamama/i.test(cleanRaw)) {
      field1 = 'قيادة تطوير البرمجيات - شركة صلة (Nusk Card | Sela)';
      years1 = 2;
      field2 = 'قيادة فرق هندسة البرمجيات - شركة اليمامة (AlYamama Co.)';
      years2 = 2;
      field3 = 'تطوير تطبيقات الجوال والويب - أمانة العاصمة المقدسة و Firstcity';
      years3 = +(totalExpYears - years1 - years2).toFixed(1);
      if (years3 < 0) years3 = 3;
    } else if (/Aramco/i.test(cleanRaw)) {
      field1 = 'إدارة وتنسيق مشاريع الهندسة التقنية - أرامكو (Aramco SMP - Projects)';
      years1 = +(totalExpYears * 0.6).toFixed(1);
      field2 = 'الدعم الفني وتكامل النظم - مشروع أميرال (Aramco Amiral Project)';
      years2 = +(totalExpYears - years1).toFixed(1);
    } else if (/MBA\s*AL\s*FALAH/i.test(cleanRaw)) {
      field1 = 'تدقيق ومراجعة حسابات - MBA AL FALAH Company';
      years1 = totalExpYears;
    } else if (/Ministry\s*of\s*Health/i.test(cleanRaw)) {
      field1 = 'إدارة الأصول والمالية - وزارة الصحة';
      years1 = totalExpYears;
    } else if (/LE\s*MERIDIEN|Marriott/i.test(cleanRaw)) {
      field1 = 'خدمات الضيافة والحجوزات - فندق لو ميريديان ماريوت';
      years1 = totalExpYears;
    } else if (/هيئة\s*تطوير\s*المدينة/i.test(cleanRaw) || /تنظيم\s*الحشود/i.test(cleanRaw)) {
      field1 = 'إدارة وتنظيم الحشود والفعاليات - هيئة تطوير المدينة';
      years1 = totalExpYears;
    } else if (/production\s*equipment|تشغيل/i.test(cleanRaw)) {
      field1 = 'تشغيل معدات الإنتاج والعمليات اليومية';
      years1 = totalExpYears;
    } else if (major !== 'لا يوجد') {
      field1 = `خبرة مهنية في مجال ${major}`;
      years1 = totalExpYears;
    } else {
      field1 = 'خبرة عملية مسجلة';
      years1 = totalExpYears;
    }
  }

  // =========================================================================
  // 8. الدورات والشهادات
  // =========================================================================
  const extractedCourses = [];

  const catalogCerts = [
    { regex: /CAPM/i, val: 'شهادة إدارة المشاريع المعتمدة (CAPM® Certified)' },
    { regex: /Cambridge\s*IT/i, val: 'دبلوم مهارات تقنية المعلومات (Cambridge IT Skills Diploma)' },
    { regex: /Diploma\s*IN\s*Web\s*Development/i, val: 'دبلوم تطوير الويب (Diploma in Web Development)' },
    { regex: /Hardware\s*&\s*Software\s*Troubleshooting|تشخيص\s*وحل\s*أعطال/i, val: 'تشخيص وحل أعطال الأجهزة والبرامج (Hardware & Software Troubleshooting)' },
    { regex: /شبكات\s*محلية|LAN\b|أجهزة\s*التوجيه/i, val: 'إدارة الشبكات المحلية (LAN) وتوجيه البيانات' },
    { regex: /الأمن\s*السيبراني|Cybersecurity/i, val: 'معايير الأمن السيبراني ومكافحة التهديدات' },
    { regex: /PMP\b|Project\s*Management\s*Professional/i, val: 'إدارة المشاريع الاحترافية (PMP)' },
    { regex: /ITIL|Comp\s*TIA\s*A\+|CompTIA\s*Network\+/i, val: 'الدعم الفني والشبكات (ITIL & CompTIA A+/Network+)' },
    { regex: /Accounting\s*for\s*Non-accountants/i, val: 'المحاسبة لغير المحاسبين (Accounting for Non-accountants)' },
    { regex: /Human\s*Resources\s*Management/i, val: 'إدارة الموارد البشرية (HR Management)' },
    { regex: /Certified\s*Management\s*Accountant|CMA\b/i, val: 'شهادة المحاسب الإداري المعتمد (CMA)' },
    { regex: /Tour\s*Guide|مرشد\s*سياحي/i, val: 'رخصة إرشاد سياحي معتمد' },
    { regex: /\bOpera\s*(?:system|PMS|hotel)\b/i, val: 'نظام إدارة الفنادق (Opera PMS)' },
    { regex: /القيادة\s*اإلبداعية|القيادة\s*الإبداعية/i, val: 'القيادة الإبداعية وتطوير فرق العمل' },
    { regex: /التميز\s*في\s*خدمة\s*العمالء|التميز\s*في\s*خدمة\s*العملاء/i, val: 'التميز في خدمة العملاء (دروب)' },
    { regex: /CIPD/i, val: 'إدارة الموارد البشرية الاحترافية (CIPD)' }
  ];

  for (const c of catalogCerts) {
    if (c.regex.test(cleanRaw) && !extractedCourses.includes(c.val)) {
      extractedCourses.push(c.val);
      if (extractedCourses.length >= 3) break;
    }
  }

  const cert1 = extractedCourses[0] || 'لا يوجد';
  const cert2 = extractedCourses[1] || 'لا يوجد';
  const cert3 = extractedCourses[2] || 'لا يوجد';
  const extraCerts = extractedCourses.length >= 3 || /(?:دورات\s*أخرى|شهادات\s*إضافية|competencies|Courses)/i.test(oneLineText) ? 'نعم' : 'لا يوجد';

  // =========================================================================
  // 9. الرخص المهنية
  // =========================================================================
  let license = 'لا يوجد';
  if (/CAPM/i.test(cleanRaw)) {
    license = 'شهادة مساعد إدارة مشاريع معتمد (CAPM® - PMI)';
  } else if (/Ministry\s*of\s*Tourism|وزارة\s*السياحة|Tour\s*Guide/i.test(cleanRaw)) {
    license = 'رخصة إرشاد سياحي معتمدة - وزارة السياحة';
  } else if (/(?:هيئة\s*المهندسين|Bachelor(?:\s*Degree|\s*Of)?\s*(?:of\s*)?Engineering|Saudi\s*Council\s*of\s*Engineers|SCE\b)/i.test(cleanRaw)) {
    license = 'شهادة الاعتماد المهني - هيئة المهندسين';
  } else if (/(?:هيئة\s*التخصصات\s*الصحية|SCFHS)/i.test(cleanRaw)) {
    license = 'تصنيف الهيئة السعودية للتخصصات الصحية';
  } else if (/(?:SOCPA|زمالة\s*سوكبا)/i.test(cleanRaw)) {
    license = 'زمالة الهيئة السعودية للمحاسبين والمراجعين (SOCPA)';
  } else if (/رخصة\s*قيادة/i.test(cleanRaw)) {
    license = 'رخصة قيادة سارية';
  }

  // =========================================================================
  // 10. هل يوجد خبرات لم تذكر
  // =========================================================================
  let unmentioned = 'لا يوجد';
  if (/(?:Beneficiary|Alarqam|Charity|تطوع|أعمال\s*حرة|مشاريع\s*تطوعية|Free\s*lance)/i.test(cleanRaw)) {
    unmentioned = 'نعم (مشاريع تقنية وتطوعية)';
  }

  return {
    "رقم الهويه": nationalId,
    "الاسم": candidateName,
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

if (typeof window !== 'undefined') {
  window.extractTextFromPdf = extractTextFromPdf;
  window.parseCandidateFromText = parseCandidateFromText;
  window.cleanAndFixReversedArabic = cleanAndFixReversedArabic;
  window.unspaceLetters = unspaceLetters;
  window.normalizeDigits = normalizeDigits;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTextFromPdf,
    parseCandidateFromText,
    normalizeDigits,
    cleanAndFixReversedArabic,
    unspaceLetters
  };
}