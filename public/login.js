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
// BMS Login
// =====================================

async function doBmsLogin(code) {
    try {
        const response = await fetch(`${API_URL}/auth/bms-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        return await response.json();
    } catch {
        return { success: false, error: 'ไม่สามารถติดต่อ Server ได้' };
    }
}

// Auto-login จาก URL ?code=XXXX (HOSxP เปิดมาให้)
async function tryAutoLogin(code) {
    document.getElementById('autoLoginState').classList.remove('hidden');
    document.getElementById('manualState').classList.add('hidden');
    const result = await doBmsLogin(code);
    if (result.success) {
        setAuth(result.token, result.officer, result.db);
        window.location.href = 'index.html';
    } else {
        document.getElementById('autoLoginState').classList.add('hidden');
        document.getElementById('manualState').classList.remove('hidden');
        showAlert(result.error || 'Session Code ไม่ถูกต้อง กรุณากรอกใหม่');
    }
}

// Manual login จาก form
async function handleBmsLogin(event) {
    event.preventDefault();
    hideAlert();
    const code = document.getElementById('sessionCode').value.trim();
    if (!code) { showAlert('กรุณากรอก Session Code'); return; }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังตรวจสอบ...';
    const result = await doBmsLogin(code);
    if (result.success) {
        setAuth(result.token, result.officer, result.db);
        showAlert(`ยินดีต้อนรับ ${result.officer.name}`, 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
    } else {
        showAlert(result.error || 'Session Code ไม่ถูกต้อง');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>เข้าสู่ระบบ';
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

    const urlParams = new URLSearchParams(window.location.search);
    const bmsCode = urlParams.get('code');
    if (bmsCode) {
        await tryAutoLogin(bmsCode);
        return;
    }

    document.getElementById('sessionCode').focus();
});
