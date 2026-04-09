const SETTINGS_URL = 'http://localhost:3009/api/settings';

// =====================================
// DB Status
// =====================================

function updateDbStatus(connected, data) {
    const dot = document.getElementById('dbStatusDot');
    const text = document.getElementById('dbStatusText');
    const warning = document.getElementById('dbWarning');
    const infoCard = document.getElementById('dbInfoCard');

    if (connected) {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-green-400 ml-1';
        const typeLabel = data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL';
        text.textContent = `${typeLabel}: ${data.db_host}`;
        warning.classList.add('hidden');

        // แสดง info card
        infoCard.classList.remove('hidden');
        document.getElementById('infoType').textContent = typeLabel;
        document.getElementById('infoHost').textContent = `${data.db_host}:${data.db_port}`;
        document.getElementById('infoDb').textContent = data.db_name;
        document.getElementById('infoUser').textContent = data.db_user;
    } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-red-400 ml-1';
        text.textContent = 'ตั้งค่าการเชื่อมต่อ';
        warning.classList.remove('hidden');
        infoCard.classList.add('hidden');
    }
}

async function checkDbStatus() {
    try {
        const res = await fetch(`${SETTINGS_URL}/connection`);
        const data = await res.json();
        updateDbStatus(data.connected, data);
    } catch {
        updateDbStatus(false, {});
    }
}

// =====================================
// DB Modal
// =====================================

async function openDbModal() {
    document.getElementById('dbModal').classList.add('show');
    document.getElementById('testResult').classList.add('hidden');
    document.getElementById('createTableResult').classList.add('hidden');

    // reset button เป็นสีส้มก่อน แล้วค่อย check
    const btn = document.getElementById('createTablesBtn');
    if (btn) {
        btn.disabled = true;
        btn.className = 'w-full bg-orange-300 text-white font-semibold py-2.5 px-4 rounded-lg text-sm cursor-wait';
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังตรวจสอบ...';
    }
    checkAndUpdateTableBtn();

    try {
        const res = await fetch(`${SETTINGS_URL}/connection`);
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
            const typeLabel = data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL';
            statusEl.textContent = `✅ เชื่อมต่ออยู่: ${typeLabel} @ ${data.db_host}`;
        } else {
            statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-red-100 text-red-700';
            statusEl.textContent = '❌ ยังไม่ได้เชื่อมต่อ';
        }
        statusEl.classList.remove('hidden');
    } catch {}
}

function closeDbModal() {
    document.getElementById('dbModal').classList.remove('show');
}

function togglePassword() {
    const input = document.getElementById('dbPassword');
    const icon = document.getElementById('pwEyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash text-sm';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye text-sm';
    }
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
    const resultEl = document.getElementById('testResult');
    resultEl.className = 'text-sm p-3 rounded-lg bg-blue-50 text-blue-700';
    resultEl.textContent = '⏳ กำลังทดสอบการเชื่อมต่อ...';
    resultEl.classList.remove('hidden');

    try {
        const res = await fetch(`${SETTINGS_URL}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            resultEl.className = 'text-sm p-3 rounded-lg bg-green-50 text-green-700 border border-green-200';
            resultEl.innerHTML = `✅ เชื่อมต่อสำเร็จ!<br><span class="text-xs">Version: ${result.version}</span>`;
        } else {
            resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
            resultEl.textContent = `❌ เชื่อมต่อไม่ได้: ${result.error}`;
        }
    } catch {
        resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
        resultEl.textContent = '❌ ไม่สามารถติดต่อ Server ได้';
    }
}

async function saveDbConnection() {
    const data = getDbFormData();
    const resultEl = document.getElementById('testResult');
    resultEl.className = 'text-sm p-3 rounded-lg bg-blue-50 text-blue-700';
    resultEl.textContent = '⏳ กำลังเชื่อมต่อ...';
    resultEl.classList.remove('hidden');

    try {
        const res = await fetch(`${SETTINGS_URL}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            resultEl.className = 'text-sm p-3 rounded-lg bg-green-50 text-green-700 border border-green-200';
            resultEl.textContent = '✅ เชื่อมต่อและบันทึกสำเร็จ!';
            updateDbStatus(true, data);
            loadHospitalName();
            setTimeout(() => closeDbModal(), 1500);
        } else {
            resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
            resultEl.textContent = `❌ เชื่อมต่อไม่ได้: ${result.error}`;
        }
    } catch {
        resultEl.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
        resultEl.textContent = '❌ ไม่สามารถติดต่อ Server ได้';
    }
}

async function clearDbConnection() {
    if (!confirm('ต้องการล้างการเชื่อมต่อฐานข้อมูลใช่ไหม?')) return;
    try {
        await fetch(`${SETTINGS_URL}/disconnect`, { method: 'POST' });
        document.getElementById('dbType').value = '';
        document.getElementById('dbHost').value = '';
        document.getElementById('dbPort').value = '';
        document.getElementById('dbName').value = '';
        document.getElementById('dbUser').value = '';
        document.getElementById('dbPassword').value = '';
        document.getElementById('testResult').classList.add('hidden');

        const statusEl = document.getElementById('modalConnStatus');
        statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-red-100 text-red-700';
        statusEl.textContent = '❌ ยังไม่ได้เชื่อมต่อ';
        updateDbStatus(false, {});
    } catch {}
}

// =====================================
// Create Tables
// =====================================

async function checkAndUpdateTableBtn() {
    const btn = document.getElementById('createTablesBtn');
    if (!btn) return;
    try {
        const res = await fetch(`${SETTINGS_URL}/check-tables`);
        const data = await res.json();
        if (data.complete) {
            btn.disabled = true;
            btn.className = 'w-full bg-gray-300 text-gray-500 font-semibold py-2.5 px-4 rounded-lg text-sm cursor-not-allowed';
            btn.innerHTML = '<i class="fas fa-check mr-2"></i>สร้างตาราง P4P แล้ว';
        } else {
            btn.disabled = false;
            btn.className = 'w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm';
            btn.innerHTML = '<i class="fas fa-table mr-2"></i>สร้างตาราง P4P';
        }
    } catch {
        // เกิด error — reset กลับเป็นสีส้มให้กดได้
        btn.disabled = false;
        btn.className = 'w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm';
        btn.innerHTML = '<i class="fas fa-table mr-2"></i>สร้างตาราง P4P';
    }
}

async function createTables() {
    const btn = document.getElementById('createTablesBtn');
    const resultEl = document.getElementById('createTableResult');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>กำลังสร้างตาราง...';
    resultEl.classList.add('hidden');

    try {
        const res = await fetch(`${SETTINGS_URL}/create-tables`, { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            const tableRows = data.logs.map(table => {
                const isCreated = table.status === 'created';
                const addedCols = table.columns.filter(c => c.action === 'added');
                const existsCols = table.columns.filter(c => c.action === 'exists' || c.action === 'created');

                let statusBadge = isCreated
                    ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">สร้างใหม่</span>'
                    : addedCols.length > 0
                        ? '<span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-semibold">เพิ่ม column</span>'
                        : '<span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold">มีอยู่แล้ว</span>';

                let detail = '';
                if (addedCols.length > 0) {
                    detail = `<p class="text-xs text-yellow-700 mt-1">➕ เพิ่ม: ${addedCols.map(c => c.name).join(', ')}</p>`;
                }

                return `
                    <div class="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                        <div>
                            <p class="text-sm font-mono font-semibold text-gray-700">${table.name}</p>
                            <p class="text-xs text-gray-400">${existsCols.length} columns</p>
                            ${detail}
                        </div>
                        ${statusBadge}
                    </div>`;
            }).join('');

            resultEl.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p class="font-semibold text-green-800 mb-3">
                        <i class="fas fa-check-circle mr-2"></i>ดำเนินการเสร็จสิ้น
                    </p>
                    <div>${tableRows}</div>
                </div>`;
        } else {
            resultEl.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p class="font-semibold text-red-700">
                        <i class="fas fa-times-circle mr-2"></i>เกิดข้อผิดพลาด
                    </p>
                    <p class="text-sm text-red-600 mt-1">${data.error}</p>
                </div>`;
        }

        resultEl.classList.remove('hidden');
        await checkAndUpdateTableBtn();
    } catch {
        resultEl.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                <p class="text-red-700 text-sm">❌ ไม่สามารถติดต่อ Server ได้</p>
            </div>`;
        resultEl.classList.remove('hidden');
        await checkAndUpdateTableBtn();
    } finally {
    }
}

// =====================================
// Hospital Name
// =====================================

async function loadHospitalName() {
    const el = document.getElementById('hospitalName');
    if (!el) return;
    try {
        const res = await fetch(`${SETTINGS_URL}/hospital-name`);
        const data = await res.json();
        el.textContent = data.hospitalname || '';
    } catch {
        el.textContent = '';
    }
}

// =====================================
// Init
// =====================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkDbStatus();
    loadHospitalName();
});
