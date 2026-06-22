const API_URL = 'http://localhost:3009/api';
const DEPT_STORAGE_KEY = 'p4p_department';

// =====================================
// Auth Utilities (shared)
// =====================================

function getAuthToken() {
    return sessionStorage.getItem('p4p_token');
}

function getOfficerInfo() {
    const info = sessionStorage.getItem('p4p_officer');
    return info ? JSON.parse(info) : null;
}

function setAuth(token, officer, dbInfo) {
    sessionStorage.setItem('p4p_token', token);
    sessionStorage.setItem('p4p_officer', JSON.stringify(officer));
    if (dbInfo) sessionStorage.setItem('p4p_session_db', JSON.stringify(dbInfo));
}

function clearAuth() {
    sessionStorage.removeItem('p4p_token');
    sessionStorage.removeItem('p4p_officer');
    sessionStorage.removeItem('p4p_session_db');
}

// =====================================
// Alert
// =====================================

function showAlert(message, type = 'error', targetId = 'alert') {
    const alertDiv = document.getElementById(targetId);
    const bgColor = type === 'success'
        ? 'bg-green-100 border-green-500 text-green-800'
        : type === 'info'
        ? 'bg-blue-100 border-blue-500 text-blue-800'
        : 'bg-red-100 border-red-500 text-red-800';
    const icon = type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌';

    alertDiv.className = `border-l-4 ${bgColor} p-3 rounded-lg text-sm`;
    alertDiv.innerHTML = `<span class="mr-2">${icon}</span>${message}`;
    alertDiv.classList.remove('hidden');
}

function hideAlert(targetId = 'alert') {
    document.getElementById(targetId).classList.add('hidden');
}

// =====================================
// Department dropdown
// =====================================

async function loadDepartments() {
    const select = document.getElementById('department');
    try {
        const res = await fetch(`${API_URL}/settings/departments`);
        const data = await res.json();
        if (data.success && data.data.length) {
            const saved = localStorage.getItem(DEPT_STORAGE_KEY) || '';
            select.innerHTML = '<option value="">-- เลือกห้องทำงาน --</option>' +
                data.data.map(d => `<option value="${d.depcode}">${d.depname}</option>`).join('');
            if (saved) select.value = saved;
        }
    } catch {}
}

function onDepartmentChange() {
    const val = document.getElementById('department').value;
    if (val) localStorage.setItem(DEPT_STORAGE_KEY, val);
}

// =====================================
// Login
// =====================================

async function handleLogin(event) {
    event.preventDefault();
    hideAlert();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const deptSelect = document.getElementById('department');
    const department = deptSelect.value;
    const department_name = deptSelect.selectedOptions[0]?.text || '';

    if (!username || !password) {
        showAlert('กรุณากรอก Username และ Password');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังเข้าสู่ระบบ...';

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, department, department_name })
        });
        const result = await res.json();

        if (result.success) {
            setAuth(result.token, result.officer, result.db);
            showAlert(`ยินดีต้อนรับ ${result.officer.name}`, 'success');
            setTimeout(() => { window.location.href = 'index.html'; }, 600);
        } else {
            showAlert(result.error || 'Username หรือ Password ไม่ถูกต้อง');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>เข้าสู่ระบบ';
        }
    } catch {
        showAlert('ไม่สามารถติดต่อ Server ได้');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>เข้าสู่ระบบ';
    }
}

// =====================================
// Connection Settings panel
// =====================================

function openSettings() {
    hideAlert();
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('settingsView').classList.remove('hidden');
    loadConnectionSettings();
    checkTablesStatus();
}

function closeSettings() {
    hideAlert('settingsAlert');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
}

async function loadConnectionSettings() {
    try {
        const res = await fetch(`${API_URL}/settings/connection`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('dbType').value = data.db_type || 'postgresql';
            document.getElementById('dbHost').value = data.db_host || '';
            document.getElementById('dbPort').value = data.db_port || '';
            document.getElementById('dbName').value = data.db_name || '';
            document.getElementById('dbUser').value = data.db_user || '';
            document.getElementById('dbPassword').value = data.db_password || '';
        }
    } catch {}
}

function onDbTypeChange() {
    const type = document.getElementById('dbType').value;
    const portInput = document.getElementById('dbPort');
    if (!portInput.value || portInput.value === '5432' || portInput.value === '3306') {
        portInput.value = type === 'mysql' ? '3306' : '5432';
    }
}

function getConnForm() {
    return {
        db_type: document.getElementById('dbType').value,
        db_host: document.getElementById('dbHost').value.trim(),
        db_port: document.getElementById('dbPort').value.trim(),
        db_name: document.getElementById('dbName').value.trim(),
        db_user: document.getElementById('dbUser').value.trim(),
        db_password: document.getElementById('dbPassword').value
    };
}

async function testConnection() {
    hideAlert('settingsAlert');
    const form = getConnForm();
    if (!form.db_host || !form.db_user || !form.db_name) {
        showAlert('กรุณากรอกข้อมูลให้ครบ', 'error', 'settingsAlert');
        return;
    }

    const btn = document.getElementById('testBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังทดสอบ...';

    try {
        const res = await fetch(`${API_URL}/settings/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
        const result = await res.json();
        if (result.success) {
            showAlert('เชื่อมต่อสำเร็จ', 'success', 'settingsAlert');
        } else {
            showAlert(result.error || 'เชื่อมต่อไม่สำเร็จ', 'error', 'settingsAlert');
        }
    } catch {
        showAlert('ไม่สามารถติดต่อ Server ได้', 'error', 'settingsAlert');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plug mr-2"></i>ทดสอบการเชื่อมต่อ';
    }
}

async function saveConnection() {
    hideAlert('settingsAlert');
    const form = getConnForm();
    if (!form.db_host || !form.db_user || !form.db_name) {
        showAlert('กรุณากรอกข้อมูลให้ครบ', 'error', 'settingsAlert');
        return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังบันทึก...';

    try {
        const res = await fetch(`${API_URL}/settings/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });
        const result = await res.json();
        if (result.success) {
            closeSettings();
            showAlert('บันทึกการเชื่อมต่อสำเร็จ', 'success');
            loadDepartments();
        } else {
            showAlert(result.error || 'บันทึกไม่สำเร็จ', 'error', 'settingsAlert');
        }
    } catch {
        showAlert('ไม่สามารถติดต่อ Server ได้', 'error', 'settingsAlert');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save mr-2"></i>บันทึกข้อมูลเชื่อมต่อ';
        checkTablesStatus();
    }
}

// =====================================
// ตรวจสอบ/สร้างตาราง P4P
// =====================================

function setCreateTablesBtnState(enabled, label) {
    const btn = document.getElementById('createTablesBtn');
    btn.disabled = !enabled;
    btn.innerHTML = `<i class="fas fa-table mr-2"></i>${label}`;
    btn.className = enabled
        ? 'w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition text-sm mb-3'
        : 'w-full bg-gray-300 text-gray-500 font-semibold py-3 px-4 rounded-xl transition text-sm mb-3 cursor-not-allowed';
}

function renderTablesStatus(tables) {
    const container = document.getElementById('tablesStatus');
    if (!tables || !tables.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = tables.map(t => {
        const icon = t.complete
            ? '<i class="fas fa-check-circle text-green-500"></i>'
            : '<i class="fas fa-times-circle text-red-400"></i>';
        return `<div class="flex items-center gap-2"><span class="w-4 text-center">${icon}</span><span class="font-mono">${t.name}</span></div>`;
    }).join('');
}

async function checkTablesStatus() {
    try {
        const res = await fetch(`${API_URL}/settings/check-tables`);
        const data = await res.json();
        renderTablesStatus(data.tables);
        if (data.complete) {
            setCreateTablesBtnState(false, 'มีตารางครบแล้ว');
        } else if (data.reason === 'not_connected') {
            setCreateTablesBtnState(false, 'กรุณาเชื่อมต่อฐานข้อมูลก่อน');
        } else {
            setCreateTablesBtnState(true, 'เพิ่มตาราง');
        }
    } catch {
        setCreateTablesBtnState(false, 'เพิ่มตาราง');
    }
}

async function createTables() {
    const btn = document.getElementById('createTablesBtn');
    if (btn.disabled) return;

    hideAlert('settingsAlert');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังสร้างตาราง...';

    try {
        const res = await fetch(`${API_URL}/settings/create-tables`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            const names = (result.logs || []).map(l => l.name).join(', ');
            showAlert(`สร้างตารางสำเร็จ: ${names}`, 'success', 'settingsAlert');
        } else {
            showAlert(result.error || 'สร้างตารางไม่สำเร็จ', 'error', 'settingsAlert');
        }
    } catch {
        showAlert('ไม่สามารถติดต่อ Server ได้', 'error', 'settingsAlert');
    } finally {
        checkTablesStatus();
    }
}

// =====================================
// Initialize
// =====================================

document.addEventListener('DOMContentLoaded', async () => {
    // ถ้า login อยู่แล้วให้ข้ามไปหน้าหลัก
    const token = getAuthToken();
    if (token) {
        try {
            const res = await fetch(`${API_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            if (data.valid) {
                window.location.href = 'index.html';
                return;
            }
        } catch {}
        clearAuth();
    }

    loadDepartments();
    document.getElementById('username').focus();
});
