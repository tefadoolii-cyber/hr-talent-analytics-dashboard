// إعداد وتتبع حالة التطبيق
let talentData = [...INITIAL_TALENT_DATA];
let filteredData = [...talentData];
let charts = {};
let currentPage = 1;
let rowsPerPage = 15;
let currentSort = { column: 'id', direction: 'asc' };

// تعريف أسماء الأعمدة المعتمدة
const FIELD_NAMES = {
  id: "رقم الهويه",
  gender: "الجنس",
  degree: "المؤهل الدراسي",
  major: "التخصص",
  cert1: "الدورات والشهادات",
  cert2: "الدورات والشهادات 2",
  cert3: "الدورات والشهادات 3",
  extraCerts: "شهادات إضافية",
  totalExp: "عدد السنوات الخبره الاجماليه",
  totalExpMonths: "عدد شهور الخبرة الاجمالية",
  expField1: "مجال الخبره",
  expYears1: "عدد سنوات الخبره 1",
  expMonths1: "شهور الخبره 1",
  expField2: "مجال الخبره 2",
  expYears2: "عدد سنوات الخبره 2",
  expMonths2: "شهور الخبره 2",
  expField3: "مجال الخبره 3",
  expYears3: "عددسنوات الخبره 3",
  expMonths3: "شهور الخبره 3",
  unmentioned: "هل يوجد خبرات لم تذكر",
  jobTitle: "المسمى الوظيفي المقترح",
  license: "الرخص المهنية"
};

// ==========================================
// نظام حماية الدخول بكلمة مرور لمنصة وِصال (Wisal HR Auth)
// ==========================================
const AUTH_KEY = 'wisal_hr_auth_status';
const PASSWORD_STORAGE_KEY = 'wisal_hr_custom_password';
const DEFAULT_PASSWORDS = ['wisal2026', '123456', 'admin'];

function getMasterPassword() {
  return localStorage.getItem(PASSWORD_STORAGE_KEY) || 'wisal2026';
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true' || localStorage.getItem(AUTH_KEY) === 'true';
}

function checkAuthStatus() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  if (isAuthenticated()) {
    overlay.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  } else {
    overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => {
      document.getElementById('loginPasswordInput')?.focus();
    }, 100);
  }
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('loginPasswordInput');
  const errorMsg = document.getElementById('loginErrorMsg');
  const rememberMe = document.getElementById('rememberMeCheckbox')?.checked;
  const currentPassword = getMasterPassword();

  const entered = (input?.value || '').trim();

  if (entered === currentPassword || DEFAULT_PASSWORDS.includes(entered)) {
    if (rememberMe) {
      localStorage.setItem(AUTH_KEY, 'true');
    }
    sessionStorage.setItem(AUTH_KEY, 'true');

    if (errorMsg) errorMsg.classList.add('hidden');
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.classList.add('animate-out', 'fade-out', 'duration-300');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('animate-out', 'fade-out', 'duration-300');
        document.body.classList.remove('overflow-hidden');
      }, 250);
    }
  } else {
    if (errorMsg) {
      errorMsg.classList.remove('hidden');
      if (input) {
        input.classList.add('border-rose-500', 'bg-rose-50/30');
        setTimeout(() => {
          input.classList.remove('border-rose-500', 'bg-rose-50/30');
        }, 2000);
      }
    }
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById('loginPasswordInput');
  const icon = document.getElementById('passwordToggleIcon');
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function handleLogout() {
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
  const input = document.getElementById('loginPasswordInput');
  if (input) input.value = '';
  checkAuthStatus();
}

function openChangePasswordModal() {
  document.getElementById('changePasswordModal')?.classList.remove('hidden');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal')?.classList.add('hidden');
  const form = document.getElementById('changePasswordForm');
  if (form) form.reset();
}

function handleChangePasswordSubmit(e) {
  if (e) e.preventDefault();
  const form = e.target;
  const current = (form.currentPass?.value || '').trim();
  const newPass = (form.newPass?.value || '').trim();
  const confirmPass = (form.confirmPass?.value || '').trim();

  const realPass = getMasterPassword();

  if (current !== realPass && !DEFAULT_PASSWORDS.includes(current)) {
    alert('كلمة المرور الحالية غير صحيحة!');
    return;
  }
  if (!newPass || newPass.length < 4) {
    alert('يجب أن تتكون كلمة المرور الجديدة من 4 أحرف أو أرقام على الأقل.');
    return;
  }
  if (newPass !== confirmPass) {
    alert('كلمة المرور الجديدة غير متطابقة مع التأكيد!');
    return;
  }

  localStorage.setItem(PASSWORD_STORAGE_KEY, newPass);
  alert('تم تغيير كلمة مرور منصة وِصال بنجاح!\nكلمة المرور الجديدة هي: ' + newPass);
  closeChangePasswordModal();
}

window.handleLoginSubmit = handleLoginSubmit;
window.togglePasswordVisibility = togglePasswordVisibility;
window.handleLogout = handleLogout;
window.openChangePasswordModal = openChangePasswordModal;
window.closeChangePasswordModal = closeChangePasswordModal;
window.handleChangePasswordSubmit = handleChangePasswordSubmit;

// تهيئة التطبيق عند اكتمال تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  initDashboard();
  setupEventListeners();
});

function initDashboard() {
  populateFilterDropdowns();
  applyFilters();
  initCharts();
}

// تعبئة خيارات الفلاتر آلياً من واقع البيانات المتوفرة
function populateFilterDropdowns() {
  // المؤهلات الأكثر تكراراً
  const degreeCounts = {};
  talentData.forEach(d => {
    const deg = d[FIELD_NAMES.degree];
    if (deg && deg !== 'غير محدد') degreeCounts[deg] = (degreeCounts[deg] || 0) + 1;
  });
  const sortedDegrees = Object.entries(degreeCounts).sort((a, b) => b[1] - a[1]).map(e => e[0]);

  // التخصصات
  const majorCounts = {};
  talentData.forEach(d => {
    const m = d[FIELD_NAMES.major];
    if (m && m !== 'عام') majorCounts[m] = (majorCounts[m] || 0) + 1;
  });
  const sortedMajors = Object.entries(majorCounts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(e => e[0]);

  // المسميات المقترحة
  const jobCounts = {};
  talentData.forEach(d => {
    const j = d[FIELD_NAMES.jobTitle];
    if (j && j !== 'غير محدد') jobCounts[j] = (jobCounts[j] || 0) + 1;
  });
  const sortedJobs = Object.entries(jobCounts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(e => e[0]);

  fillSelectOptions('filterDegree', sortedDegrees);
  fillSelectOptions('filterMajor', sortedMajors);
  fillSelectOptions('filterJobTitle', sortedJobs);

  // الدورات والشهادات الأكثر تكراراً
  const courseCounts = {};
  talentData.forEach(d => {
    ['cert1', 'cert2', 'cert3'].forEach(k => {
      let c = String(d[FIELD_NAMES[k]] || '').trim();
      if (c && !['—', '-', 'لا يوجد', '0', 'لا', 'لا يوجد دورات مذكورة'].includes(c)) {
        courseCounts[c] = (courseCounts[c] || 0) + 1;
      }
    });
  });
  const sortedCourses = Object.entries(courseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 70);

  const courseSelect = document.getElementById('filterCourse');
  if (courseSelect) {
    const currentVal = courseSelect.value;
    courseSelect.innerHTML = `
      <option value="">الكل (جميع الدورات)</option>
      <option value="__has_certs__">⭐️ الحاصلين على دورات تدريبية</option>
      <option value="__no_certs__">بدون دورات مسجلة</option>
    `;
    const optGroup = document.createElement('optgroup');
    optGroup.label = 'أبرز وأكثر الدورات شيوعاً';
    sortedCourses.forEach(([courseName, count]) => {
      const opt = document.createElement('option');
      opt.value = courseName;
      opt.textContent = `${courseName} (${count.toLocaleString('ar-SA')})`;
      optGroup.appendChild(opt);
    });
    courseSelect.appendChild(optGroup);
    courseSelect.value = currentVal;
  }
}

function fillSelectOptions(selectId, items) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">الكل</option>';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
  select.value = currentValue;
}

// تطبيق جميع الفلاتر والبحث اللحظي
function applyFilters() {
  const searchQuery = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const gender = document.getElementById('filterGender')?.value || '';
  const degree = document.getElementById('filterDegree')?.value || '';
  const major = document.getElementById('filterMajor')?.value || '';
  const jobTitle = document.getElementById('filterJobTitle')?.value || '';
  const licenseFilter = document.getElementById('filterLicense')?.value || '';
  const unmentionedFilter = document.getElementById('filterUnmentioned')?.value || '';
  const selectedCourse = document.getElementById('filterCourse')?.value || '';
  const courseSearch = (document.getElementById('filterCourseText')?.value || '').trim().toLowerCase();
  const minExp = parseFloat(document.getElementById('filterMinExp')?.value) || 0;
  const maxExp = parseFloat(document.getElementById('filterMaxExp')?.value) || 999;

  filteredData = talentData.filter(item => {
    // 1. بحث عام (رقم الهوية، المسمى، التخصص، الشهادات، الرخص)
    if (searchQuery) {
      const idStr = String(item[FIELD_NAMES.id] || '').toLowerCase();
      const majorStr = String(item[FIELD_NAMES.major] || '').toLowerCase();
      const titleStr = String(item[FIELD_NAMES.jobTitle] || '').toLowerCase();
      const licenseStr = String(item[FIELD_NAMES.license] || '').toLowerCase();
      const certsStr = `${item[FIELD_NAMES.cert1]} ${item[FIELD_NAMES.cert2]} ${item[FIELD_NAMES.cert3]}`.toLowerCase();
      const fieldsStr = `${item[FIELD_NAMES.expField1]} ${item[FIELD_NAMES.expField2]} ${item[FIELD_NAMES.expField3]}`.toLowerCase();

      const matchesSearch = idStr.includes(searchQuery) ||
                            majorStr.includes(searchQuery) ||
                            titleStr.includes(searchQuery) ||
                            licenseStr.includes(searchQuery) ||
                            certsStr.includes(searchQuery) ||
                            fieldsStr.includes(searchQuery);
      if (!matchesSearch) return false;
    }

    // 2. فلتر الجنس
    if (gender) {
      let g = item[FIELD_NAMES.gender];
      if (g === 'انثى') g = 'أنثى';
      if (g !== gender) return false;
    }

    // 3. فلتر المؤهل
    if (degree && item[FIELD_NAMES.degree] !== degree) return false;

    // 4. فلتر التخصص
    if (major && item[FIELD_NAMES.major] !== major) return false;

    // 5. فلتر المسمى المقترح
    if (jobTitle && item[FIELD_NAMES.jobTitle] !== jobTitle) return false;

    // 6. فلتر الرخص المهنية
    if (licenseFilter === 'yes') {
      const lic = String(item[FIELD_NAMES.license] || '').trim();
      if (!lic || lic === 'لا يوجد' || lic === 'بدون' || lic === 'لا' || lic === '-' || lic === '0') return false;
    } else if (licenseFilter === 'no') {
      const lic = String(item[FIELD_NAMES.license] || '').trim();
      if (lic && lic !== 'لا يوجد' && lic !== 'بدون' && lic !== 'لا' && lic !== '-' && lic !== '0') return false;
    }

    // 7. فلتر خبرات لم تذكر
    if (unmentionedFilter === 'yes') {
      const unm = String(item[FIELD_NAMES.unmentioned] || '').trim().toLowerCase();
      if (!unm.startsWith('نعم')) return false;
    } else if (unmentionedFilter === 'no') {
      const unm = String(item[FIELD_NAMES.unmentioned] || '').trim().toLowerCase();
      if (unm.startsWith('نعم')) return false;
    }

    // 8. فلتر سنوات الخبرة الإجمالية
    const exp = parseFloat(item[FIELD_NAMES.totalExp]) || 0;
    if (exp < minExp || exp > maxExp) return false;

    // 9. فلترة الدورات والشهادات التدريبية (من القائمة المنسدلة)
    if (selectedCourse) {
      const c1 = String(item[FIELD_NAMES.cert1] || '').trim();
      const c2 = String(item[FIELD_NAMES.cert2] || '').trim();
      const c3 = String(item[FIELD_NAMES.cert3] || '').trim();
      const allC = `${c1} ${c2} ${c3}`.replace(/[—\-\s0]/g, '');
      const hasValidCert = allC.length > 0 && !allC.includes('لايوجد');

      if (selectedCourse === '__has_certs__') {
        if (!hasValidCert) return false;
      } else if (selectedCourse === '__no_certs__') {
        if (hasValidCert) return false;
      } else {
        const target = selectedCourse.toLowerCase();
        if (!c1.toLowerCase().includes(target) && !c2.toLowerCase().includes(target) && !c3.toLowerCase().includes(target)) {
          return false;
        }
      }
    }

    // 10. بحث نصي مباشر في الدورات والشهادات
    if (courseSearch) {
      const certsCombined = `${item[FIELD_NAMES.cert1]} ${item[FIELD_NAMES.cert2]} ${item[FIELD_NAMES.cert3]}`.toLowerCase();
      if (!certsCombined.includes(courseSearch)) return false;
    }

    return true;
  });

  currentPage = 1;
  updateKPIs();
  updateCharts();
  renderTable();
}

// إعادة ضبط الفلاتر
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterGender').value = '';
  document.getElementById('filterDegree').value = '';
  document.getElementById('filterMajor').value = '';
  document.getElementById('filterJobTitle').value = '';
  document.getElementById('filterLicense').value = '';
  document.getElementById('filterCourse').value = '';
  document.getElementById('filterCourseText').value = '';
  document.getElementById('filterUnmentioned').value = '';
  document.getElementById('filterMinExp').value = '';
  document.getElementById('filterMaxExp').value = '';
  applyFilters();
}

// تحديث بطاقات المؤشرات الرئيسية (KPIs)
function updateKPIs() {
  const total = filteredData.length;
  document.getElementById('kpiTotal').textContent = total.toLocaleString('ar-SA');

  if (total === 0) {
    document.getElementById('kpiAvgExp').textContent = '0 سنة';
    document.getElementById('kpiMaleCount').textContent = '0 (0%)';
    document.getElementById('kpiFemaleCount').textContent = '0 (0%)';
    document.getElementById('kpiLicenseCount').textContent = '0 (0%)';
    document.getElementById('kpiExtraExpCount').textContent = '0 (0%)';
    document.getElementById('kpiTopMajor').textContent = 'لا توجد نتائج';
    return;
  }

  // متوسط سنوات الخبرة
  const totalYears = filteredData.reduce((acc, curr) => acc + (parseFloat(curr[FIELD_NAMES.totalExp]) || 0), 0);
  const avgExp = (totalYears / total).toFixed(1);
  const avgMonths = (filteredData.reduce((acc, curr) => acc + (parseFloat(curr[FIELD_NAMES.totalExpMonths]) || 0), 0) / total).toFixed(0);
  document.getElementById('kpiAvgExp').textContent = `${avgExp} سنة (${avgMonths} شهر)`;

  // توزيع الجنس
  const males = filteredData.filter(d => d[FIELD_NAMES.gender] === 'ذكر').length;
  const females = filteredData.filter(d => d[FIELD_NAMES.gender] === 'أنثى' || d[FIELD_NAMES.gender] === 'انثى').length;
  const malePct = ((males / total) * 100).toFixed(0);
  const femalePct = ((females / total) * 100).toFixed(0);
  document.getElementById('kpiMaleCount').textContent = `${males} (${malePct}%)`;
  document.getElementById('kpiFemaleCount').textContent = `${females} (${femalePct}%)`;

  // أصحاب الرخص المهنية
  const hasLicense = filteredData.filter(d => {
    const lic = String(d[FIELD_NAMES.license] || '').trim();
    return lic && lic !== 'لا يوجد' && lic !== 'بدون' && lic !== 'لا' && lic !== '-' && lic !== '0';
  }).length;
  const licPct = ((hasLicense / total) * 100).toFixed(1);
  document.getElementById('kpiLicenseCount').textContent = `${hasLicense} (${licPct}%)`;

  // خبرات إضافية غير مذكورة
  const extraExp = filteredData.filter(d => {
    const str = String(d[FIELD_NAMES.unmentioned] || '').trim().toLowerCase();
    return str.startsWith('نعم');
  }).length;
  const extraPct = ((extraExp / total) * 100).toFixed(1);
  document.getElementById('kpiExtraExpCount').textContent = `${extraExp} (${extraPct}%)`;

  // أكثر التخصصات شيوعاً
  const majorCounts = {};
  filteredData.forEach(d => {
    const m = d[FIELD_NAMES.major];
    if (m && m !== 'عام') majorCounts[m] = (majorCounts[m] || 0) + 1;
  });
  const sortedMajors = Object.entries(majorCounts).sort((a, b) => b[1] - a[1]);
  if (document.getElementById('kpiTopMajor')) {
    document.getElementById('kpiTopMajor').textContent = sortedMajors.length ? `${sortedMajors[0][0]} (${sortedMajors[0][1]})` : '—';
  }
}

// إعداد ورسم المخططات البيانية التفاعلية (Chart.js)
function initCharts() {
  Chart.defaults.font.family = "'Cairo', 'Segoe UI', sans-serif";
  Chart.defaults.color = '#475569';

  // 1. مخطط توزيع المؤهلات
  const ctxDegree = document.getElementById('chartDegree')?.getContext('2d');
  if (ctxDegree) {
    charts.degree = new Chart(ctxDegree, {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'] }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } }
        }
      }
    });
  }

  // 2. مخطط فئات سنوات الخبرة
  const ctxExp = document.getElementById('chartExp')?.getContext('2d');
  if (ctxExp) {
    charts.exp = new Chart(ctxExp, {
      type: 'bar',
      data: {
        labels: ['بدون خبرة', '1-2 سنة', '3-5 سنوات', '6-9 سنوات', '10+ سنوات'],
        datasets: [{
          label: 'عدد الكوادر',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#0d9488',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 3. مخطط أكثر التخصصات
  const ctxMajor = document.getElementById('chartMajor')?.getContext('2d');
  if (ctxMajor) {
    charts.major = new Chart(ctxMajor, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'العدد', data: [], backgroundColor: '#6366f1', borderRadius: 6 }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // 4. مخطط المسميات الوظيفية المقترحة
  const ctxJob = document.getElementById('chartJob')?.getContext('2d');
  if (ctxJob) {
    charts.job = new Chart(ctxJob, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'المرشحون', data: [], backgroundColor: '#3b82f6', borderRadius: 6 }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // 5. مخطط الرخص المهنية
  const ctxLicense = document.getElementById('chartLicense')?.getContext('2d');
  if (ctxLicense) {
    charts.license = new Chart(ctxLicense, {
      type: 'pie',
      data: {
        labels: ['يحمل رخصة مهنية معتمدة', 'بدون رخصة مسجلة'],
        datasets: [{ data: [0, 0], backgroundColor: ['#10b981', '#e2e8f0'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  updateCharts();
}

// تحديث بيانات المخططات ديناميكياً بناءً على البيانات المفلترة
function updateCharts() {
  if (!charts.degree) return;

  // 1. تحديث المؤهل (أعلى 6 مؤهلات والباقي أخرى)
  const degCounts = {};
  filteredData.forEach(d => {
    const k = d[FIELD_NAMES.degree] || 'غير محدد';
    degCounts[k] = (degCounts[k] || 0) + 1;
  });
  const sortedDegs = Object.entries(degCounts).sort((a, b) => b[1] - a[1]);
  const topDegs = sortedDegs.slice(0, 6);
  const otherDegCount = sortedDegs.slice(6).reduce((acc, curr) => acc + curr[1], 0);

  const degLabels = topDegs.map(e => e[0]);
  const degValues = topDegs.map(e => e[1]);
  if (otherDegCount > 0) {
    degLabels.push('مؤهلات أخرى');
    degValues.push(otherDegCount);
  }

  charts.degree.data.labels = degLabels;
  charts.degree.data.datasets[0].data = degValues;
  charts.degree.update();

  // 2. تحديث فئات الخبرة
  const expBins = [0, 0, 0, 0, 0];
  filteredData.forEach(d => {
    const exp = parseFloat(d[FIELD_NAMES.totalExp]) || 0;
    if (exp === 0) expBins[0]++;
    else if (exp <= 2) expBins[1]++;
    else if (exp <= 5) expBins[2]++;
    else if (exp <= 9) expBins[3]++;
    else expBins[4]++;
  });
  charts.exp.data.datasets[0].data = expBins;
  charts.exp.update();

  // 3. تحديث أعلى التخصصات (أول 7 تخصصات محددة)
  const majorCounts = {};
  filteredData.forEach(d => {
    const m = d[FIELD_NAMES.major] || 'عام';
    if (m !== 'عام') majorCounts[m] = (majorCounts[m] || 0) + 1;
  });
  const sortedMajors = Object.entries(majorCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  charts.major.data.labels = sortedMajors.map(m => m[0]);
  charts.major.data.datasets[0].data = sortedMajors.map(m => m[1]);
  charts.major.update();

  // 4. تحديث المسميات المقترحة (أول 7 مسميات محددة)
  const jobCounts = {};
  filteredData.forEach(d => {
    const j = d[FIELD_NAMES.jobTitle] || 'غير محدد';
    if (j !== 'غير محدد') jobCounts[j] = (jobCounts[j] || 0) + 1;
  });
  const sortedJobs = Object.entries(jobCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  charts.job.data.labels = sortedJobs.map(j => j[0]);
  charts.job.data.datasets[0].data = sortedJobs.map(j => j[1]);
  charts.job.update();

  // 5. تحديث الرخص المهنية
  let withLic = 0;
  let withoutLic = 0;
  filteredData.forEach(d => {
    const lic = String(d[FIELD_NAMES.license] || '').trim();
    if (lic && lic !== 'لا يوجد' && lic !== 'بدون' && lic !== 'لا' && lic !== '-' && lic !== '0') withLic++;
    else withoutLic++;
  });
  charts.license.data.datasets[0].data = [withLic, withoutLic];
  charts.license.update();
}

// عرض جدول البيانات مع الترقيم والأزرار التفاعلية
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const recordCountBadge = document.getElementById('recordCountBadge');

  if (recordCountBadge) {
    recordCountBadge.textContent = `${filteredData.length.toLocaleString('ar-SA')} سجل متاح`;
  }

  if (filteredData.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    renderPagination();
    return;
  }

  emptyState.classList.add('hidden');

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filteredData.length);
  const currentRows = filteredData.slice(startIndex, endIndex);

  let html = '';
  currentRows.forEach((row, idx) => {
    const actualIdx = startIndex + idx;
    const isFemale = row[FIELD_NAMES.gender] === 'أنثى' || row[FIELD_NAMES.gender] === 'انثى';
    const genderBadge = isFemale
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700"><i class="fa-solid fa-venus"></i> أنثى</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><i class="fa-solid fa-mars"></i> ذكر</span>`;

    const licStr = String(row[FIELD_NAMES.license] || '').trim();
    const hasLic = licStr && !['لا يوجد', 'بدون', 'لا', '-', '0'].includes(licStr);
    const licenseBadge = hasLic
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200" title="${licStr}"><i class="fa-solid fa-award"></i> ${licStr}</span>`
      : `<span class="text-xs text-slate-400">لا يوجد</span>`;

    const expYears = row[FIELD_NAMES.totalExp] || 0;
    const expMonths = row[FIELD_NAMES.totalExpMonths] || 0;

    html += `
      <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
        <td class="px-4 py-3 font-mono text-xs font-bold text-slate-800">${row[FIELD_NAMES.id] || '—'}</td>
        <td class="px-4 py-3 text-xs">${genderBadge}</td>
        <td class="px-4 py-3 text-xs font-medium text-slate-700">${row[FIELD_NAMES.degree] || '—'}</td>
        <td class="px-4 py-3 text-xs text-slate-700 font-medium">${row[FIELD_NAMES.major] || '—'}</td>
        <td class="px-4 py-3 text-xs font-semibold text-indigo-700">${row[FIELD_NAMES.jobTitle] || '—'}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-bold text-xs" title="${expMonths} شهر">
            ${expYears} سنة
          </span>
        </td>
        <td class="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title="${row[FIELD_NAMES.expField1] || ''}">
          ${row[FIELD_NAMES.expField1] || '—'}
        </td>
        <td class="px-4 py-3 text-xs">${licenseBadge}</td>
        <td class="px-4 py-3 text-center whitespace-nowrap">
          <button onclick="viewProfile(${actualIdx})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 shadow-xs">
            <i class="fa-regular fa-id-card"></i> الملف الكامل
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  renderPagination();
}

// بناء عناصر ترقيم الصفحات (Pagination)
function renderPagination() {
  const container = document.getElementById('paginationControls');
  const info = document.getElementById('paginationInfo');
  if (!container || !info) return;

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const start = filteredData.length ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const end = Math.min(currentPage * rowsPerPage, filteredData.length);

  info.textContent = `عرض ${start.toLocaleString('ar-SA')} إلى ${end.toLocaleString('ar-SA')} من أصل ${filteredData.length.toLocaleString('ar-SA')} سجل`;

  let btns = '';
  // السابق
  btns += `
    <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
      <i class="fa-solid fa-chevron-right ml-1"></i> السابق
    </button>
  `;

  // أزرار أرقام الصفحات الذكية
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    btns += `<button onclick="changePage(1)" class="px-2.5 py-1.5 text-xs rounded-md border bg-white text-slate-700 hover:bg-slate-50 border-slate-200">1</button>`;
    if (startPage > 2) btns += `<span class="px-1 text-slate-400">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200';
    btns += `
      <button onclick="changePage(${i})" class="px-2.5 py-1.5 text-xs rounded-md border ${activeClass}">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) btns += `<span class="px-1 text-slate-400">...</span>`;
    btns += `<button onclick="changePage(${totalPages})" class="px-2.5 py-1.5 text-xs rounded-md border bg-white text-slate-700 hover:bg-slate-50 border-slate-200">${totalPages}</button>`;
  }

  // التالي
  btns += `
    <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
      التالي <i class="fa-solid fa-chevron-left mr-1"></i>
    </button>
  `;

  container.innerHTML = btns;
}

function changePage(page) {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
}

function changeRowsPerPage(val) {
  rowsPerPage = parseInt(val) || 15;
  currentPage = 1;
  renderTable();
}

// فتح نافذة الملف الشامل للمرشح (Modal Profile Card) بجميع تفاصيل الـ 18 حقلاً
function viewProfile(dataIndex) {
  const item = filteredData[dataIndex];
  if (!item) return;

  const modal = document.getElementById('profileModal');
  const modalContent = document.getElementById('profileModalBody');

  const isFemale = item[FIELD_NAMES.gender] === 'أنثى' || item[FIELD_NAMES.gender] === 'انثى';
  const avatarBg = isFemale ? 'bg-pink-100 text-pink-600 border-pink-200' : 'bg-blue-100 text-blue-600 border-blue-200';
  const icon = isFemale ? 'fa-female' : 'fa-male';

  const unmentionedExtra = String(item[FIELD_NAMES.unmentioned] || 'لا');
  const hasExtraExp = unmentionedExtra.toLowerCase().startsWith('نعم');

  const extraCerts = String(item[FIELD_NAMES.extraCerts] || 'لا');
  const hasExtraCerts = extraCerts.toLowerCase().startsWith('نعم');

  modalContent.innerHTML = `
    <!-- رأس البطاقة -->
    <div class="flex flex-col sm:flex-row items-center gap-4 p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200/80 mb-5">
      <div class="w-16 h-16 rounded-2xl ${avatarBg} border-2 flex items-center justify-center text-2xl shadow-xs">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="text-center sm:text-right flex-1">
        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
          <span class="text-lg font-black text-slate-800 font-mono tracking-wider">${item[FIELD_NAMES.id]}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isFemale ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}">
            ${item[FIELD_NAMES.gender]}
          </span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
            ${item[FIELD_NAMES.degree]}
          </span>
        </div>
        <h3 class="text-base font-bold text-indigo-700">${item[FIELD_NAMES.jobTitle] || 'المسمى غير محدد'}</h3>
        <p class="text-xs text-slate-600 font-medium">${item[FIELD_NAMES.major] || 'التخصص غير محدد'}</p>
      </div>
      <div class="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs text-center">
        <span class="text-[11px] text-slate-500 block mb-0.5 font-medium">الخبرة الإجمالية</span>
        <span class="text-xl font-black text-emerald-600">${item[FIELD_NAMES.totalExp] || 0} سنة</span>
        <span class="text-[11px] text-slate-400 block font-medium">(${item[FIELD_NAMES.totalExpMonths] || 0} شهر)</span>
      </div>
    </div>

    <!-- شبكة التفاصيل المقسمة لأقسام واضحة -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      
      <!-- القسم 1: الشهادات والدورات التدريبية -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div class="flex justify-between items-center pb-2 mb-3 border-b border-slate-100">
          <h4 class="font-bold text-slate-800 flex items-center gap-2 text-indigo-600 text-xs">
            <i class="fa-solid fa-graduation-cap"></i> الدورات والشهادات المعتمدة
          </h4>
          <span class="px-2 py-0.5 rounded text-[11px] font-bold ${hasExtraCerts ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}">
            شهادات أخرى غير مذكورة: ${extraCerts}
          </span>
        </div>
        <div class="space-y-2">
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span class="text-[10px] text-slate-400 block mb-0.5">الدورات والشهادات 1</span>
            <span class="font-semibold text-slate-800 text-xs">${item[FIELD_NAMES.cert1] || '—'}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span class="text-[10px] text-slate-400 block mb-0.5">الدورات والشهادات 2</span>
            <span class="font-semibold text-slate-800 text-xs">${item[FIELD_NAMES.cert2] || '—'}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span class="text-[10px] text-slate-400 block mb-0.5">الدورات والشهادات 3</span>
            <span class="font-semibold text-slate-800 text-xs">${item[FIELD_NAMES.cert3] || '—'}</span>
          </div>
        </div>
      </div>

      <!-- القسم 2: الرخص المهنية والخبرات غير المذكورة -->
      <div class="space-y-3">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 text-emerald-600 text-xs">
            <i class="fa-solid fa-certificate"></i> الرخص المهنية
          </h4>
          <div class="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <span class="font-bold text-emerald-800 text-xs leading-relaxed">${item[FIELD_NAMES.license] || 'لا توجد رخص مهنية مسجلة'}</span>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h4 class="font-bold text-slate-800 mb-2 flex items-center gap-2 pb-1.5 border-b border-slate-100 text-amber-600 text-xs">
            <i class="fa-solid fa-circle-question"></i> هل يوجد خبرات لم تذكر؟
          </h4>
          <div class="p-2.5 rounded-lg ${hasExtraExp ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'} border">
            <span class="font-semibold ${hasExtraExp ? 'text-amber-800' : 'text-slate-600'} text-xs">
              ${item[FIELD_NAMES.unmentioned] || 'لا'}
            </span>
          </div>
        </div>
      </div>

      <!-- القسم 3: مجالات وسنوات الخبرة الثلاث -->
      <div class="md:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2 pb-2 border-b border-slate-100 text-blue-600 text-xs">
          <i class="fa-solid fa-briefcase"></i> سجل مجالات وسنوات الخبرة التفصيلية (1 و 2 و 3)
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- مجال الخبرة 1 -->
          <div class="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[11px] font-bold text-blue-800">مجال الخبرة (1)</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                ${item[FIELD_NAMES.expYears1] || 0} سنة (${item[FIELD_NAMES.expMonths1] || 0} ش)
              </span>
            </div>
            <p class="text-slate-700 text-xs font-medium">${item[FIELD_NAMES.expField1] || 'غير محدد'}</p>
          </div>

          <!-- مجال الخبرة 2 -->
          <div class="p-3 bg-purple-50/40 rounded-xl border border-purple-100">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[11px] font-bold text-purple-800">مجال الخبرة (2)</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">
                ${item[FIELD_NAMES.expYears2] || 0} سنة (${item[FIELD_NAMES.expMonths2] || 0} ش)
              </span>
            </div>
            <p class="text-slate-700 text-xs font-medium">${item[FIELD_NAMES.expField2] || 'غير محدد'}</p>
          </div>

          <!-- مجال الخبرة 3 -->
          <div class="p-3 bg-teal-50/40 rounded-xl border border-teal-100">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[11px] font-bold text-teal-800">مجال الخبرة (3)</span>
              <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800">
                ${item[FIELD_NAMES.expYears3] || 0} سنة (${item[FIELD_NAMES.expMonths3] || 0} ش)
              </span>
            </div>
            <p class="text-slate-700 text-xs font-medium">${item[FIELD_NAMES.expField3] || 'غير محدد'}</p>
          </div>
        </div>
      </div>

    </div>
  `;

  modal.classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profileModal')?.classList.add('hidden');
}

// تصدير البيانات المعروضة حالياً إلى ملف Excel
function exportToExcel() {
  const exportCols = [
    "رقم الهويه",
    "الجنس",
    "المؤهل الدراسي",
    "التخصص",
    "الدورات والشهادات",
    "الدورات والشهادات 2",
    "الدورات والشهادات 3",
    "شهادات إضافية",
    "عدد السنوات الخبره الاجماليه",
    "عدد شهور الخبرة الاجمالية",
    "مجال الخبره",
    "عدد سنوات الخبره 1",
    "مجال الخبره 2",
    "عدد سنوات الخبره 2",
    "مجال الخبره 3",
    "عددسنوات الخبره 3",
    "هل يوجد خبرات لم تذكر",
    "المسمى الوظيفي المقترح",
    "الرخص المهنية"
  ];

  const rows = filteredData.map(item => exportCols.map(h => item[h] !== undefined ? item[h] : ''));
  const aoa = [exportCols, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيانات الفرز والكوادر");

  const fileName = `تصدير_بيانات_الكوادر_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// تنزيل قالب إكسيل فارغ
function downloadBlankTemplate() {
  const headers = [
    "رقم الهوية",
    "الجنس",
    "المؤهل الدراسي",
    "التخصص",
    "الدورات والشهادات1",
    "الدورات والشهادات2",
    "الدورات والشهادات3",
    "هل يوجد شهادات ودورات غير المذكورة ادناه؟",
    "عدد سنوات الخبرة الاجمالية",
    "مجال الخبرة 1",
    "عدد سنوات الخبرة 1",
    "مجال الخبرة 2",
    "عدد سنوات الخبرة 2",
    "مجال الخبرة 3",
    "عدد سنوات الخبرة 3",
    "هل يوجد خبرات غير المذكوره ادناه؟",
    "المسمى الوظيفي المقترح",
    "الرخص المهنية"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "قالب فارغ للإدخال");
  XLSX.writeFile(wb, "قالب_إدخال_البيانات.xlsx");
}

// استيراد وقراءة ملف إكسيل (.xlsx / .xls / .csv)
function handleFileUpload(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        alert('ملف الإكسيل فارغ!');
        return;
      }

      // تطبيع وتوحيد أسماء الحقول للبحث المرن في الإكسيل
      function normalizeKey(str) {
        return String(str || '')
          .replace(/[\s_—\-]/g, '')
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .toLowerCase();
      }

      function getClean(r, patterns) {
        if (!Array.isArray(patterns)) patterns = [patterns];
        const normPatterns = patterns.map(normalizeKey);
        for (const [k, v] of Object.entries(r)) {
          const normK = normalizeKey(k);
          for (const np of normPatterns) {
            if (normK === np || normK.includes(np)) {
              if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
          }
        }
        return '';
      }

      // دالة تحليل الخبرة والتأكد التام من وضع 0 عند عدم وجود خبرات مسجلة
      function parseExperience(val) {
        if (val === null || val === undefined) return { years: 0, months: 0 };
        const s = String(val).trim();
        if (!s || /^(?:لا\s*يوجد|بدون|بدون\s*خبرة|لا\s*توجد|حديث\s*تخرج|حديثة\s*تخرج|لا|0|-|—|null|none|nan|false|no)$/i.test(s)) {
          return { years: 0, months: 0 };
        }
        const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
        if (!m) return { years: 0, months: 0 };
        let n = parseFloat(m[1]);
        if (isNaN(n) || n <= 0) return { years: 0, months: 0 };

        if (/شهر|months?/i.test(s)) {
          const mths = Math.round(n);
          return { years: +(mths / 12).toFixed(1), months: mths };
        }
        if (n > 45 && n <= 600) {
          // مخزن بالشهور في بعض ملفات الموارد البشرية
          const mths = Math.round(n);
          return { years: +(mths / 12).toFixed(1), months: mths };
        }
        if (n > 600) {
          return { years: 0, months: 0 };
        }
        // مخزن بالسنوات (من 0 إلى 45 سنة)
        const yrs = +n.toFixed(1);
        return { years: yrs, months: Math.round(yrs * 12) };
      }

      // خريطة لتتبع السجلات الحالية برقم الهوية لتجنب التكرار وتحديث الموجود
      const existingIdMap = new Map();
      talentData.forEach((item, index) => {
        const id = String(item[FIELD_NAMES.id] || '').trim();
        if (id) existingIdMap.set(id, index);
      });

      let addedCount = 0;
      let updatedCount = 0;

      jsonData.forEach((row, idx) => {
        let g = String(getClean(row, ['الجنس', 'النوع'])).trim() || 'غير محدد';
        if (g === 'انثى') g = 'أنثى';

        const totalExpObj = parseExperience(getClean(row, [
          'عدد سنوات الخبرة الاجمالية',
          'عدد السنوات الخبره الاجماليه',
          'عدد سنوات الخبرة الإجمالية',
          'سنوات الخبرة الاجمالية',
          'سنوات الخبرة',
          'الخبرة الاجمالية',
          'الخبرة'
        ]));

        let totalExpYears = totalExpObj.years;
        let totalExpMonths = totalExpObj.months;

        const expObj1 = parseExperience(getClean(row, ['عدد سنوات الخبرة 1', 'عدد سنوات الخبره 1', 'سنوات الخبرة 1']));
        const expObj2 = parseExperience(getClean(row, ['عدد سنوات الخبرة 2', 'عدد سنوات الخبره 2', 'سنوات الخبرة 2']));
        const expObj3 = parseExperience(getClean(row, ['عدد سنوات الخبرة 3', 'عددسنوات الخبره 3', 'عدد سنوات الخبره 3', 'سنوات الخبرة 3']));

        let expYears1 = expObj1.years;
        let expMonths1 = expObj1.months;
        let expYears2 = expObj2.years;
        let expMonths2 = expObj2.months;
        let expYears3 = expObj3.years;
        let expMonths3 = expObj3.months;

        // عند عدم وجود خبرات مسجلة يوضع 0 صراحة
        if (totalExpYears === 0) {
          totalExpYears = 0;
          totalExpMonths = 0;
          expYears1 = 0;
          expMonths1 = 0;
          expYears2 = 0;
          expMonths2 = 0;
          expYears3 = 0;
          expMonths3 = 0;
        }

        let field1 = String(getClean(row, ['مجال الخبرة 1', 'مجال الخبره 1', 'مجال الخبرة', 'مجال الخبره'])).trim();
        let field2 = String(getClean(row, ['مجال الخبرة 2', 'مجال الخبره 2'])).trim();
        let field3 = String(getClean(row, ['مجال الخبرة 3', 'مجال الخبره 3'])).trim();

        if (totalExpYears === 0) {
          field1 = field1 && field1 !== '-' && field1 !== '0' ? field1 : 'لا يوجد خبرات مسجلة (بدون خبرة)';
          field2 = field2 && field2 !== '-' && field2 !== '0' ? field2 : '—';
          field3 = field3 && field3 !== '-' && field3 !== '0' ? field3 : '—';
        } else {
          field1 = field1 || '—';
          field2 = field2 || '—';
          field3 = field3 || '—';
        }

        let unmentioned = String(getClean(row, ['هل يوجد خبرات غير المذكوره ادناه؟', 'هل يوجد خبرات غير المذكورة ادناه؟', 'هل يوجد خبرات لم تذكر', 'خبرات لم تذكر'])).trim() || 'لا';
        if (unmentioned === '-' || unmentioned === '0') unmentioned = 'لا';

        let license = String(getClean(row, ['الرخص المهنية', 'الرخصة المهنية', 'الرخصه المهنيه'])).trim() || 'لا يوجد';
        if (license === '-' || license === '0' || license === 'بدون' || license === 'لا') license = 'لا يوجد';

        const idNum = String(getClean(row, ['رقم الهوية', 'رقم الهويه', 'الهوية']) || (1000000000 + talentData.length + idx)).trim();

        const record = {
          id: Date.now() + idx,
          "رقم الهويه": idNum,
          "الجنس": g,
          "المؤهل الدراسي": String(getClean(row, ['المؤهل الدراسي', 'المؤهل'])).trim() || 'غير محدد',
          "التخصص": String(getClean(row, ['التخصص', 'تخصص'])).trim() || 'عام',
          "الدورات والشهادات": String(getClean(row, ['الدورات والشهادات1', 'الدورات والشهادات 1', 'الدورات والشهادات'])).trim() || '—',
          "الدورات والشهادات 2": String(getClean(row, ['الدورات والشهادات2', 'الدورات والشهادات 2'])).trim() || '—',
          "الدورات والشهادات 3": String(getClean(row, ['الدورات والشهادات3', 'الدورات والشهادات 3'])).trim() || '—',
          "شهادات إضافية": String(getClean(row, ['هل يوجد شهادات ودورات غير المذكورة ادناه؟', 'شهادات إضافية'])).trim() || 'لا',
          "عدد السنوات الخبره الاجماليه": totalExpYears,
          "عدد شهور الخبرة الاجمالية": totalExpMonths,
          "مجال الخبره": field1,
          "عدد سنوات الخبره 1": expYears1,
          "شهور الخبره 1": expMonths1,
          "مجال الخبره 2": field2,
          "عدد سنوات الخبره 2": expYears2,
          "شهور الخبره 2": expMonths2,
          "مجال الخبره 3": field3,
          "عددسنوات الخبره 3": expYears3,
          "شهور الخبره 3": expMonths3,
          "هل يوجد خبرات لم تذكر": unmentioned,
          "المسمى الوظيفي المقترح": String(getClean(row, ['المسمى الوظيفي المقترح', 'المسمى المقترح'])).trim() || 'غير محدد',
          "الرخص المهنية": license
        };

        if (existingIdMap.has(idNum)) {
          // تحديث السجل الموجود مسبقاً بنفس رقم الهوية
          const existingIdx = existingIdMap.get(idNum);
          talentData[existingIdx] = { ...talentData[existingIdx], ...record, id: talentData[existingIdx].id };
          updatedCount++;
        } else {
          // إضافة سجل جديد في بداية القائمة دون حذف أي بيانات سابقة
          talentData.unshift(record);
          existingIdMap.set(idNum, 0);
          addedCount++;
        }
      });

      populateFilterDropdowns();
      applyFilters();
      alert(`تم استيراد الملف بنجاح مع الحفاظ الكامل على البيانات السابقة!\n\n• تم إضافة: ${addedCount.toLocaleString('ar-SA')} كادر جديد\n• تم تحديث: ${updatedCount.toLocaleString('ar-SA')} كادر مسبق\n• إجمالي الكوادر في الداشبورد الآن: ${talentData.length.toLocaleString('ar-SA')} كادر.`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء قراءة ملف الإكسيل.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// فتح وإغلاق نموذج إضافة كادر جديد
function openAddModal() {
  const form = document.getElementById('addCandidateForm');
  if (form) {
    form.reset();
    if (form.totalExp) form.totalExp.value = 0;
    if (form.expYears1) form.expYears1.value = 0;
    if (form.expYears2) form.expYears2.value = 0;
    if (form.expYears3) form.expYears3.value = 0;
  }
  const modal = document.getElementById('addCandidateModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAddModal() {
  const modal = document.getElementById('addCandidateModal');
  if (modal) modal.classList.add('hidden');
}

// حفظ كادر جديد في الداشبورد
function handleAddCandidateSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const idNum = (form.idNumber?.value || '').trim();
  if (!idNum) {
    alert('يرجى إدخال رقم الهوية');
    return;
  }

  let expY = parseFloat(form.totalExp?.value) || 0;
  let expY1 = parseFloat(form.expYears1?.value) || 0;
  let expY2 = parseFloat(form.expYears2?.value) || 0;
  let expY3 = parseFloat(form.expYears3?.value) || 0;

  if (expY <= 0) {
    expY = 0;
    expY1 = 0;
    expY2 = 0;
    expY3 = 0;
  }

  let field1 = (form.expField1?.value || '').trim();
  if (expY === 0) {
    field1 = field1 && field1 !== '—' ? field1 : 'لا يوجد خبرات مسجلة (بدون خبرة)';
  } else {
    field1 = field1 || '—';
  }

  const newRecord = {
    id: Date.now(),
    "رقم الهويه": idNum,
    "الجنس": form.gender?.value || 'غير محدد',
    "المؤهل الدراسي": (form.degree?.value || '').trim() || 'غير محدد',
    "التخصص": (form.major?.value || '').trim() || 'عام',
    "الدورات والشهادات": (form.cert1?.value || '').trim() || '—',
    "الدورات والشهادات 2": (form.cert2?.value || '').trim() || '—',
    "الدورات والشهادات 3": (form.cert3?.value || '').trim() || '—',
    "شهادات إضافية": form.extraCerts?.value || 'لا',
    "عدد السنوات الخبره الاجماليه": expY,
    "عدد شهور الخبرة الاجمالية": Math.round(expY * 12),
    "مجال الخبره": field1,
    "عدد سنوات الخبره 1": expY1,
    "شهور الخبره 1": Math.round(expY1 * 12),
    "مجال الخبره 2": (form.expField2?.value || '').trim() || '—',
    "عدد سنوات الخبره 2": expY2,
    "شهور الخبره 2": Math.round(expY2 * 12),
    "مجال الخبره 3": (form.expField3?.value || '').trim() || '—',
    "عددسنوات الخبره 3": expY3,
    "شهور الخبره 3": Math.round(expY3 * 12),
    "هل يوجد خبرات لم تذكر": (form.unmentioned?.value || '').trim() || 'لا',
    "المسمى الوظيفي المقترح": (form.jobTitle?.value || '').trim() || 'غير محدد',
    "الرخص المهنية": (form.license?.value || '').trim() || 'لا يوجد'
  };

  const existingIdx = talentData.findIndex(item => String(item[FIELD_NAMES.id] || '').trim() === idNum);
  if (existingIdx > -1) {
    talentData[existingIdx] = { ...talentData[existingIdx], ...newRecord, id: talentData[existingIdx].id };
    alert(`تم تحديث بيانات الكادر الموجود مسبقاً برقم الهوية: ${idNum} بنجاح دون حذف أي بيانات!`);
  } else {
    talentData.unshift(newRecord);
    alert(`تمت إضافة الكادر المهني برقم الهوية: ${idNum} بنجاح مع الحفاظ على كافة السجلات السابقة!`);
  }
  closeAddModal();
  populateFilterDropdowns();
  applyFilters();
}

// فتح نافذة اختيار ملف PDF
function triggerPdfUpload() {
  document.getElementById('pdfFileInput')?.click();
}

// فتح وإغلاق نافذة مراجعة واعتماد بيانات PDF
function closePdfReviewModal() {
  document.getElementById('pdfReviewModal')?.classList.add('hidden');
}

// معالجة وقراءة ملف PDF
async function handlePdfFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('يرجى اختيار ملف بصيغة PDF فقط.');
    return;
  }

  try {
    const fileNameBadge = document.getElementById('pdfFileNameBadge');
    if (fileNameBadge) fileNameBadge.textContent = `جاري قراءة واستخراج البيانات من: ${file.name}...`;

    const fullText = await extractTextFromPdf(file);
    if (!fullText || fullText.trim().length === 0) {
      alert('الملف فارغ أو عبارة عن صور ممسوحة بدون نص قابل للقراءة.');
      return;
    }

    const parsed = parseCandidateFromText(fullText, file.name);

    // تعبئة نموذج المراجعة بالقيم المستخرجة
    if (fileNameBadge) fileNameBadge.textContent = `اسم الملف: ${file.name}`;
    document.getElementById('pdf_idNumber').value = parsed['رقم الهويه'];
    document.getElementById('pdf_gender').value = parsed['الجنس'];
    document.getElementById('pdf_degree').value = parsed['المؤهل الدراسي'];
    document.getElementById('pdf_major').value = parsed['التخصص'];
    document.getElementById('pdf_jobTitle').value = parsed['المسمى الوظيفي المقترح'];
    
    document.getElementById('pdf_cert1').value = parsed['الدورات والشهادات'];
    document.getElementById('pdf_cert2').value = parsed['الدورات والشهادات 2'];
    document.getElementById('pdf_cert3').value = parsed['الدورات والشهادات 3'];
    document.getElementById('pdf_extraCerts').value = parsed['شهادات إضافية'];

    const expY = parsed['عدد السنوات الخبره الاجماليه'] !== undefined ? parsed['عدد السنوات الخبره الاجماليه'] : 0;
    document.getElementById('pdf_totalExp').value = expY;
    document.getElementById('pdf_expField1').value = parsed['مجال الخبره'] || (expY === 0 ? 'لا يوجد خبرات مسجلة (بدون خبرة)' : '—');
    document.getElementById('pdf_expYears1').value = parsed['عدد سنوات الخبره 1'] !== undefined ? parsed['عدد سنوات الخبره 1'] : 0;
    document.getElementById('pdf_expField2').value = parsed['مجال الخبره 2'] || '—';
    document.getElementById('pdf_expYears2').value = parsed['عدد سنوات الخبره 2'] !== undefined ? parsed['عدد سنوات الخبره 2'] : 0;
    document.getElementById('pdf_expField3').value = parsed['مجال الخبره 3'] || '—';
    document.getElementById('pdf_expYears3').value = parsed['عددسنوات الخبره 3'] !== undefined ? parsed['عددسنوات الخبره 3'] : 0;

    document.getElementById('pdf_license').value = parsed['الرخص المهنية'];
    document.getElementById('pdf_unmentioned').value = parsed['هل يوجد خبرات لم تذكر'];

    // فتح نافذة المراجعة والاعتماد
    document.getElementById('pdfReviewModal')?.classList.remove('hidden');

  } catch (err) {
    console.error('Error parsing PDF:', err);
    alert('حدث خطأ أثناء قراءة ملف الـ PDF. يرجى التأكد من سلامة الملف.');
  }
}

// اعتماد وإدخال الكادر المستخرج من الـ PDF في الداشبورد
function handlePdfReviewSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const idNum = (form.idNumber?.value || '').trim();
  if (!idNum) {
    alert('يرجى التأكد من إدخال رقم الهوية');
    return;
  }

  let expY = parseFloat(form.totalExp?.value) || 0;
  let expY1 = parseFloat(form.expYears1?.value) || 0;
  let expY2 = parseFloat(form.expYears2?.value) || 0;
  let expY3 = parseFloat(form.expYears3?.value) || 0;

  if (expY <= 0) {
    expY = 0;
    expY1 = 0;
    expY2 = 0;
    expY3 = 0;
  }

  let field1 = (form.expField1?.value || '').trim();
  if (expY === 0) {
    field1 = field1 && field1 !== '—' ? field1 : 'لا يوجد خبرات مسجلة (بدون خبرة)';
  } else {
    field1 = field1 || '—';
  }

  const newRecord = {
    id: Date.now(),
    "رقم الهويه": idNum,
    "الجنس": form.gender?.value || 'ذكر',
    "المؤهل الدراسي": (form.degree?.value || '').trim() || 'بكالوريوس',
    "التخصص": (form.major?.value || '').trim() || 'إدارة أعمال',
    "الدورات والشهادات": (form.cert1?.value || '').trim() || '—',
    "الدورات والشهادات 2": (form.cert2?.value || '').trim() || '—',
    "الدورات والشهادات 3": (form.cert3?.value || '').trim() || '—',
    "شهادات إضافية": form.extraCerts?.value || 'لا',
    "عدد السنوات الخبره الاجماليه": expY,
    "عدد شهور الخبرة الاجمالية": Math.round(expY * 12),
    "مجال الخبره": field1,
    "عدد سنوات الخبره 1": expY1,
    "شهور الخبره 1": Math.round(expY1 * 12),
    "مجال الخبره 2": (form.expField2?.value || '').trim() || '—',
    "عدد سنوات الخبره 2": expY2,
    "شهور الخبره 2": Math.round(expY2 * 12),
    "مجال الخبره 3": (form.expField3?.value || '').trim() || '—',
    "عددسنوات الخبره 3": expY3,
    "شهور الخبره 3": Math.round(expY3 * 12),
    "هل يوجد خبرات لم تذكر": (form.unmentioned?.value || '').trim() || 'لا',
    "المسمى الوظيفي المقترح": (form.jobTitle?.value || '').trim() || 'غير محدد',
    "الرخص المهنية": (form.license?.value || '').trim() || 'لا يوجد'
  };

  const existingIdx = talentData.findIndex(item => String(item[FIELD_NAMES.id] || '').trim() === idNum);
  if (existingIdx > -1) {
    talentData[existingIdx] = { ...talentData[existingIdx], ...newRecord, id: talentData[existingIdx].id };
    alert(`تم تحديث بيانات الكادر الموجود مسبقاً برقم الهوية (${idNum}) بنجاح دون حذف أي بيانات سابقة!`);
  } else {
    talentData.unshift(newRecord);
    alert(`تم بنجاح استخراج واعتماد الكادر برقم الهوية (${idNum}) وإضافته إلى الداشبورد مع الحفاظ على كافة السجلات السابقة! 🎉`);
  }
  closePdfReviewModal();
  populateFilterDropdowns();
  applyFilters();
}

// استماع للأحداث وعناصر الواجهة
function setupEventListeners() {
  // شريط البحث
  document.getElementById('searchInput')?.addEventListener('input', applyFilters);

  // الفلاتر
  ['filterGender', 'filterDegree', 'filterMajor', 'filterJobTitle', 'filterLicense', 'filterCourse', 'filterCourseText', 'filterUnmentioned', 'filterMinExp', 'filterMaxExp'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
    document.getElementById(id)?.addEventListener('input', applyFilters);
  });

  // زر مسح الفلاتر
  document.getElementById('btnResetFilters')?.addEventListener('click', resetFilters);

  // نموذج إضافة كادر جديد اليدوي
  document.getElementById('addCandidateForm')?.addEventListener('submit', handleAddCandidateSubmit);

  // نموذج مراجعة واعتماد بيانات الـ PDF
  document.getElementById('pdfReviewForm')?.addEventListener('submit', handlePdfReviewSubmit);

  // رفع ملف إكسيل
  const fileInput = document.getElementById('excelFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.name.toLowerCase().endsWith('.pdf')) {
          handlePdfFile(file);
        } else {
          handleFileUpload(file);
        }
      }
    });
  }

  // رفع ملف PDF من الزر المخصص
  const pdfInput = document.getElementById('pdfFileInput');
  if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handlePdfFile(e.target.files[0]);
      }
    });
  }

  // دعم السحب والإفلات للملفات (إكسيل أو PDF)
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500', 'bg-indigo-50/40');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-50/40');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files[0]) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.pdf')) {
          handlePdfFile(file);
        } else {
          handleFileUpload(file);
        }
      }
    });
  }
}
