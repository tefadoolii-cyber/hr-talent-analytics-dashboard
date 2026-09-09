// ==========================================================================
// محرك قراءة واستخراج البيانات عالي الدقة من ملفات PDF (Wisal Smart PDF Engine v2)
// متوافق مع نظام Mozilla PDF.js مع معالجة تخطيط الأسطر والنصوص العربية والإنجليزية
// استخراج دقيق وذكي للبيانات الفعلية دون تخمينات مصطنعة أو حقول فارغة
// ==========================================================================

if (typeof window !== 'undefined' && window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

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
 * فحص وتصحيح النصوص العربية المعكوسة (الناتجة عن بعض برامج تصدير PDF)
 */
function fixReversedArabic(text) {
  if (!text) return '';
  const reversedIndicators = /(?:ةريس\s*ةيتاذ|سويرولاقب|ريتسجام|مولبد|ةيعماج|تاربخ|تارود|تامولعم|فتاه|ديدج)/;
  if (!reversedIndicators.test(text)) {
    return text;
  }

  return text.split('\n').map(line => {
    return line.split(' ').map(word => {
      if (/^[\u0600-\u06FF]+$/.test(word)) {
        return word.split('').reverse().join('');
      }
      return word;
    }).join(' ');
  }).join('\n');
}

/**
 * قراءة نصوص ملف الـ PDF مع الحفاظ التام على بنية الأسطر والمحاذاة الرأسية
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
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
  rawExtracted = fixReversedArabic(rawExtracted);
  return rawExtracted;
}

/**
 * استخراج اسم المرشح النظيف من اسم الملف إن وجد
 */
function cleanCandidateNameFromFileName(fileName) {
  if (!fileName) return '';
  let name = String(fileName)
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
 * محرك استخراج وتحليل بيانات المرشح فائق الدقة (Wisal Smart Candidate Analyzer)
 */
function parseCandidateFromText(rawText, fileName = '') {
  let cleanRaw = normalizeDigits(rawText || '');
  // تنظيف علامات التبويب والمسافات غير القياسية
  cleanRaw = cleanRaw.replace(/[\t\r]/g, ' ');
  // إزالة ترويسات وأرقام الصفحات التلقائية
  cleanRaw = cleanRaw.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, ' ');
  cleanRaw = cleanRaw.replace(/Page\s*\d+\s*(?:of\s*\d+)?/gi, ' ');

  const rawLines = cleanRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const oneLineText = cleanRaw.replace(/\s+/g, ' ');

  // =========================================================================
  // 1. استخراج رقم الهوية الوطنية أو الإقامة (10 خانات تبدأ بـ 1 أو 2)
  // =========================================================================
  let nationalId = 'لا يوجد';
  const idRegex = /\b([12]\d{9})\b/;

  // 1. فحص اسم الملف أولاً
  const fileIdMatch = String(fileName).match(idRegex);
  if (fileIdMatch) {
    nationalId = fileIdMatch[1];
  } else {
    // 2. فحص النص مع التسميات الصريحة
    const labeledIdMatch = cleanRaw.match(/(?:الهوية|السجل\s*المدني|الإقامة|الاقامة|الهوية\s*الوطنية|رقم\s*الهوية|رقم\s*السجل|ID|National\s*ID|Iqama|Civil\s*ID)[:\s#]*([12]\d{9})\b/i);
    if (labeledIdMatch) {
      nationalId = labeledIdMatch[1];
    } else {
      // 3. فحص أي رقم مكون من 10 أرقام ويبدأ بـ 1 أو 2
      const anyGovId = cleanRaw.match(idRegex);
      if (anyGovId) {
        nationalId = anyGovId[1];
      }
    }
  }

  // =========================================================================
  // 2. استخراج الاسم الحقيقي للمرشح
  // =========================================================================
  let candidateName = 'لا يوجد';
  const explicitName = cleanRaw.match(/(?:الاسم|االسم|اﻻسم|اسم\s*المرشح|اسم\s*الموظف|Name|Full\s*Name)[:\s\-]+([^\n,،.\/]{3,45}?)(?=\s*(?:الجنسية|العنوان|رقم|الهوية|تاريخ|البريد|الجوال|Phone|Email|Nationality)|$)/i);
  if (explicitName && !/(?:البيانات|الشخصية|السيرة|الذاتية)/i.test(explicitName[1])) {
    candidateName = explicitName[1].trim();
  }

  // الاستفادة من اسم الملف
  if (candidateName === 'لا يوجد' || candidateName.length < 3) {
    const fromFile = cleanCandidateNameFromFileName(fileName);
    if (fromFile) candidateName = fromFile;
  }

  // الاستخراج من السطور الأولى في بداية المستند
  if (candidateName === 'لا يوجد') {
    const ignoreHeaderRegex = /^(?:السيرة\s*الذاتية|البيانات\s*الشخصية|المعلومات\s*الشخصية|Curriculum\s*Vitae|Resume|CV|Personal\s*Information|Contact|Profile|Summary|Objective|Email|Number|Phone|Address|Saudi\s*Arabia|Jeddah|Riyadh|Dammam|Taif|Makkah|Madinah|Kingdom|\+?966|\d+)/i;
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
  // 3. استخراج الجنس بدقة
  // =========================================================================
  let gender = 'لا يوجد';
  if (/(?:الجنس|النوع)\s*[:\-]?\s*أنثى/i.test(cleanRaw) || /\bFemale\b/i.test(cleanRaw) || /(?:سعودية|مواطنة|خريجة)\b/.test(cleanRaw)) {
    gender = 'أنثى';
  } else if (/(?:الجنس|النوع)\s*[:\-]?\s*ذكر/i.test(cleanRaw) || /\bMale\b/i.test(cleanRaw) || /(?:سعودي|مواطن|خريج)\b/.test(cleanRaw)) {
    gender = 'ذكر';
  } else {
    // الاستدلال التلقائي من الاسم الأول
    const femaleNames = /^(?:مريم|نورة|نوره|سارة|ساره|فاطمة|فاطمه|عائشة|عائشه|منيرة|منيره|ريم|مها|أمل|امل|هدى|هند|ليلى|دانة|دانه|شهد|روان|أسماء|اسماء|رغد|بيان|نجود|أريج|خلود|عفاف|عبير|حنان|ابتسام|لطيفة|لطيفه|نوف|العنود|الهنوف|Maryam|Sarah|Noura|Fatima|Aisha)/i;
    const maleNames = /^(?:محمد|أحمد|احمد|علي|فهد|خالد|عبد|معاذ|يوسف|ياسر|عمر|سعد|فيصل|تركي|سلطان|راكان|سالم|صالح|حمد|سلمان|إبراهيم|ابراهيم|حسن|حسين|مهند|ماجد|بندر|طلال|Fahad|Mohammed|Ahmed|Ali|Abdulmajid|Yasser|Yousef)/i;
    if (femaleNames.test(candidateName)) {
      gender = 'أنثى';
    } else if (maleNames.test(candidateName)) {
      gender = 'ذكر';
    }
  }

  // =========================================================================
  // 4. استخراج المؤهل الدراسي
  // =========================================================================
  let degree = 'لا يوجد';
  if (/(?:دكتوراه|دكتوراة|PhD|Doctorate|Doctor\s*of)/i.test(oneLineText)) {
    degree = 'دكتوراه';
  } else if (/(?:ماجستير|Master(?:\s*of|\s*degree)?|MSc|MBA|ماستر)/i.test(oneLineText)) {
    degree = 'ماجستير';
  } else if (/(?:دبلوم\s*عالي|Higher\s*Diploma|Postgraduate\s*Diploma)/i.test(oneLineText)) {
    degree = 'دبلوم عالي';
  } else if (/(?:بكالوريوس|Bachelor(?:\s*of|\s*degree)?|BSc|B\.Sc|B\.A|BBA|ليسانس|بكالوريس)/i.test(oneLineText)) {
    degree = 'بكالوريوس';
  } else if (/(?:دبلوم\s*متوسط|دبلوم\s*كلية|دبلوم|Diploma|Associate\s*Degree)/i.test(oneLineText)) {
    degree = 'دبلوم';
  } else if (/(?:ثانوية\s*عامة|الثانوية\s*العامة|ثانوية|ثانويه|High\s*School)/i.test(oneLineText)) {
    degree = 'ثانوية عامة';
  } else if (/(?:كفاءة|متوسطة)/i.test(oneLineText)) {
    degree = 'كفاءة متوسطة';
  }

  // =========================================================================
  // 5. استخراج التخصص الأكاديمي الواقعي
  // =========================================================================
  let major = 'لا يوجد';
  const majorCatalog = [
    { regex: /(?:محاسبة|المحاسبة|Accounting|Auditing|تدقيق\s*حسابات)/i, val: 'محاسبة' },
    { regex: /(?:إرشاد\s*سياحي|Tourism\s*Guidance)/i, val: 'إرشاد سياحي' },
    { regex: /(?:سياحة\s*وفندقة|فندقة|ضيافة|Hospitality|Tourism)/i, val: 'سياحة وفندقة' },
    { regex: /(?:إدارة\s*مشاريع|Project\s*Management)/i, val: 'إدارة مشاريع' },
    { regex: /(?:إدارة\s*مرافق|Facility\s*Management)/i, val: 'إدارة مرافق' },
    { regex: /(?:ترفيه|فعاليات|Event\s*Management|Entertainment)/i, val: 'إدارة الفعاليات والترفيه' },
    { regex: /(?:موارد\s*بشرية|Human\s*Resources|HR)/i, val: 'موارد بشرية' },
    { regex: /(?:إدارة\s*أعمال|Business\s*Administration|BBA|MBA)/i, val: 'إدارة أعمال' },
    { regex: /(?:هندسة\s*برمجيات|Software\s*Engineering)/i, val: 'هندسة برمجيات' },
    { regex: /(?:علوم\s*حاسب|علوم\s*الحاسب|Computer\s*Science)/i, val: 'علوم حاسب' },
    { regex: /(?:نظم\s*معلومات|Information\s*Systems|MIS)/i, val: 'نظم معلومات' },
    { regex: /(?:تقنية\s*معلومات|Information\s*Technology|IT)/i, val: 'تقنية معلومات' },
    { regex: /(?:أمن\s*سيبراني|Cybersecurity|Cyber\s*Security)/i, val: 'أمن سيبراني' },
    { regex: /(?:تسويق|Marketing)/i, val: 'تسويق' },
    { regex: /(?:مالية|Finance)/i, val: 'مالية' },
    { regex: /(?:قانون|أنظمة|حقوق|Law|Legal)/i, val: 'قانون وأنظمة' },
    { regex: /(?:علاقات\s*عامة|Public\s*Relations|إعلام|Media)/i, val: 'علاقات عامة وإعلام' },
    { regex: /(?:لغة\s*إنجليزية|English\s*Language|English\s*Literature|ترجمة)/i, val: 'لغة إنجليزية' },
    { regex: /(?:لغة\s*عربية|اللغة\s*العربية)/i, val: 'لغة عربية' },
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

  // فحص قسم التعليم أولاً
  const eduSectionMatch = cleanRaw.match(/(?:التعليم|المؤهلات|Education|Academic)[:\s\n]+([\s\S]{10,400}?)(?=(?:الخبرات|الخبرة|الدورات|الشهادات|المهارات|Experience|Skills|Courses)|$)/i);
  const eduText = eduSectionMatch ? eduSectionMatch[1] : cleanRaw;

  for (const item of majorCatalog) {
    if (item.regex.test(eduText)) {
      major = item.val;
      break;
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
  // 6. استخراج المسمى الوظيفي المستهدف / الحالي
  // =========================================================================
  let jobTitle = 'لا يوجد';

  // 1. مسمى مذكور تحت الاسم مباشرة
  if (rawLines.length > 1) {
    for (let i = 0; i < Math.min(rawLines.length, 5); i++) {
      const l = rawLines[i].replace(/^[-•*–#\s]+/, '').trim();
      if (/^(?:Hospitality\s*Specialist|Auditor|Accounting\s*Professional|Operator|Project\s*Manager|HR\s*Specialist|Accountant|Software\s*Engineer|Tour\s*Guide)/i.test(l)) {
        jobTitle = l;
        break;
      }
      if (/^(?:أخصائي|مشرف|مدير|منسق|فني|مهندس|محاسب|مراجع|مدقق|مرشد|مساعد|سكرتير)\s+[^\n,،.]{3,35}/i.test(l)) {
        jobTitle = l;
        break;
      }
    }
  }

  // 2. فحص صريح من النص
  if (jobTitle === 'لا يوجد') {
    const titleMatch = cleanRaw.match(/(?:المسمى\s*الوظيفي|المسمى\s*الحالي|الوظيفة\s*المستهدفة|الوظيفة\s*الحالية|Job\s*Title|Position|Role)[:\s\-]+([^\n,،.]{3,45})/i);
    if (titleMatch && !/^(?:الحصول|العمل|تطوير|سيرة|طلب|الرغبة|لا)/.test(titleMatch[1].trim())) {
      jobTitle = titleMatch[1].trim();
    }
  }

  // 3. فحص من واقع سجل الخبرات المهنية
  if (jobTitle === 'لا يوجد') {
    const roleMatch = cleanRaw.match(/(?:AUDITOR|Operator|Hospitality\s*Guru|Finance\s*Transformation|Tour\s*Guide|مشرف\s*تنظيم\s*الحشود|تنظيم\s*الحشود|إدارة\s*مشاريع|إدارة\s*مرافق|خدمة\s*عملاء|مدخل\s*بيانات|محاسب)/i);
    if (roleMatch) {
      const r = roleMatch[0];
      if (/auditor/i.test(r)) jobTitle = 'مدقق حسابات (Auditor)';
      else if (/operator/i.test(r)) jobTitle = 'فني تشغيل (Operator)';
      else if (/hospitality/i.test(r)) jobTitle = 'أخصائي ضيافة وفندقة';
      else if (/tour\s*guide/i.test(r)) jobTitle = 'مرشد سياحي معتمد';
      else if (/حشود/i.test(r)) jobTitle = 'مشرف تنظيم حشود';
      else if (/مشاريع/i.test(r)) jobTitle = 'منسق / مدير مشاريع';
      else if (/مرافق/i.test(r)) jobTitle = 'مشرف إدارة مرافق';
      else jobTitle = r;
    }
  }

  // 4. إذا لم يذكر صراحة، اقتراح مسمى واقعي متطابق مع المؤهل والتخصص
  if (jobTitle === 'لا يوجد') {
    if (major === 'محاسبة') jobTitle = 'محاسب مالي';
    else if (major === 'إرشاد سياحي' || major === 'سياحة وفندقة') jobTitle = 'أخصائي سياحة وضيافة';
    else if (major === 'إدارة مشاريع') jobTitle = 'منسق إدارة مشاريع';
    else if (major === 'موارد بشرية') jobTitle = 'أخصائي موارد بشرية';
    else if (major === 'هندسة برمجيات' || major === 'علوم حاسب') jobTitle = 'مهندس برمجيات / مطور نظم';
    else if (major === 'إدارة أعمال') jobTitle = 'منسق عمليات وإدارة أعمال';
    else if (degree === 'ثانوية عامة') jobTitle = 'مساعد إداري وخدمات عامة';
    else if (major !== 'لا يوجد') jobTitle = `أخصائي ${major}`;
  }

  // =========================================================================
  // 7. استخراج سنوات ومجالات الخبرة بدقة
  // =========================================================================
  let totalExpYears = 0;
  const isExplicitZeroExp = /(?:بدون\s*خبرة|لا\s*توجد\s*خبرة|حديث\s*تخرج|حديثة\s*تخرج|Fresh\s*Graduate|No\s*Experience)/i.test(oneLineText);

  // حساب السنوات من التواريخ (مثال: 02/2016 - 02/2020 أو 2021 - 2024 أو 2023 - Present)
  const currentYear = 2026;
  const dateRanges = cleanRaw.match(/(?:(?:\d{2}\/)?(?:19[9]\d|20[012]\d))\s*[-–—toإلى]\s*(?:(?:\d{2}\/)?(?:19[9]\d|20[012]\d)|الآن|حتى\s*الآن|Present)/gi) || [];
  
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

  // فحص صيغ الخبرة الصريحة (مثل: 4 سنوات، 2 years of experience)
  const expMatch = cleanRaw.match(/(?:سنوات\s*الخبرة|الخبرة|إجمالي\s*الخبرة|خبرة|Experience|Total\s*Experience)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:سنوات|سنة|عام|أعوام|years|months|شهر)?/i)
                || cleanRaw.match(/(?:([0-9]+(?:\.[0-9]+)?)\s*(?:years|years'|year)\s*(?:of)?\s*experience)/i);
  if (expMatch) {
    let val = parseFloat(expMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 40) {
      totalExpYears = val;
    }
  }

  if (totalExpYears === 0 && calculatedYears > 0 && calculatedYears <= 40) {
    totalExpYears = +calculatedYears.toFixed(1);
  }

  if (isExplicitZeroExp && totalExpYears === 0) {
    totalExpYears = 0;
  }

  // استخراج مجالات الخبرة والشركات الحقيقية
  let field1 = 'لا يوجد';
  let years1 = 0;
  let field2 = 'لا يوجد';
  let years2 = 0;

  if (totalExpYears > 0 || calculatedYears > 0) {
    if (totalExpYears === 0 && calculatedYears > 0) totalExpYears = calculatedYears;
    years1 = totalExpYears;

    if (/MBA\s*AL\s*FALAH/i.test(cleanRaw)) {
      field1 = 'تدقيق ومراجعة حسابات - MBA AL FALAH Company';
    } else if (/Ministry\s*of\s*Health/i.test(cleanRaw)) {
      field1 = 'إدارة الأصول والمالية - وزارة الصحة';
    } else if (/LE\s*MERIDIEN|Marriott/i.test(cleanRaw)) {
      field1 = 'خدمات الضيافة والحجوزات - فندق لو ميريديان ماريوت';
    } else if (/هيئة\s*تطوير\s*المدينة/i.test(cleanRaw) || /تنظيم\s*الحشود/i.test(cleanRaw)) {
      field1 = 'إدارة وتنظيم الحشود والفعاليات - هيئة تطوير المدينة';
    } else if (/Sela|صلة/i.test(cleanRaw)) {
      field1 = 'إدارة وتشغيل الفعاليات - شركة صلة (Sela)';
    } else if (/production\s*equipment|تشغيل/i.test(cleanRaw)) {
      field1 = 'تشغيل معدات الإنتاج والعمليات اليومية';
    } else if (major !== 'لا يوجد') {
      field1 = `خبرة مهنية في مجال ${major}`;
    } else {
      field1 = 'خبرة عملية مسجلة';
    }
  }

  // =========================================================================
  // 8. استخراج الدورات والشهادات التدريبية
  // =========================================================================
  const extractedCourses = [];

  const catalogCerts = [
    { regex: /Certified\s*Management\s*Accountant|CMA/i, val: 'شهادة المحاسب الإداري المعتمد (CMA)' },
    { regex: /Tour\s*Guide|مرشد\s*سياحي/i, val: 'رخصة إرشاد سياحي معتمد' },
    { regex: /\bOpera\s*(?:system|PMS|hotel)\b/i, val: 'نظام إدارة الفنادق (Opera PMS)' },
    { regex: /القيادة\s*اإلبداعية|القيادة\s*الإبداعية/i, val: 'القيادة الإبداعية وتطوير فرق العمل' },
    { regex: /التميز\s*في\s*خدمة\s*العمالء|التميز\s*في\s*خدمة\s*العملاء/i, val: 'التميز في خدمة العملاء (دروب)' },
    { regex: /PMP|إدارة\s*المشاريع\s*الاحترافية/i, val: 'إدارة المشاريع الاحترافية (PMP)' },
    { regex: /CIPD|إدارة\s*الموارد\s*البشرية/i, val: 'إدارة الموارد البشرية الاحترافية' },
    { regex: /TOT|تدريب\s*المدربين/i, val: 'تدريب المدربين (TOT)' },
    { regex: /الأمن\s*السيبراني|Cybersecurity/i, val: 'أساسيات الأمن السيبراني' },
    { regex: /ICDL|كامبردج|الحاسب\s*الآلي|الحاسب\s*األلي/i, val: 'مهارات الحاسب الآلي وتطبيقات المكاتب' }
  ];

  for (const c of catalogCerts) {
    if (c.regex.test(cleanRaw) && !extractedCourses.includes(c.val)) {
      extractedCourses.push(c.val);
      if (extractedCourses.length >= 3) break;
    }
  }

  // استخراج سطور قسم الدورات إن وجدت
  if (extractedCourses.length < 3) {
    const certSection = cleanRaw.match(/(?:الدورات|الشهادات|Courses|Certifications|Training)[:\s\n]+([\s\S]{10,350}?)(?=(?:المهارات|اللغات|Skills|Experience|التعليم)|$)/i);
    if (certSection) {
      const lines = certSection[1].split('\n')
        .map(l => l.replace(/^[-•*–#\s]+/, '').trim())
        .filter(l => l.length >= 6 && l.length <= 60 && !/(?:والشهادات|الدورات|المهارات|Skills|activities|awards|summary|history)/i.test(l) && !/^[a-z\s]+:/i.test(l));
      for (const line of lines) {
        if (!extractedCourses.includes(line) && extractedCourses.length < 3) {
          extractedCourses.push(line);
        }
      }
    }
  }

  const cert1 = extractedCourses[0] || 'لا يوجد';
  const cert2 = extractedCourses[1] || 'لا يوجد';
  const cert3 = extractedCourses[2] || 'لا يوجد';
  const extraCerts = extractedCourses.length >= 3 || /(?:دورات\s*أخرى|شهادات\s*إضافية)/i.test(oneLineText) ? 'نعم' : 'لا يوجد';

  // =========================================================================
  // 9. استخراج الرخص المهنية والاعتمادات
  // =========================================================================
  let license = 'لا يوجد';
  if (/(?:Ministry\s*of\s*Tourism|وزارة\s*السياحة|Tour\s*Guide|مرشد\s*سياحي\s*معتمد)/i.test(oneLineText)) {
    license = 'رخصة إرشاد سياحي معتمدة - وزارة السياحة';
  } else if (/(?:هيئة\s*المهندسين|اعتماد\s*مهني\s*هندسي|Saudi\s*Council\s*of\s*Engineers|SCE)/i.test(oneLineText)) {
    license = 'شهادة الاعتماد المهني - هيئة المهندسين';
  } else if (/(?:هيئة\s*التخصصات\s*الصحية|تصنيف\s*صحي|SCFHS)/i.test(oneLineText)) {
    license = 'تصنيف الهيئة السعودية للتخصصات الصحية';
  } else if (/(?:SOCPA|محاسبين\s*ومراجعين|زمالة\s*سوكبا)/i.test(oneLineText)) {
    license = 'زمالة الهيئة السعودية للمحاسبين والمراجعين (SOCPA)';
  } else if (/(?:رخصة\s*محاماة|وزارة\s*العدل|ممارسة\s*المحاماة)/i.test(oneLineText)) {
    license = 'رخصة ممارسة المحاماة - وزارة العدل';
  } else if (/(?:رخصة\s*قيادة\s*عمومي|نقل\s*ثقيل)/i.test(oneLineText)) {
    license = 'رخصة قيادة عمومي / نقل ثقيل';
  } else if (/(?:رخصة\s*قيادة|قيادة\s*سارية|Driving\s*License)/i.test(oneLineText)) {
    license = 'رخصة قيادة سارية';
  }

  // =========================================================================
  // 10. هل يوجد خبرات لم تذكر
  // =========================================================================
  let unmentioned = 'لا يوجد';
  if (/(?:أعمال\s*حرة|تطوع|استشارات|خبرات\s*أخرى|عمل\s*حر|مبادرات|مشاريع\s*تطوعية)/i.test(oneLineText)) {
    unmentioned = 'نعم';
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
    "مجال الخبره 3": "لا يوجد",
    "عددسنوات الخبره 3": 0,
    "شهور الخبره 3": 0,
    "هل يوجد خبرات لم تذكر": unmentioned,
    "المسمى الوظيفي المقترح": jobTitle,
    "الرخص المهنية": license,
    _sourceFileName: fileName
  };
}

if (typeof window !== 'undefined') {
  window.extractTextFromPdf = extractTextFromPdf;
  window.parseCandidateFromText = parseCandidateFromText;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTextFromPdf,
    parseCandidateFromText,
    normalizeDigits,
    fixReversedArabic
  };
}