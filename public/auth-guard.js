// =====================================
// Auth Guard — include in every protected page
// =====================================

const AUTH_API = 'http://localhost:3009/api/auth';

function getAuthToken() {
    return sessionStorage.getItem('p4p_token');
}

function getOfficerInfo() {
    const info = sessionStorage.getItem('p4p_officer');
    return info ? JSON.parse(info) : null;
}

function clearAuth() {
    sessionStorage.removeItem('p4p_token');
    sessionStorage.removeItem('p4p_officer');
}

async function requireAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        const res = await fetch(`${AUTH_API}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();

        if (!data.valid) {
            clearAuth();
            window.location.href = 'login.html';
            return null;
        }

        if (data.db) sessionStorage.setItem('p4p_session_db', JSON.stringify(data.db));
        return data.officer;
    } catch {
        // Server error — ยังไม่ redirect ให้ใช้งานต่อได้
        return getOfficerInfo();
    }
}

async function logout() {
    const token = getAuthToken();
    try {
        await fetch(`${AUTH_API}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
    } catch {}
    clearAuth();
    window.location.href = 'login.html';
}

function renderUserBar(officer) {
    const bar = document.getElementById('userBar');
    if (!bar || !officer) return;
    bar.innerHTML = `
        <div class="flex items-center space-x-3">
            <div class="bg-white bg-opacity-20 rounded-lg px-3 py-1.5 flex items-center space-x-2">
                <i class="fas fa-user-circle text-white text-sm"></i>
                <span class="text-white text-sm font-medium">${officer.name}</span>
            </div>
            <button onclick="logout()"
                class="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center space-x-1">
                <i class="fas fa-sign-out-alt"></i>
                <span>ออกจากระบบ</span>
            </button>
        </div>
    `;
    bar.classList.remove('hidden');
}
