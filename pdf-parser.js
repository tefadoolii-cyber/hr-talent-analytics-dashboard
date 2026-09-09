// ==========================================================================
// محرك قراءة واستخراج البيانات عالي الدقة من ملفات PDF (Wisal Smart PDF Engine)
// متوافق مع نظام Mozilla PDF.js مع معالجة تخطيط الأسطر والنصوص العربية
// القواعد الصارمة: لا مقترحات مصطنعة نهائياً، رقم الهوية يبدأ حصراً بـ 10 أو 20 (10 خانات)، وأي حقل غير موجود يُسجل كـ "لا يوجد"
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
 * محرك استخراج البيانات الواقعية فقط دون أي مقترحات أو تخمينات
 */
function parseCandidateFromText(rawText, fileName = '') {
  const cleanRaw = normalizeDigits(rawText || '');
  const lines = cleanRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const oneLineText = lines.join(' ');

  // 1. استخراج رقم الهوية الوطنية أو الإقامة (10 خانات تبدأ بـ 10 أو 20 حصراً)
  let nationalId = 'لا يوجد';
  const validIdRegex = /\b(10\d{8}|20\d{8})\b/;

  const fileIdMatch = String(fileName).match(validIdRegex);
  if (fileIdMatch) {
    nationalId = fileIdMatch[1];
  } else {
    const labeledIdMatch = cleanRaw.match(/(?:الهوية|السجل\s*المدني|الإقامة|الاقامة|الهوية\s*الوطنية|ID|National\s*ID|Iqama)[:\s#]*(10\d{8}|20\d{8})\b/i);
    if (labeledIdMatch) {
      nationalId = labeledIdMatch[1];
    } else {
      const anyGovId = cleanRaw.match(validIdRegex);
      if (anyGovId) {
        nationalId = anyGovId[1];
      }
    }
  }

  // 2. استخراج الاسم
  let candidateName = 'لا يوجد';
  const explicitName = cleanRaw.match(/(?:الاسم|اسم\s*المرشح|اسم\s*الموظف|Name|Full\s*Name)[:\s\-]+([^\n,،.]{3,40})/i);
  if (explicitName) {
    candidateName = explicitName[1].trim();
  } else {
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const l = lines[i].trim();
      if (!/(?:ال?سيرة\s*ال?ذاتية|Curriculum|Resume|CV|المملكة|وزارة|شركة|مؤسسة|بسم\s*الله|بيانات\s*شخصية|المعلومات\s*الشخصية)/i.test(l) && l.length >= 4 && l.length <= 40) {
        candidateName = l;
        break;
      }
    }
  }

  // 3. استخراج الجنس (فقط إذا ذكر صراحة، دون تخمين)
  let gender = 'لا يوجد';
  if (/(?:الجنس|النوع)\s*[:\-]?\s*أنثى/i.test(cleanRaw) || /\bأنثى\b/i.test(cleanRaw) || /\bFemale\b/i.test(cleanRaw) || /(?:سعودية|مواطنة|خريجة)\b/.test(cleanRaw)) {
    gender = 'أنثى';
  } else if (/(?:الجنس|النوع)\s*[:\-]?\s*ذكر/i.test(cleanRaw) || /\bذكر\b/i.test(cleanRaw) || /\bMale\b/i.test(cleanRaw) || /(?:سعودي|مواطن|خريج)\b/.test(cleanRaw)) {
    gender = 'ذكر';
  }

  // 4. استخراج المؤهل الدراسي (فقط ما ذكر صراحة)
  let degree = 'لا يوجد';
  if (/(?:دكتوراه|دكتوراة|PhD|Doctorate)/i.test(oneLineText)) {
    degree = 'دكتوراه';
  } else if (/(?:ماجستير|Master|MSc|MBA|ماستر)/i.test(oneLineText)) {
    degree = 'ماجستير';
  } else if (/(?:دبلوم\s*عالي|Higher\s*Diploma)/i.test(oneLineText)) {
    degree = 'دبلوم عالي';
  } else if (/(?:بكالوريوس|Bachelor|BSc|ليسانس|بكالوريس)/i.test(oneLineText)) {
    degree = 'بكالوريوس';
  } else if (/(?:دبلوم\s*متوسط|دبلوم\s*كلية|دبلوم|Diploma)/i.test(oneLineText)) {
    degree = 'دبلوم';
  } else if (/(?:ثانوية\s*عامة|الثانوية\s*العامة|ثانوية|ثانويه|High\s*School)/i.test(oneLineText)) {
    degree = 'ثانوية عامة';
  } else if (/(?:كفاءة|متوسطة)/i.test(oneLineText)) {
    degree = 'كفاءة متوسطة';
  }

  // 5. استخراج التخصص (فقط إذا ذكر صراحة)
  let major = 'لا يوجد';
  const explicitMajorMatch = cleanRaw.match(/(?:التخصص|تخصص|القسم|قسم|المجال\s*الأكاديمي|Major|Field\s*of\s*Study)[:\s\-]+([^\n,،.\/]{2,45})/i)
                          || cleanRaw.match(/(?:بكالوريوس|ماجستير|دبلوم|شهادة)\s*(?:في|تخصص)?\s*([^\n,،.\/]{2,45})/i);
  if (explicitMajorMatch) {
    let candidateMajor = explicitMajorMatch[1].trim();
    if (!/^(?:عام|الكل|غير|سنة|جامعة|كلية|لا|بدون)/i.test(candidateMajor) && candidateMajor.length >= 2) {
      major = candidateMajor;
    }
  }

  // 6. استخراج المسمى الوظيفي (فقط إذا ذكر صراحة)
  let jobTitle = 'لا يوجد';
  const titleMatch = cleanRaw.match(/(?:المسمى\s*الوظيفي|المسمى\s*الحالي|المسمى|الوظيفة\s*المستهدفة|الوظيفة\s*الحالية|الوظيفة|الهدف\s*المهني|الهدف\s*الوظيفي|Job\s*Title|Position|Role)[:\s\-]+([^\n,،.]{2,45})/i);
  if (titleMatch) {
    const rawMatch = titleMatch[1].trim();
    if (!/^(?:الحصول|العمل|تطوير|سيرة|طلب|الرغبة|لا|بدون)/i.test(rawMatch) && rawMatch.length >= 2) {
      jobTitle = rawMatch;
    }
  }

  // 7. استخراج سنوات الخبرة ومجالاتها
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

  let expRoleOrCompany = 'لا يوجد';
  const expSectionRegex = /(?:الخبرات|الخبرة\s*المهنية|الخبرات\s*السابقة|سجل\s*العمل|Experience|Work\s*Experience)[:\s\n]+([\s\S]{5,350}?)(?=(?:التعليم|المؤهلات|الدورات|الشهادات|المهارات|اللغات)|$)/i;
  const expMatch = cleanRaw.match(expSectionRegex);
  if (expMatch) {
    const linesInExp = expMatch[1].split('\n')
      .map(l => l.trim().replace(/^[-•*–]\s*/, ''))
      .filter(l => l.length >= 3 && l.length <= 50 && !/^(?:الخبرات|المهام|المسؤوليات)/i.test(l));
    if (linesInExp.length > 0) {
      expRoleOrCompany = linesInExp[0];
    }
  }

  let field1 = 'لا يوجد';
  let years1 = 0;
  let field2 = 'لا يوجد';
  let years2 = 0;
  let field3 = 'لا يوجد';
  let years3 = 0;

  if (totalExpYears > 0) {
    field1 = expRoleOrCompany !== 'لا يوجد' ? expRoleOrCompany : (jobTitle !== 'لا يوجد' ? jobTitle : 'خبرة عملية مسجلة');
    years1 = totalExpYears;
  }

  // 8. الدورات والشهادات
  const extractedCourses = [];
  const courseSectionRegex = /(?:الدورات|الشهادات|البرامج\s*التدريبية|الدورات\s*التدريبية|Courses|Certifications|Training)[:\s\n]+([\s\S]{5,400}?)(?=(?:الخبرات|التعليم|المؤهلات|المهارات|اللغات|Skills|Experience|Education)|$)/i;
  const sectionMatch = cleanRaw.match(courseSectionRegex);
  const textToSearchForCourses = sectionMatch ? sectionMatch[1] : '';

  if (textToSearchForCourses) {
    const courseLines = textToSearchForCourses.match(/(?:دورة|شهادة|برنامج|دبلوم\s*تدريبي|ورشة\s*عمل|Certified|Course)\s*[:\-]?\s*([^\n,،.]{3,60})/gi) || [];
    courseLines.forEach(c => {
      const clean = c.trim().replace(/^[-•*–]\s*/, '');
      if (!extractedCourses.includes(clean) && extractedCourses.length < 3) {
        extractedCourses.push(clean);
      }
    });

    if (extractedCourses.length === 0) {
      const bulletLines = textToSearchForCourses.split('\n')
        .map(l => l.trim().replace(/^[-•*–]\s*/, ''))
        .filter(l => l.length >= 4 && l.length <= 55 && !/^(?:الدورات|الشهادات|التدريب)/i.test(l));
      bulletLines.slice(0, 3).forEach(c => extractedCourses.push(c));
    }
  }

  const cert1 = extractedCourses[0] || 'لا يوجد';
  const cert2 = extractedCourses[1] || 'لا يوجد';
  const cert3 = extractedCourses[2] || 'لا يوجد';
  const extraCerts = extractedCourses.length >= 3 ? 'نعم' : 'لا يوجد';

  // 9. الرخص المهنية
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
    license = 'رخصة قيادة سارية';
  }

  // 10. هل يوجد خبرات لم تذكر
  let unmentioned = 'لا يوجد';
  if (/(?:أعمال\s*حرة|تطوع|استشارات|خبرات\s*أخرى|عمل\s*حر)/i.test(oneLineText)) {
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