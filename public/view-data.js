const API_URL = 'http://localhost:3009/api/p4p';

let currentData = [];
let currentFilters = {};
let currentCategoryLabel = '';
let currentTotalPoint = 0;

// Searchable doctor dropdown state
let allDoctorsCache = [];
let selectedDoctorCode = '';
let selectedDoctorName = '';

// Position checkbox dropdown state
let allPositionsCache = [];
let selectedPositionIds = [];

// =====================================
// Utility
// =====================================

function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    const bgColor = type === 'success' ? 'bg-green-100 border-green-500 text-green-800' :
                     type === 'error'   ? 'bg-red-100 border-red-500 text-red-800' :
                                          'bg-blue-100 border-blue-500 text-blue-800';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    alertDiv.className = `border-l-4 ${bgColor} p-4 rounded-lg`;
    alertDiv.innerHTML = `
        <div class="flex items-center">
            <span class="text-xl mr-3">${icon}</span>
            <div class="flex-1">${message}</div>
            <button onclick="document.getElementById('alert').classList.add('hidden')" class="ml-4 text-gray-600 hover:text-gray-800">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 8000);
}

function getToken() {
    return sessionStorage.getItem('p4p_token') || '';
}

function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

// =====================================
// URL Params (group_id support)
// =====================================

// แปลง category string → dept_code (1-8)
const CATEGORY_DEPT_MAP = {
    'doctor':     '1',
    'dentist':    '2',
    'anesthesia': '3',
    'surgery':    '4',
    'ttm':        '5',
    'pt':         '6',
    'nurse_ipd':  '7',
    'nurse_opd':  '8',
};

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') || '';
    return {
        group_id:       params.get('group_id')       || '',
        date_from:      params.get('date_from')      || '',
        date_to:        params.get('date_to')        || '',
        income:         params.get('income')         || '',
        category,
        category_label: params.get('category_label') || '',
        dept_code:      CATEGORY_DEPT_MAP[category]  || '',
    };
}

// =====================================
// Load Position List (จำค่าตามผู้ใช้ที่ login)
// =====================================

const POSITION_STORAGE_PREFIX = 'p4p_positions_';

function getOfficerLoginKey() {
    try {
        const officer = JSON.parse(sessionStorage.getItem('p4p_officer') || '{}');
        return officer.login_name || officer.name || 'guest';
    } catch {
        return 'guest';
    }
}

function loadSavedPositionIds() {
    try {
        const saved = localStorage.getItem(POSITION_STORAGE_PREFIX + getOfficerLoginKey());
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function savePositionIds() {
    try {
        localStorage.setItem(POSITION_STORAGE_PREFIX + getOfficerLoginKey(), JSON.stringify(selectedPositionIds));
    } catch {}
}

async function loadPositions() {
    try {
        const res = await fetch(`${API_URL}/doctor-positions`, { headers: authHeaders() });
        const result = await res.json();
        if (result.success) {
            allPositionsCache = result.data;
            const saved = loadSavedPositionIds();
            selectedPositionIds = saved.filter(id => allPositionsCache.some(p => String(p.id) === String(id)));
            renderPositionOptions();
            updatePositionSummary();
        }
    } catch (err) {
        console.error('Error loading positions:', err);
    }
}

function renderPositionOptions() {
    const list = document.getElementById('positionOptionsList');
    if (!list) return;
    list.innerHTML = allPositionsCache.map(p => `
        <label class="flex items-center px-3 py-2 hover:bg-teal-50 cursor-pointer text-sm">
            <input type="checkbox" class="position-checkbox mr-2 w-4 h-4" value="${p.id}"
                ${selectedPositionIds.includes(String(p.id)) ? 'checked' : ''}
                onchange="onPositionCheckboxChange()">
            <span>${p.name}</span>
        </label>
    `).join('');
}

function togglePositionDropdown() {
    const dd = document.getElementById('positionDropdown');
    if (dd) dd.classList.toggle('hidden');
}

function closePositionDropdown() {
    const dd = document.getElementById('positionDropdown');
    if (dd) dd.classList.add('hidden');
}

function selectAllPositions(checked) {
    document.querySelectorAll('.position-checkbox').forEach(cb => cb.checked = checked);
    onPositionCheckboxChange();
}

async function onPositionCheckboxChange() {
    selectedPositionIds = Array.from(document.querySelectorAll('.position-checkbox:checked')).map(cb => cb.value);
    savePositionIds();
    updatePositionSummary();
    selectDoctor('', '');
    await loadDoctors();
}

function updatePositionSummary() {
    const summary = document.getElementById('positionSummary');
    if (!summary) return;
    if (selectedPositionIds.length === 0) {
        summary.textContent = '-- ทุกตำแหน่ง --';
    } else if (selectedPositionIds.length === 1) {
        const pos = allPositionsCache.find(p => String(p.id) === selectedPositionIds[0]);
        summary.textContent = pos ? pos.name : '1 ตำแหน่งที่เลือก';
    } else {
        summary.textContent = `${selectedPositionIds.length} ตำแหน่งที่เลือก`;
    }
}

// =====================================
// Load Doctor List
// =====================================

let groupDoctorCodes = []; // doctor codes for the selected group

async function loadGroupDoctors(groupId) {
    try {
        const res = await fetch(`${API_URL}/work-groups/${groupId}/doctors`, { headers: authHeaders() });
        const result = await res.json();
        if (result.success) {
            groupDoctorCodes = result.data.map(d => d.doctor_code);
        }
    } catch (err) {
        console.error('Error loading group doctors:', err);
    }
}

// =====================================
// Searchable Doctor Dropdown
// =====================================

function renderDoctorDropdown(doctors) {
    const dd = document.getElementById('doctorDropdown');
    if (!dd) return;

    const allOption = `<div class="doctor-option ${selectedDoctorCode === '' ? 'selected-opt' : ''}"
        onmousedown="selectDoctor('','-- แพทย์ทุกคน --')">-- แพทย์ทุกคน --</div>`;

    if (doctors.length === 0) {
        dd.innerHTML = allOption + `<div class="px-3 py-6 text-center text-gray-400 text-sm">ไม่พบแพทย์</div>`;
    } else {
        dd.innerHTML = allOption + doctors.map(d =>
            `<div class="doctor-option ${d.code === selectedDoctorCode ? 'selected-opt' : ''}"
                onmousedown="selectDoctor('${d.code}','${d.name.replace(/'/g,"\\'")}')">
                ${d.name}
            </div>`
        ).join('');
    }
}

function openDoctorDropdown() {
    const dd = document.getElementById('doctorDropdown');
    if (!dd) return;
    renderDoctorDropdown(allDoctorsCache);
    dd.classList.remove('hidden');
}

function filterDoctorDropdown(q) {
    const dd = document.getElementById('doctorDropdown');
    if (!dd) return;
    dd.classList.remove('hidden');
    const filtered = q
        ? allDoctorsCache.filter(d => d.name.toLowerCase().includes(q.toLowerCase()))
        : allDoctorsCache;
    renderDoctorDropdown(filtered);
}

function selectDoctor(code, name) {
    selectedDoctorCode = code;
    selectedDoctorName = name === '-- แพทย์ทุกคน --' ? '' : name;
    const input = document.getElementById('doctorSearchInput');
    const clearBtn = document.getElementById('clearDoctorBtn');
    if (input) input.value = code ? name : '';
    if (clearBtn) clearBtn.classList.toggle('hidden', !code);
    closeDoctorDropdown();
}

function clearDoctorSelect() {
    selectDoctor('', '');
    document.getElementById('doctorSearchInput').value = '';
}

function closeDoctorDropdown() {
    const dd = document.getElementById('doctorDropdown');
    if (dd) dd.classList.add('hidden');
}

async function loadDoctors() {
    const input = document.getElementById('doctorSearchInput');
    if (input) { input.placeholder = '⏳ กำลังโหลด...'; input.disabled = true; }

    try {
        const res = await fetch(`${API_URL}/active-doctors`, { headers: authHeaders() });
        const result = await res.json();

        let doctors = result.success ? result.data : [];

        // ถ้ามี group ให้กรองเฉพาะแพทย์ในกลุ่ม
        if (groupDoctorCodes.length > 0) {
            doctors = doctors.filter(d => groupDoctorCodes.includes(d.code));
        }

        // ถ้าเลือกตำแหน่ง ให้กรองเฉพาะแพทย์ในตำแหน่งที่เลือก (เลือกได้หลายตำแหน่ง)
        if (selectedPositionIds.length > 0) {
            doctors = doctors.filter(d => selectedPositionIds.includes(String(d.position_id)));
        }

        allDoctorsCache = doctors;

        if (selectedDoctorCode && !doctors.some(d => d.code === selectedDoctorCode)) {
            selectDoctor('', '');
        }
    } catch (err) {
        console.error('Error loading doctors:', err);
        allDoctorsCache = [];
    }

    if (input) { input.placeholder = '-- แพทย์ทุกคน --'; input.disabled = false; }
}

// =====================================
// Load Income Filter List
// =====================================

async function loadIncomeList() {
    try {
        const res = await fetch(`${API_URL}/income-filter-list`, { headers: authHeaders() });
        const result = await res.json();
        const select = document.getElementById('incomeSelect');
        select.innerHTML = '<option value="">-- แสดงทั้งหมด --</option>';
        if (result.success) {
            result.data.forEach(i => {
                const opt = document.createElement('option');
                opt.value = i.income;
                opt.textContent = i.income_name || i.name || i.income;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading income list:', err);
    }
}

// =====================================
// Load Report
// =====================================

async function loadReport() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo   = document.getElementById('dateTo').value;
    const doctor   = selectedDoctorCode;
    const income   = document.getElementById('incomeSelect').value;

    if (!dateFrom || !dateTo) {
        showAlert('กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุด', 'error');
        return;
    }

    closeDoctorDropdown();

    const section = document.getElementById('dataSection');
    section.innerHTML = `
        <div class="text-center py-16 text-gray-500">
            <i class="fas fa-spinner fa-spin text-teal-600 text-5xl mb-4"></i>
            <p class="text-lg">กำลังโหลดข้อมูล...</p>
        </div>`;

    try {
        let url = `${API_URL}/report?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`;
        if (doctor) url += `&doctor=${encodeURIComponent(doctor)}`;
        if (income) url += `&income=${encodeURIComponent(income)}`;
        if (!doctor && selectedPositionIds.length > 0) url += `&position_ids=${encodeURIComponent(selectedPositionIds.join(','))}`;

        const res = await fetch(url, { headers: authHeaders() });
        const result = await res.json();

        if (!result.success) {
            showAlert(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
            section.innerHTML = `<div class="text-center py-16 text-red-400"><i class="fas fa-times-circle text-5xl mb-4"></i><p>${result.error}</p></div>`;
            return;
        }

        currentData = result.data.filter(r => parseFloat(r.point) !== 0);
        currentTotalPoint = currentData.reduce((s, r) => s + (parseFloat(r.point) || 0), 0);
        currentFilters = { dateFrom, dateTo, doctor, income,
            doctorName: selectedDoctorName || '' };

        const doctorName = selectedDoctorName || '';
        const incomeName = income
            ? (document.getElementById('incomeSelect').selectedOptions[0]?.text || income)
            : 'ทุก Income';

        displayReport(currentData, currentTotalPoint, doctorName, incomeName, dateFrom, dateTo);

        // Show export button
        document.getElementById('exportBtn').classList.toggle('hidden', result.count === 0);

    } catch (err) {
        console.error('Error loading report:', err);
        showAlert('เกิดข้อผิดพลาดในการโหลดรายงาน', 'error');
        section.innerHTML = `<div class="text-center py-16 text-red-400"><i class="fas fa-times-circle text-5xl mb-4"></i><p>เกิดข้อผิดพลาดในการเชื่อมต่อ</p></div>`;
    }
}

// =====================================
// Display Report Table
// =====================================

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function groupByDoctor(data) {
    const map = new Map();
    data.forEach(item => {
        const key = item.doctor_code || item.doctor_name || '_unknown';
        if (!map.has(key)) {
            map.set(key, { doctor_name: item.doctor_name || 'ไม่ระบุแพทย์', items: [] });
        }
        map.get(key).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) => a.doctor_name.localeCompare(b.doctor_name, 'th'));
}

function renderDoctorGroup(group, dateFrom, dateTo) {
    const rows = group.items.map((item, idx) => `
        <tr class="hover:bg-teal-50 transition duration-150 ${idx % 2 === 0 ? '' : 'bg-gray-50'}">
            <td class="px-4 py-2 text-sm text-center text-gray-500">${idx + 1}</td>
            <td class="px-4 py-2 text-sm text-gray-700">${formatDate(item.vstdate)}</td>
            <td class="px-4 py-2 text-sm font-mono text-teal-700">${item.hn || '-'}</td>
            <td class="px-4 py-2 text-sm text-gray-800">${item.item_name || item.icode || '-'}</td>
            <td class="px-4 py-2 text-sm text-gray-600">${item.income_name || item.income || '-'}</td>
            <td class="px-4 py-2 text-sm font-semibold text-right text-teal-800">${item.point != null ? parseFloat(item.point).toFixed(2) : '-'}</td>
        </tr>
    `).join('');

    const subtotal = group.items.reduce((s, r) => s + (parseFloat(r.point) || 0), 0);

    return `
        <div class="mb-6 doctor-group">
            <div class="bg-teal-600 text-white px-4 py-2.5 rounded-t-lg flex items-center justify-between">
                <p class="font-bold flex items-center">
                    <i class="fas fa-user-md mr-2"></i>${group.doctor_name}
                    <span class="ml-3 text-teal-100 text-sm font-normal">(${formatDate(dateFrom)} - ${formatDate(dateTo)})</span>
                </p>
                <span class="text-teal-100 text-sm">${group.items.length} รายการ</span>
            </div>
            <div class="overflow-x-auto border border-teal-200 rounded-b-lg">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gradient-to-r from-teal-50 to-teal-100">
                        <tr>
                            <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase w-12">#</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">วันที่</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">HN</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">ชื่อรายการ</th>
                            <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Income</th>
                            <th class="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Point</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${rows}
                        <tr class="bg-teal-50">
                            <td colspan="5" class="px-4 py-2.5 text-sm font-bold text-right text-teal-800">รวม Point (${group.doctor_name}):</td>
                            <td class="px-4 py-2.5 text-sm font-bold text-right text-teal-800">${subtotal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;
}

function displayReport(data, totalPoint, doctorName, incomeName, dateFrom, dateTo) {
    // Update on-screen header
    const reportTitle   = document.getElementById('reportTitle');
    const doctorTitle   = document.getElementById('doctorTitle');
    const reportSubtitle = document.getElementById('reportSubtitle');
    if (doctorName) {
        doctorTitle.textContent = doctorName;
        doctorTitle.classList.remove('hidden');
    } else {
        doctorTitle.textContent = '';
        doctorTitle.classList.add('hidden');
    }
    reportSubtitle.textContent = `วันที่ ${formatDate(dateFrom)} ถึง ${formatDate(dateTo)} | Income: ${incomeName}`;
    reportTitle.classList.remove('hidden');

    // Update print header (แสดงกลางหน้าจอบนหัวตารางของทุกหน้าตอนพิมพ์)
    document.getElementById('printTitle').textContent = doctorName
        ? `รายงาน P4P - ${doctorName}`
        : (currentCategoryLabel ? `รายงาน P4P - ${currentCategoryLabel}` : 'รายงาน P4P');

    const section = document.getElementById('dataSection');

    if (data.length === 0) {
        section.innerHTML = `
            <div class="text-center py-16 text-gray-400">
                <i class="fas fa-inbox text-5xl mb-4 opacity-30"></i>
                <p class="text-lg">ไม่พบข้อมูลในช่วงเวลาที่เลือก</p>
            </div>`;
        return;
    }

    const groups = groupByDoctor(data);
    const groupsHtml = groups.map(g => renderDoctorGroup(g, dateFrom, dateTo)).join('');

    section.innerHTML = `
        ${groupsHtml}
        <div class="bg-teal-800 text-white rounded-lg px-4 py-3 flex items-center justify-between">
            <p class="font-bold">รวม Point ทั้งหมด (${data.length} รายการ, ${groups.length} แพทย์):</p>
            <p class="text-xl font-bold">${parseFloat(totalPoint).toFixed(2)}</p>
        </div>`;
}

// =====================================
// Export Excel (.xlsx) — แยกชีทตามแพทย์ ชื่อชีท = ชื่อแพทย์
// =====================================

function sanitizeSheetName(name, usedNames) {
    let clean = String(name || 'Sheet').replace(/[\\/?*[\]:]/g, '').trim();
    if (!clean) clean = 'Sheet';
    if (clean.length > 31) clean = clean.slice(0, 31);
    let finalName = clean;
    let counter = 2;
    while (usedNames.has(finalName)) {
        const suffix = ` (${counter})`;
        finalName = clean.slice(0, 31 - suffix.length) + suffix;
        counter++;
    }
    usedNames.add(finalName);
    return finalName;
}

function buildDoctorSheetRows(group, dateFrom, dateTo) {
    const titleLine = `รายงาน P4P - ${group.doctor_name}`;
    const dateRangeText = `วันที่ ${formatDate(dateFrom)} ถึง ${formatDate(dateTo)}`;
    const headerRow = ['ลำดับ', 'วันที่', 'HN', 'ชื่อรายการ', 'Income', 'Point'];
    let subtotal = 0;
    const dataRows = group.items.map((item, idx) => {
        const point = item.point != null ? parseFloat(item.point) : 0;
        subtotal += point;
        return [idx + 1, formatDate(item.vstdate), item.hn || '-', item.item_name || item.icode || '-', item.income_name || item.income || '-', point];
    });
    const totalRow = ['', '', '', '', `รวม Point (${group.doctor_name}):`, subtotal];
    return [[titleLine], [dateRangeText], [], headerRow, ...dataRows, totalRow];
}

function exportExcel() {
    if (currentData.length === 0) {
        showAlert('ไม่มีข้อมูลสำหรับ Export', 'error');
        return;
    }

    const groups = groupByDoctor(currentData);
    const wb = XLSX.utils.book_new();
    const usedNames = new Set();
    groups.forEach(group => {
        const rows = buildDoctorSheetRows(group, currentFilters.dateFrom, currentFilters.dateTo);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 28 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(group.doctor_name, usedNames));
    });

    const doctorName = currentFilters.doctorName || 'All';
    const filename = `P4P_Report_${doctorName}_${currentFilters.dateFrom}_${currentFilters.dateTo}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, filename);

    showAlert('Export ข้อมูลสำเร็จ!', 'success');
}

// =====================================
// Print Footer (วันที่-เวลาที่พิมพ์ ท้ายกระดาษทุกหน้า)
// =====================================

window.addEventListener('beforeprint', () => {
    const footer = document.getElementById('printFooter');
    if (!footer) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    footer.textContent = `พิมพ์เมื่อ ${dateStr} ${timeStr}`;
});

// =====================================
// Render User Bar
// =====================================

function renderUserBar(officer) {
    const bar = document.getElementById('userBar');
    if (!bar) return;
    bar.classList.remove('hidden');
    bar.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="text-right">
                <p class="text-sm font-semibold">${officer.name || officer.login_name}</p>
                <p class="text-xs text-teal-200">ผู้ใช้งานระบบ</p>
            </div>
            <div class="bg-white bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                ${(officer.name || officer.login_name || '?')[0].toUpperCase()}
            </div>
        </div>`;
}

// =====================================
// Initialize
// =====================================

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = getUrlParams();

    // Set date range from URL or default to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = urlParams.date_from || fmt(firstDay);
    document.getElementById('dateTo').value   = urlParams.date_to   || fmt(today);

    // If category_label param — show badge and update back button
    if (urlParams.category_label) {
        currentCategoryLabel = urlParams.category_label;
        const groupBadge = document.getElementById('groupBadge');
        if (groupBadge) {
            groupBadge.textContent = urlParams.category_label;
            groupBadge.classList.remove('hidden');
        }
        // update title
        document.title = `รายงาน P4P - ${urlParams.category_label}`;
        // update back button to go to report-select
        const backBtn = document.querySelector('a[href="index.html"]');
        if (backBtn) backBtn.href = 'report-select.html';
    }

    // If group_id param — show group label and load group doctors first
    if (urlParams.group_id) {
        await loadGroupDoctors(urlParams.group_id);

        // Show group badge if element exists
        const groupBadge = document.getElementById('groupBadge');
        if (groupBadge) {
            try {
                const res = await fetch(`${API_URL}/work-groups`, { headers: authHeaders() });
                const result = await res.json();
                if (result.success) {
                    const grp = result.data.find(g => String(g.id) === String(urlParams.group_id));
                    if (grp) groupBadge.textContent = `กลุ่ม: ${grp.name}`;
                }
            } catch (_) {}
            groupBadge.classList.remove('hidden');
        }
    }

    // loadPositions ต้องเสร็จก่อน เพื่อให้ตำแหน่งที่จำไว้ถูกใช้กรองตอนโหลดแพทย์
    await loadPositions();
    await Promise.all([loadDoctors(), loadIncomeList()]);

    // Pre-select income from URL param
    if (urlParams.income) {
        const incomeSelect = document.getElementById('incomeSelect');
        if ([...incomeSelect.options].some(o => o.value === urlParams.income)) {
            incomeSelect.value = urlParams.income;
        }
    }

    // ปิด dropdown เมื่อคลิกข้างนอก
    document.addEventListener('click', e => {
        const wrap = document.getElementById('doctorDropdownWrap');
        if (wrap && !wrap.contains(e.target)) closeDoctorDropdown();

        const posWrap = document.getElementById('positionDropdownWrap');
        if (posWrap && !posWrap.contains(e.target)) closePositionDropdown();
    });
});
