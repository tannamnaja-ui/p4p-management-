const API_URL = 'http://localhost:3009/api';

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

function setAuth(token, officer) {
    sessionStorage.setItem('p4p_token', token);
    sessionStorage.setItem('p4p_officer', JSON.stringify(officer));
}

function clearAuth() {
    sessionStorage.removeItem('p4p_token');
    sessionStorage.removeItem('p4p_officer');
}

// =====================================
// Alert
// =====================================

function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alert');
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

function hideAlert() {
    document.getElementById('alert').classList.add('hidden');
}

// =====================================
// Toggle password visibility
// =====================================

function togglePw() {
    const input = document.getElementById('password');
    const icon = document.getElementById('pwIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash text-sm';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye text-sm';
    }
}

function toggleDbPw() {
    const input = document.getElementById('dbPassword');
    const icon = document.getElementById('dbPwIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash text-sm';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye text-sm';
    }
}

// =====================================
// Login
// =====================================

// =====================================
// Remember Me
// =====================================

function loadRemembered() {
    const saved = localStorage.getItem('p4p_remember');
    if (!saved) return;
    try {
        const { username, password, remember } = JSON.parse(saved);
        if (remember && username) {
            // ใช้ setTimeout เพื่อให้ browser render เสร็จก่อนค่อยใส่ค่า
            setTimeout(() => {
                document.getElementById('username').value = username;
                document.getElementById('password').value = password || '';
                document.getElementById('rememberMe').checked = true;
                // Focus ที่เหมาะสม
                if (password) {
                    document.getElementById('loginBtn').focus();
                } else {
                    document.getElementById('password').focus();
                }
            }, 50);
        }
    } catch {}
}

function saveRemembered(username, password, remember) {
    if (remember) {
        localStorage.setItem('p4p_remember', JSON.stringify({ username, password, remember: true }));
    } else {
        localStorage.removeItem('p4p_remember');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    hideAlert();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('rememberMe').checked;

    if (!username || !password) {
        showAlert('กรุณากรอก Username และ Password');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังตรวจสอบ...';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.success) {
            saveRemembered(username, password, remember);
            setAuth(result.token, result.officer);
            showAlert(`ยินดีต้อนรับ ${result.officer.name}`, 'success');
            setTimeout(() => { window.location.href = 'index.html'; }, 800);
        } else {
            showAlert(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }
    } catch (err) {
        showAlert('ไม่สามารถติดต่อ Server ได้');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>เข้าสู่ระบบ';
    }
}

// =====================================
// DB Status Check
// =====================================

async function checkDbStatus() {
    try {
        const res = await fetch(`${API_URL}/settings/connection`);
        const data = await res.json();
        const dot = document.getElementById('dbStatusDot');
        const text = document.getElementById('dbStatusText');

        if (data.connected) {
            dot.className = 'w-2 h-2 rounded-full bg-green-400';
            text.textContent = `${data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL'}: ${data.db_host}`;
            text.className = 'text-green-700 text-sm font-medium';
        } else {
            dot.className = 'w-2 h-2 rounded-full bg-red-400';
            text.textContent = 'ยังไม่ได้เชื่อมต่อฐานข้อมูล';
            text.className = 'text-red-600 text-sm';
        }
    } catch {
        document.getElementById('dbStatusDot').className = 'w-2 h-2 rounded-full bg-gray-400';
        document.getElementById('dbStatusText').textContent = 'ไม่สามารถติดต่อ Server ได้';
    }
}

// =====================================
// DB Modal
// =====================================

async function openDbModal() {
    document.getElementById('dbModal').classList.add('show');
    document.getElementById('dbTestResult').classList.add('hidden');

    try {
        const res = await fetch(`${API_URL}/settings/connection`);
        const data = await res.json();
        document.getElementById('dbType').value = data.db_type || '';
        document.getElementById('dbHost').value = data.db_host || '';
        document.getElementById('dbPort').value = data.db_port || '';
        document.getElementById('dbName').value = data.db_name || '';
        document.getElementById('dbUser').value = data.db_user || '';
        document.getElementById('dbPassword').value = data.db_password || '';

        const statusEl = document.getElementById('modalConnStatus');
        if (data.connected) {
            statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-green-100 text-green-700';
            statusEl.textContent = `✅ เชื่อมต่ออยู่: ${data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL'} @ ${data.db_host}`;
        } else {
            statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-red-100 text-red-700';
            statusEl.textContent = '❌ ยังไม่ได้เชื่อมต่อ';
        }
        statusEl.classList.remove('hidden');
        setDefaultPort();
    } catch {}
}

function closeDbModal() {
    document.getElementById('dbModal').classList.remove('show');
}

function setDefaultPort() {
    const type = document.getElementById('dbType').value;
    const portField = document.getElementById('dbPort');
    if (!portField.value) {
        portField.value = type === 'postgresql' ? '5432' : type === 'mysql' ? '3306' : '';
    }
}

function getDbFormData() {
    return {
        db_type: document.getElementById('dbType').value,
        db_host: document.getElementById('dbHost').value.trim(),
        db_port: document.getElementById('dbPort').value,
        db_user: document.getElementById('dbUser').value.trim(),
        db_password: document.getElementById('dbPassword').value,
        db_name: document.getElementById('dbName').value.trim()
    };
}

async function testDbConnection() {
    const data = getDbFormData();
    const resultEl = document.getElementById('dbTestResult');
    resultEl.className = 'text-sm p-3 rounded-lg bg-blue-50 text-blue-700';
    resultEl.textContent = '⏳ กำลังทดสอบ...';
    resultEl.classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/settings/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            resultEl.className = 'text-sm p-3 rounded-lg bg-green-50 text-green-700 border border-green-200';
            resultEl.textContent = `✅ เชื่อมต่อสำเร็จ! Version: ${result.version}`;
        } else {
            resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
            resultEl.textContent = `❌ ${result.error}`;
        }
    } catch {
        resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
        resultEl.textContent = '❌ ไม่สามารถติดต่อ Server ได้';
    }
}

async function saveDbConnection() {
    const data = getDbFormData();
    const resultEl = document.getElementById('dbTestResult');
    resultEl.className = 'text-sm p-3 rounded-lg bg-blue-50 text-blue-700';
    resultEl.textContent = '⏳ กำลังเชื่อมต่อ...';
    resultEl.classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/settings/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            resultEl.className = 'text-sm p-3 rounded-lg bg-green-50 text-green-700 border border-green-200';
            resultEl.textContent = '✅ เชื่อมต่อและบันทึกสำเร็จ!';
            await checkDbStatus();
            setTimeout(() => closeDbModal(), 1500);
        } else {
            resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
            resultEl.textContent = `❌ ${result.error}`;
        }
    } catch {
        resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
        resultEl.textContent = '❌ ไม่สามารถติดต่อ Server ได้';
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

    await checkDbStatus();

    // โหลด username/password ที่จำไว้ (ถ้ามี) — focus จัดการใน loadRemembered
    loadRemembered();
    // ถ้าไม่มีข้อมูลจำไว้ให้ focus username
    if (!localStorage.getItem('p4p_remember')) {
        document.getElementById('username').focus();
    }
});
