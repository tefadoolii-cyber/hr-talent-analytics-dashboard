// ==========================================================================
// محرك قراءة واستخراج البيانات الذكي عالي الدقة من ملفات PDF (Wisal Smart PDF Engine)
// متوافق مع نظام Mozilla PDF.js مع معالجة تخطيط الأسطر والنصوص العربية المعكوسة
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

    // تجميع العناصر على أساس الإحداثي الرأسي (Y) لضمان عدم دمج أسطر مختلفة
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
 * محرك استخراج البيانات عالي الدقة والمطابقة لقواعد البيانات
 */
function parseCandidateFromText(rawText, fileName = '') {
  const cleanRaw = normalizeDigits(rawText);
  const lines = cleanRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const oneLineText = lines.join(' ');

  // 1. استخراج رقم الهوية الوطنية أو الإقامة (10 أرقام تبدأ بـ 1 أو 2)
  let nationalId = '';
  const labeledIdMatch = cleanRaw.match(/(?:الهوية|السجل\s*المدني|الإقامة|الاقامة|الهوية\s*الوطنية|ID|National\s*ID|Iqama)[:\s#]*([12]\d{9})/i);
  if (labeledIdMatch) {
    nationalId = labeledIdMatch[1];
  } else {
    const anyGovId = cleanRaw.match(/\b([12]\d{9})\b/);
    if (anyGovId) {
      nationalId = anyGovId[1];
    } else {
      const fileIdMatch = fileName.match(/\b([12]\d{9})\b/);
      if (fileIdMatch) {
        nationalId = fileIdMatch[1];
      }
    }
  }

  // 2. استخراج الاسم وتحديد الجنس بدقة
  let candidateName = '';
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i];
    if (!/(?:سيرة\s*ذاتية|Curriculum|Resume|CV|المملكة|وزارة|شركة|مؤسسة|بسم\s*الله)/i.test(l) && l.length >= 4 && l.length <= 40) {
      if (!candidateName) candidateName = l;
    }
  }

  let gender = 'ذكر';
  const femaleNames = /(?:سارة|ساره|نورة|نوره|فاطمة|فاطمه|مريم|ريم|هند|منى|أمل|مها|أروى|شهد|لينا|دلال|خلود|غادة|غاده|رنا|حنان|تهاني|أسماء|سحر|نجلاء|وفاء|لطيفة|لطيفه|حصة|حصه|عبير|نوف|منيرة|منيره|العنود|بشاير|روان|شروق|أماني|عائشة|عائشه|زينب|لمى|شذى|عهود|سعاد|هيا|بدور|وجدان|سمر|سوسن|إيمان|ولاء|رزان|جواهر|أفنان|يارا|ريما|جمانة|مشاعل)/i;
  const femaleKeywords = /(?:أنثى|انثى|سيدة|آنسة|Female|Woman|سعودية|مواطنة|خريجة|حاصلة|متخصصة|أخصائية|مديرة|مهندسة|باحثة|عملت|ولدت)/i;
  
  if (femaleKeywords.test(oneLineText) || (candidateName && femaleNames.test(candidateName))) {
    gender = 'أنثى';
  } else if (/(?:ذكر|رجل|Male|Man|سعودي|مواطن|خريج|حاصل)/i.test(oneLineText)) {
    gender = 'ذكر';
  }

  // 3. استخراج المؤهل الدراسي بدقة
  let degree = 'غير محدد';
  if (/(?:دكتوراه|دكتوراة|PhD|Doctorate|Doctor\s*of)/i.test(oneLineText)) {
    degree = 'دكتوراه';
  } else if (/(?:ماجستير|Master|MSc|MBA|M\.A|ماستر)/i.test(oneLineText)) {
    degree = 'ماجستير';
  } else if (/(?:دبلوم\s*عالي|Higher\s*Diploma|دبلوم\s*ما\s*بعد\s*البكالوريوس)/i.test(oneLineText)) {
    degree = 'دبلوم عالي';
  } else if (/(?:بكالوريوس|Bachelor|BSc|B\.Sc|B\.A|ليسانس|بكالوريس|جامعية|شهادة\s*جامعية)/i.test(oneLineText)) {
    degree = 'بكالوريوس';
  } else if (/(?:دبلوم\s*متوسط|دبلوم\s*كلية|دبلوم|Diploma|معهد|كلية\s*تقنية|Associate)/i.test(oneLineText)) {
    degree = 'دبلوم';
  } else if (/(?:ثانوية\s*عامة|ثانوية|ثانويه|High\s*School|Secondary)/i.test(oneLineText)) {
    degree = 'ثانوية عامة';
  } else if (/(?:كفاءة|متوسطة)/i.test(oneLineText)) {
    degree = 'كفاءة متوسطة';
  }

  // 4. استخراج التخصص الأكاديمي بدقة
  let major = '';
  const explicitMajorMatch = cleanRaw.match(/(?:التخصص|تخصص|القسم|قسم|المجال|Major|Field\s*of\s*Study)[:\s\-]+([^\n,،.\/]{3,45})/i)
                         || cleanRaw.match(/(?:بكالوريوس|ماجستير|دبلوم)\s*(?:في|تخصص)?\s*([^\n,،.\/]{3,45})/i);

  if (explicitMajorMatch) {
    let candidateMajor = explicitMajorMatch[1].trim();
    if (!/^(?:عام|الكل|غير|سنة|جامعة|كلية)/.test(candidateMajor)) {
      major = candidateMajor;
    }
  }

  const majorDictionary = [
    { pattern: /(?:أمن\s*سيبراني|Cyber\s*Security)/i, val: 'أمن سيبراني' },
    { pattern: /(?:علوم\s*حاسب|Computer\s*Science)/i, val: 'علوم حاسب' },
    { pattern: /(?:نظم\s*معلومات\s*إدارية|MIS)/i, val: 'نظم معلومات إدارية' },
    { pattern: /(?:نظم\s*معلومات|Information\s*Systems)/i, val: 'نظم معلومات' },
    { pattern: /(?:تقنية\s*معلومات|Information\s*Technology|IT)/i, val: 'تقنية معلومات' },
    { pattern: /(?:هندسة\s*برمجيات|Software\s*Engineering)/i, val: 'هندسة برمجيات' },
    { pattern: /(?:ذكاء\s*اصطناعي|Artificial\s*Intelligence|AI)/i, val: 'ذكاء اصطناعي' },
    { pattern: /(?:شبكات\s*حاسب|شبكات|Networks)/i, val: 'شبكات وتقنية اتصالات' },
    { pattern: /(?:علوم\s*بيانات|Data\s*Science)/i, val: 'علوم بيانات وتحليل' },
    { pattern: /(?:موارد\s*بشرية|Human\s*Resources|HR)/i, val: 'إدارة موارد بشرية' },
    { pattern: /(?:إدارة\s*أعمال|Business\s*Administration)/i, val: 'إدارة أعمال' },
    { pattern: /(?:إدارة\s*عامة|Public\s*Administration)/i, val: 'إدارة عامة' },
    { pattern: /(?:محاسبة|Accounting)/i, val: 'محاسبة' },
    { pattern: /(?:مالية|تمويل|بنوك|Finance|Banking)/i, val: 'مالية وتمويل' },
    { pattern: /(?:تسويق\s*رقمي|Digital\s*Marketing)/i, val: 'تسويق رقمي' },
    { pattern: /(?:تسويق|Marketing)/i, val: 'تسويق' },
    { pattern: /(?:سياحة\s*وفندقة|إدارة\s*فندقية|ضيافة|Hospitality|Tourism)/i, val: 'سياحة وفندقة' },
    { pattern: /(?:سلاسل\s*إمداد|لوجستيات|لوجستيك|Supply\s*Chain|Logistics)/i, val: 'سلاسل إمداد ولوجستيات' },
    { pattern: /(?:قانون|حقوق|أنظمة|محاماة|Law)/i, val: 'قانون وأنظمة' },
    { pattern: /(?:شريعة|دراسات\s*إسلامية|أصول\s*دين)/i, val: 'شريعة ودراسات إسلامية' },
    { pattern: /(?:لغة\s*إنجليزية|ترجمة|English|Translation)/i, val: 'لغة إنجليزية وترجمة' },
    { pattern: /(?:لغة\s*عربية|أدب\s*عربي)/i, val: 'لغة عربية' },
    { pattern: /(?:علاقات\s*عامة|إعلام|صحافة|Public\s*Relations|PR|Media)/i, val: 'إعلام وعلاقات عامة' },
    { pattern: /(?:تصميم\s*جرافيك|Graphic\s*Design)/i, val: 'تصميم جرافيك' },
    { pattern: /(?:تصميم\s*داخلي|Interior\s*Design)/i, val: 'تصميم داخلي' },
    { pattern: /(?:هندسة\s*صناعية|Industrial\s*Engineering)/i, val: 'هندسة صناعية' },
    { pattern: /(?:هندسة\s*مدنية|Civil\s*Engineering)/i, val: 'هندسة مدنية' },
    { pattern: /(?:هندسة\s*ميكانيكية|Mechanical\s*Engineering)/i, val: 'هندسة ميكانيكية' },
    { pattern: /(?:هندسة\s*كهربائية|Electrical\s*Engineering)/i, val: 'هندسة كهربائية' },
    { pattern: /(?:هندسة\s*معمارية|Architecture)/i, val: 'هندسة معمارية' },
    { pattern: /(?:تمريض|Nursing)/i, val: 'تمريض' },
    { pattern: /(?:صيدلة|Pharmacy)/i, val: 'صيدلة' },
    { pattern: /(?:مختبرات\s*طبية|علوم\s*طبية)/i, val: 'علوم طبية ومختبرات' },
    { pattern: /(?:إدارة\s*صحية|مستشفيات)/i, val: 'إدارة خدمات صحية ومستشفيات' },
    { pattern: /(?:علم\s*نفس|Psychology)/i, val: 'علم نفس' },
    { pattern: /(?:علم\s*اجتماع|خدمة\s*اجتماعية|Social\s*Work)/i, val: 'خدمة اجتماعية وعلم اجتماع' },
    { pattern: /(?:رياضيات|إحصاء|Mathematics|Statistics)/i, val: 'رياضيات وإحصاء' },
    { pattern: /(?:فيزياء|كيمياء|أحياء|علوم\s*عامة)/i, val: 'علوم طبيعية' },
    { pattern: /(?:تاريخ|جغرافيا)/i, val: 'تاريخ وجغرافيا' }
  ];

  for (const item of majorDictionary) {
    if (item.pattern.test(oneLineText)) {
      major = item.val;
      break;
    }
  }
  if (!major) major = 'عام';

  // 5. استخراج سنوات ومجالات الخبرة بدقة
  let totalExpYears = 0;
  const isZeroExp = /(?:بدون\s*خبرة|لا\s*توجد\s*خبرة|لا\s*يوجد\s*خبرات|لا\s*يوجد\s*خبرة\s*سابقة|حديث\s*تخرج|حديثة\s*تخرج|0\s*سنة|0\s*سنوات|0\s*شهر|Fresh\s*Graduate|No\s*Experience)/i.test(oneLineText);

  if (!isZeroExp) {
    const explicitExp = cleanRaw.match(/(?:سنوات\s*الخبرة|الخبرة|الخبرات|إجمالي\s*الخبرة|خبرة|Total\s*Experience|Experience)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:سنوات|سنة|عام|أعوام|years|months|شهر)?/i)
                     || cleanRaw.match(/(?:خبرة|الخبرة)\s*(?:أكثر\s*من|تزيد\s*عن|تقارب)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:سنوات|سنة|عام|أعوام)/i);
    
    if (explicitExp) {
      let val = parseFloat(explicitExp[1]);
      if (/شهر|months/i.test(explicitExp[0]) && val > 0) {
        val = +(val / 12).toFixed(1);
      }
      if (!isNaN(val) && val > 0 && val <= 45) {
        totalExpYears = val;
      }
    }

    if (totalExpYears === 0) {
      const currentYear = 2026;
      const dateRangeRegex = /(?:19[9]\d|20[012]\d)\s*[-–—toإلى]\s*(?:19[9]\d|20[012]\d|الآن|حتى\s*الآن|Present)/gi;
      const dateMatches = cleanRaw.match(dateRangeRegex) || [];
      
      let calculatedYears = 0;
      dateMatches.forEach(range => {
        const parts = range.split(/[-–—toإلى]/i).map(p => p.trim());
        if (parts.length === 2) {
          const startYear = parseInt(parts[0]);
          let endYear = currentYear;
          if (!/(?:الآن|حتى\s*الآن|Present)/i.test(parts[1])) {
            endYear = parseInt(parts[1]);
          }
          if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear && endYear <= currentYear + 1) {
            const diff = Math.max(0.5, endYear - startYear);
            calculatedYears += diff;
          }
        }
      });

      if (calculatedYears > 0 && calculatedYears <= 40) {
        totalExpYears = +calculatedYears.toFixed(1);
      }
    }
  }

  const expFieldsFound = [];
  const fieldRules = [
    { regex: /(?:إدارة\s*مكاتب|سكرتارية|أعمال\s*مكتبية|مساعد\s*إداري|منسق\s*إداري)/i, val: 'إدارة المكاتب والأعمال الإدارية' },
    { regex: /(?:خدمة\s*عملاء|استقبال|كول\s*سنتر|مركز\s*اتصال|تجربة\s*العميل|Customer\s*Service)/i, val: 'خدمة العملاء والاستقبال' },
    { regex: /(?:موارد\s*بشرية|توظيف|شؤون\s*موظفين|رواتب|HR|Recruitment)/i, val: 'الموارد البشرية وشؤون الموظفين' },
    { regex: /(?:محاسبة|مالية|أمين\s*صندوق|تدقيق|دفاتر|حسابات|Accounting|Finance)/i, val: 'العمليات المالية والمحاسبية' },
    { regex: /(?:مبيعات|تسويق|تطوير\s*أعمال|علاقات\s*عامة|Sales|Marketing)/i, val: 'المبيعات وتطوير الأعمال' },
    { regex: /(?:دعم\s*فني|صيانة\s*حاسب|شبكات|تقنية\s*معلومات|IT\s*Support)/i, val: 'الدعم الفني وتقنية المعلومات' },
    { regex: /(?:فندقة|ضيافة|حجوزات|إسكان|إشراف\s*داخلي|تشغيل\s*فندقي|Front\s*Desk)/i, val: 'الضيافة والتشغيل الفندقي' },
    { regex: /(?:إدارة\s*مشاريع|منسق\s*مشاريع|Project\s*Management)/i, val: 'إدارة المشاريع والتنسيق' },
    { regex: /(?:مستودعات|مخازن|سلاسل\s*إمداد|لوجستيات|Warehouse|Logistics)/i, val: 'المستودعات والخدمات اللوجستية' },
    { regex: /(?:أمن\s*وسلامة|سلامة\s*مهنية|OSHA|Safety)/i, val: 'الأمن والسلامة المهنية' }
  ];

  for (const rule of fieldRules) {
    if (rule.regex.test(oneLineText)) {
      expFieldsFound.push(rule.val);
      if (expFieldsFound.length >= 3) break;
    }
  }

  let field1 = 'لا يوجد خبرات مسجلة (بدون خبرة)';
  let years1 = 0;
  let field2 = '—';
  let years2 = 0;
  let field3 = '—';
  let years3 = 0;

  if (totalExpYears > 0) {
    field1 = expFieldsFound[0] || 'العمليات الإدارية وخدمة العملاء';
    if (expFieldsFound.length <= 1) {
      years1 = totalExpYears;
      field2 = '—';
      years2 = 0;
      field3 = '—';
      years3 = 0;
    } else if (expFieldsFound.length === 2) {
      years1 = +(totalExpYears * 0.6).toFixed(1);
      field2 = expFieldsFound[1];
      years2 = +(totalExpYears - years1).toFixed(1);
      field3 = '—';
      years3 = 0;
    } else {
      years1 = +(totalExpYears * 0.5).toFixed(1);
      field2 = expFieldsFound[1];
      years2 = +(totalExpYears * 0.3).toFixed(1);
      field3 = expFieldsFound[2];
      years3 = +(totalExpYears - years1 - years2).toFixed(1);
    }
  }

  // 6. استخراج الدورات والشهادات التدريبية (دون أي بيانات وهمية)
  const extractedCourses = [];
  const courseSectionRegex = /(?:الدورات|الشهادات|البرامج\s*التدريبية|الدورات\s*التدريبية|Courses|Certifications|Training)[:\s\n]+([\s\S]{10,400}?)(?=(?:الخبرات|التعليم|المؤهلات|المهارات|اللغات|Skills|Experience|Education)|$)/i;
  const sectionMatch = cleanRaw.match(courseSectionRegex);
  const textToSearchForCourses = sectionMatch ? sectionMatch[1] : cleanRaw;

  const courseLines = textToSearchForCourses.match(/(?:دورة|شهادة|برنامج|دبلوم\s*تدريبي|ورشة\s*عمل|Certified|Course)\s*[:\-]?\s*([^\n,،.]{4,60})/gi) || [];
  courseLines.forEach(c => {
    const clean = c.trim().replace(/^[-•*–]\s*/, '');
    if (!extractedCourses.includes(clean) && extractedCourses.length < 3) {
      extractedCourses.push(clean);
    }
  });

  const knownCertsList = [
    'PMP إدارة مشاريع', 'إدارة الموارد البشرية CIPD', 'خدمة العملاء والتميز في الخدمة',
    'الأمن السيبراني', 'اللغة الإنجليزية', 'الحاسب الآلي وتطبيقات المكاتب ICDL',
    'إدارة الفنادق والضيافة', 'تدريب المدربين TOT', 'إدخال البيانات ومعالجة النصوص',
    'المحاسبة المالية وضريبة القيمة المضافة', 'السلامة والصحة المهنية OSHA',
    'التسويق الرقمي', 'تحليل البيانات Power BI / Excel', 'السكرتارية التنفيذية'
  ];

  for (const cert of knownCertsList) {
    if (textToSearchForCourses.includes(cert) && !extractedCourses.includes(cert) && extractedCourses.length < 3) {
      extractedCourses.push(cert);
    }
  }

  const cert1 = extractedCourses[0] || '—';
  const cert2 = extractedCourses[1] || '—';
  const cert3 = extractedCourses[2] || '—';
  const extraCerts = extractedCourses.length >= 3 || /(?:دورات\s*أخرى|شهادات\s*إضافية)/i.test(oneLineText) ? 'نعم' : 'لا';

  // 7. استخراج الرخص المهنية والاعتمادات
  let license = 'لا يوجد';
  if (/(?:هيئة\s*المهندسين|اعتماد\s*مهني\s*هندسي|Saudi\s*Council\s*of\s*Engineers)/i.test(oneLineText)) {
    license = 'شهادة الاعتماد المهني - هيئة المهندسين';
  } else if (/(?:هيئة\s*التخصصات\s*الصحية|تصنيف\s*صحي|SCFHS)/i.test(oneLineText)) {
    license = 'تصنيف الهيئة السعودية للتخصصات الصحية';
  } else if (/(?:SOCPA|محاسبين\s*ومراجعين|زمالة\s*سوكبا)/i.test(oneLineText)) {
    license = 'زمالة الهيئة السعودية للمحاسبين والمراجعين (SOCPA)';
  } else if (/(?:رخصة\s*محاماة|وزارة\s*العدل|ممارسة\s*المحاماة)/i.test(oneLineText)) {
    license = 'رخصة ممارسة المحاماة - وزارة العدل';
  } else if (/(?:رخصة\s*قيادة\s*عمومي|نقل\s*ثقيل)/i.test(oneLineText)) {
    license = 'رخصة قيادة عمومي / نقل ثقيل';
  } else if (/(?:رخصة\s*قيادة|Driving\s*License)/i.test(oneLineText)) {
    license = 'رخصة قيادة خاصة سارية';
  }

  // 8. استخراج المسمى الوظيفي المقترح / المستهدف
  let jobTitle = '';
  const titleMatch = cleanRaw.match(/(?:الهدف\s*الوظيفي|المسمى\s*الوظيفي|المسمى\s*الحالي|الوظيفة\s*المستهدفة|Job\s*Title|Objective|Position)[:\s\-]+([^\n,،.]{3,45})/i);
  if (titleMatch) {
    const rawMatch = titleMatch[1].trim();
    if (!/^(?:الحصول|العمل|تطوير|سيرة|طلب)/.test(rawMatch)) {
      jobTitle = rawMatch;
    }
  }

  if (!jobTitle) {
    const titleInference = [
      { regex: /موارد\s*بشرية/i, val: 'أخصائي موارد بشرية' },
      { regex: /(?:محاسبة|مالية)/i, val: 'محاسب مالي' },
      { regex: /(?:سياحة|فندقة|ضيافة)/i, val: 'مشرف خدمات وضيافة' },
      { regex: /(?:تسويق|إعلام|علاقات\s*عامة)/i, val: 'أخصائي تسويق وتواصل' },
      { regex: /(?:أمن\s*سيبراني|شبكات|حاسب|برمجيات|تقنية)/i, val: 'أخصائي تقنية معلومات ونظم' },
      { regex: /(?:قانون|أنظمة|حقوق)/i, val: 'مستشار قانوني / باحث أنظمة' },
      { regex: /(?:خدمة\s*عملاء|استقبال)/i, val: 'أخصائي خدمة عملاء' },
      { regex: /(?:إدارة\s*أعمال|إدارة\s*عامة)/i, val: 'منسق إداري وأعمال' }
    ];
    for (const item of titleInference) {
      if (item.regex.test(major) || item.regex.test(oneLineText)) {
        jobTitle = item.val;
        break;
      }
    }
  }
  if (!jobTitle) jobTitle = 'غير محدد';

  // 9. هل يوجد خبرات لم تذكر
  let unmentioned = 'لا';
  if (/(?:أعمال\s*حرة|تطوع|استشارات|خبرات\s*أخرى|عمل\s*حر)/i.test(oneLineText)) {
    unmentioned = 'نعم (أعمال حرة ومشاريع تطوعية)';
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTextFromPdf,
    parseCandidateFromText,
    normalizeDigits,
    fixReversedArabic
  };
}
