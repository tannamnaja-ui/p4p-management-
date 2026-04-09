const API_URL = 'http://localhost:3009/api/p4p';
const SETTINGS_URL = 'http://localhost:3009/api/settings';

let selectedIncome = null;
let selectedIncomeName = null;

// =====================================
// Utility Functions
// =====================================

function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alert');
    const bgColor = type === 'success' ? 'bg-green-100 border-green-500 text-green-800' :
                     type === 'error' ? 'bg-red-100 border-red-500 text-red-800' :
                     'bg-blue-100 border-blue-500 text-blue-800';
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    alertDiv.className = `border-l-4 ${bgColor} p-4 rounded-lg`;
    alertDiv.innerHTML = `
        <div class="flex items-center">
            <span class="text-xl mr-3">${icon}</span>
            <div class="flex-1">${message}</div>
            <button onclick="hideAlert()" class="ml-4 text-gray-600 hover:text-gray-800">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    alertDiv.classList.remove('hidden');
    setTimeout(() => alertDiv.classList.add('hidden'), 8000);
}

function hideAlert() {
    document.getElementById('alert').classList.add('hidden');
}

function showLoading(show = true) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

function setButtonLoading(buttonId, loading = true, text = '') {
    const btn = document.getElementById(buttonId);
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${text || 'กำลังประมวลผล...'}`;
    } else {
        btn.disabled = false;
    }
}

// =====================================
// DB Status Bar
// =====================================

function updateDbStatus(connected, dbType, dbHost) {
    const dot = document.getElementById('dbStatusDot');
    const text = document.getElementById('dbStatusText');
    const warning = document.getElementById('dbWarning');

    if (connected) {
        dot.className = 'w-2 h-2 rounded-full bg-green-400';
        text.textContent = `${dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'}: ${dbHost}`;
        warning.classList.add('hidden');
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-red-400';
        text.textContent = 'ตั้งค่าฐานข้อมูล';
        warning.classList.remove('hidden');
    }
}

async function checkDbStatus() {
    try {
        const res = await fetch(`${SETTINGS_URL}/connection`);
        const data = await res.json();
        updateDbStatus(data.connected, data.db_type, data.db_host);
        return data.connected;
    } catch {
        updateDbStatus(false, '', '');
        return false;
    }
}

// =====================================
// DB Modal
// =====================================

async function openDbModal() {
    document.getElementById('dbModal').classList.add('show');
    document.getElementById('testResult').classList.add('hidden');

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
            statusEl.textContent = `✅ เชื่อมต่ออยู่: ${data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL'} @ ${data.db_host}`;
            statusEl.classList.remove('hidden');
        } else {
            statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-red-100 text-red-700';
            statusEl.textContent = '❌ ยังไม่ได้เชื่อมต่อ';
            statusEl.classList.remove('hidden');
        }

        setDefaultPort();
    } catch {
        // ignore
    }
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

document.getElementById('dbType').addEventListener('change', setDefaultPort);

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
            resultEl.innerHTML = `✅ เชื่อมต่อสำเร็จ!<br><span class="text-xs text-green-600">Version: ${result.version}</span>`;
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

            const statusEl = document.getElementById('modalConnStatus');
            statusEl.className = 'text-sm text-center py-2 px-4 rounded-lg font-semibold bg-green-100 text-green-700';
            statusEl.textContent = `✅ เชื่อมต่ออยู่: ${data.db_type === 'postgresql' ? 'PostgreSQL' : 'MySQL'} @ ${data.db_host}`;

            updateDbStatus(true, data.db_type, data.db_host);
            showAlert('เชื่อมต่อฐานข้อมูลสำเร็จ!', 'success');
            loadIncomeList();

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

        updateDbStatus(false, '', '');
        showAlert('ล้างการเชื่อมต่อแล้ว', 'info');
    } catch {
        showAlert('เกิดข้อผิดพลาด', 'error');
    }
}

// =====================================
// Load Income List
// =====================================

async function loadIncomeList() {
    const select = document.getElementById('incomeSelect');
    select.innerHTML = '<option value="">⏳ กำลังโหลด...</option>';
    select.disabled = true;
    try {
        const response = await fetch(`${API_URL}/income-list`);
        const result = await response.json();

        select.innerHTML = '<option value="">-- เลือก Income --</option>';
        if (result.success && result.data.length > 0) {
            result.data.forEach(income => {
                const option = document.createElement('option');
                option.value = income.income;
                const imported = parseInt(income.imported_count) || 0;
                const total = parseInt(income.item_count) || 0;
                const remaining = total - imported;
                const badge = remaining > 0
                    ? ` (ยังไม่ได้นำเข้า ${remaining} รายการ)`
                    : total > 0 ? ` ✓ นำเข้าครบแล้ว` : '';
                option.textContent = `${income.name} (${income.income})${badge}`;
                option.dataset.name = income.name;
                option.dataset.count = remaining > 0 ? remaining : total;
                select.appendChild(option);
            });
            showAlert(`โหลดรายการ Income สำเร็จ: ${result.count} รายการ`, 'info');
        } else if (!result.success) {
            showAlert('ไม่สามารถโหลดรายการ Income ได้: ' + (result.error || result.message), 'error');
        } else {
            showAlert('ไม่พบรายการ Income ในฐานข้อมูล', 'error');
        }
    } catch (error) {
        console.error('Error loading income list:', error);
        select.innerHTML = '<option value="">❌ โหลดไม่สำเร็จ</option>';
        showAlert('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
    } finally {
        select.disabled = false;
    }
}

// =====================================
// Income Selection
// =====================================

document.getElementById('incomeSelect').addEventListener('change', async (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    selectedIncome = e.target.value;
    selectedIncomeName = selectedOption.dataset.name;
    const itemCount = selectedOption.dataset.count;

    if (!selectedIncome) {
        document.getElementById('incomeInfo').classList.add('hidden');
        document.getElementById('previewSection').innerHTML = '<p class="text-gray-500 text-center py-8">กรุณาเลือก Income ก่อน</p>';
        document.getElementById('importBtn').disabled = true;
        document.getElementById('refreshPreviewBtn').disabled = true;
        return;
    }

    document.getElementById('selectedIncome').textContent = selectedIncome;
    document.getElementById('selectedName').textContent = selectedIncomeName;
    document.getElementById('itemCount').textContent = itemCount;
    document.getElementById('incomeInfo').classList.remove('hidden');
    document.getElementById('importBtn').disabled = false;
    document.getElementById('refreshPreviewBtn').disabled = false;

    await loadPreviewData(selectedIncome);
});

// =====================================
// Preview Data
// =====================================

async function loadPreviewData(income) {
    const previewSection = document.getElementById('previewSection');
    previewSection.innerHTML = '<p class="text-gray-500 text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูล...</p>';

    try {
        const response = await fetch(`${API_URL}/nondrugitems/${income}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            const table = `
                <div class="bg-blue-50 p-3 rounded-lg mb-3 flex items-center justify-between">
                    <p class="text-sm text-blue-800">
                        <i class="fas fa-info-circle mr-2"></i>แสดงทั้งหมด ${result.count} รายการที่ต้องนำเข้า
                    </p>
                    <div class="flex items-center space-x-2">
                        <button onclick="selectAllItems(true)" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs">
                            <i class="fas fa-check-double mr-1"></i>เลือกทั้งหมด
                        </button>
                        <button onclick="selectAllItems(false)" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs">
                            <i class="fas fa-times mr-1"></i>ยกเลิกทั้งหมด
                        </button>
                    </div>
                </div>
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                                <input type="checkbox" id="selectAllCheckbox" onchange="selectAllItems(this.checked)" class="w-4 h-4" checked>
                            </th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">รหัส</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อรายการ</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ราคา</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Income</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${result.data.map(item => `
                            <tr class="hover:bg-gray-50 ${item.already_imported ? 'bg-blue-50' : ''}">
                                <td class="px-4 py-3 text-center">
                                    <input type="checkbox" class="item-checkbox w-4 h-4" value="${item.icode}" data-item='${JSON.stringify(item)}' checked>
                                </td>
                                <td class="px-4 py-3 text-sm font-mono">${item.icode}</td>
                                <td class="px-4 py-3 text-sm">${item.name}</td>
                                <td class="px-4 py-3 text-sm text-right">${parseFloat(item.unitprice || item.price || 0).toFixed(2)}</td>
                                <td class="px-4 py-3 text-sm">${item.income}</td>
                                <td class="px-4 py-3 text-sm">
                                    ${item.already_imported
                                        ? '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"><i class="fas fa-check mr-1"></i>นำเข้าแล้ว</span>'
                                        : '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">ยังไม่ได้นำเข้า</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
            previewSection.innerHTML = table;
        } else {
            previewSection.innerHTML = '<p class="text-gray-500 text-center py-8">ไม่พบข้อมูล</p>';
        }
    } catch (error) {
        console.error('Error loading preview:', error);
        previewSection.innerHTML = '<p class="text-red-500 text-center py-8">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

// =====================================
// Import Data
// =====================================

document.getElementById('importBtn').addEventListener('click', async () => {
    if (!selectedIncome) { showAlert('กรุณาเลือก Income ก่อน', 'error'); return; }

    const selectedCheckboxes = document.querySelectorAll('.item-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showAlert('กรุณาเลือกรายการที่ต้องการ Import อย่างน้อย 1 รายการ', 'error');
        return;
    }

    const selectedItems = Array.from(selectedCheckboxes).map(cb => JSON.parse(cb.dataset.item));
    if (!confirm(`ยืนยันการ Import ${selectedItems.length} รายการจาก Income: ${selectedIncomeName} (${selectedIncome}) ?`)) return;

    setButtonLoading('importBtn', true, 'กำลัง Import ข้อมูล...');
    showLoading(true);

    try {
        const token = sessionStorage.getItem('p4p_token') || '';
        const officer = JSON.parse(sessionStorage.getItem('p4p_officer') || '{}');
        const response = await fetch(`${API_URL}/import-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                income: selectedIncome,
                user_id: officer.name || officer.login_name || 'admin',
                selected_items: selectedItems
            })
        });
        const result = await response.json();

        if (result.success) {
            const summary = result.summary;
            const totalImported = summary.total_items;
            const inserted = summary.p4p_doctor_point.inserted;
            const updated  = summary.p4p_doctor_point.updated;

            document.getElementById('importResult').innerHTML = `
                <div class="bg-green-50 border border-green-300 rounded-xl p-5">
                    <div class="flex items-center mb-4">
                        <div class="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center mr-3">
                            <i class="fas fa-check text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-green-800 text-lg">นำเข้าข้อมูลสำเร็จ!</h3>
                            <p class="text-green-700 text-sm">นำเข้าทั้งหมด <strong>${totalImported} รายการ</strong> เรียบร้อยแล้ว</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3 text-center text-sm">
                        <div class="bg-white rounded-lg p-3 border border-green-200">
                            <p class="text-2xl font-bold text-green-600">${inserted}</p>
                            <p class="text-gray-600 mt-1"><i class="fas fa-plus-circle text-green-500 mr-1"></i>เพิ่มใหม่</p>
                        </div>
                        <div class="bg-white rounded-lg p-3 border border-blue-200">
                            <p class="text-2xl font-bold text-blue-600">${updated}</p>
                            <p class="text-gray-600 mt-1"><i class="fas fa-edit text-blue-500 mr-1"></i>อัปเดต</p>
                        </div>
                        <div class="bg-white rounded-lg p-3 border border-gray-200">
                            <p class="text-2xl font-bold text-gray-600">${summary.p4p_doctor_point.skipped}</p>
                            <p class="text-gray-600 mt-1"><i class="fas fa-minus-circle text-gray-400 mr-1"></i>ข้ามไป</p>
                        </div>
                    </div>
                </div>`;
            document.getElementById('importResult').classList.remove('hidden');

            // แจ้งเตือนสรุปผล
            showAlert(`✅ นำเข้าทั้งหมดแล้ว ${totalImported} รายการ (เพิ่มใหม่ ${inserted} | อัปเดต ${updated})`, 'success');

            // refresh income dropdown และ preview
            await loadIncomeList();
            if (selectedIncome) {
                await loadPreviewData(selectedIncome);
            }
        } else {
            showAlert(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Error importing:', error);
        showAlert('เกิดข้อผิดพลาดในการ Import ข้อมูล', 'error');
    } finally {
        setButtonLoading('importBtn', false);
        document.getElementById('importBtn').innerHTML = '<i class="fas fa-download mr-2"></i>Import ข้อมูล';
        showLoading(false);
    }
});

// =====================================
// View Imported Data
// =====================================

async function viewImportedData(table = 'p4p') {
    const section = document.getElementById('importedDataSection');
    section.innerHTML = '<p class="text-gray-500 text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูล...</p>';

    try {
        const endpoint = table === 'p4p' ? '/p4p-doctor-point' : '/tmp-p4p-point';
        const response = await fetch(`${API_URL}${endpoint}?limit=50`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            let tableHtml = '';
            if (table === 'tmp') {
                tableHtml = `
                    <div class="bg-indigo-50 p-3 rounded-lg mb-3">
                        <p class="text-sm text-indigo-800"><i class="fas fa-info-circle mr-2"></i>แสดง ${result.count} รายการ จาก <strong>tmp_p4p_point</strong></p>
                    </div>
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50"><tr>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">รหัส</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Income Name</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อรายการ</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ราคา</th>
                            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Point เดิม</th>
                            <th class="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Point ใหม่</th>
                            <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">จัดการ</th>
                        </tr></thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${result.data.map(item => `
                                <tr class="hover:bg-indigo-50" id="tmprow-${item.icode}">
                                    <td class="px-4 py-3 text-sm font-mono text-indigo-700">${item.icode||'-'}</td>
                                    <td class="px-4 py-3 text-sm">${item.income_name||'-'}</td>
                                    <td class="px-4 py-3 text-sm">${item.meaning||'-'}</td>
                                    <td class="px-4 py-3 text-sm text-right">${item.price?parseFloat(item.price).toFixed(2):'0.00'}</td>
                                    <td class="px-4 py-3 text-sm text-right text-gray-500" id="tmp-point-old-${item.icode}">${item.point_old!=null?parseFloat(item.point_old).toFixed(2):'-'}</td>
                                    <td class="px-4 py-3 text-sm text-right font-semibold text-indigo-800" id="tmp-point-new-${item.icode}">${item.point_new!=null?parseFloat(item.point_new).toFixed(2):'-'}</td>
                                    <td class="px-4 py-3 text-center">
                                        <button onclick="openTmpLogModal('${item.icode}')"
                                            class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs">
                                            <i class="fas fa-history mr-1"></i>Log
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                    <!-- Log Modal -->
                    <div id="tmpLogModal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50">
                        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onclick="event.stopPropagation()">
                            <div class="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 class="text-lg font-bold"><i class="fas fa-history mr-2"></i>ประวัติการแก้ไข</h3>
                                    <p class="text-amber-100 text-xs mt-0.5">รหัส: <span id="tmpLogIcodeLabel" class="font-mono font-bold"></span></p>
                                </div>
                                <button onclick="closeTmpLogModal()" class="text-white hover:text-amber-200 text-xl"><i class="fas fa-times"></i></button>
                            </div>
                            <div id="tmpLogContent" class="p-6 overflow-y-auto flex-1"></div>
                            <div class="px-6 pb-4 flex-shrink-0 text-right border-t pt-4">
                                <button onclick="closeTmpLogModal()" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg text-sm transition">
                                    <i class="fas fa-times mr-2"></i>ปิด
                                </button>
                            </div>
                        </div>
                    </div>`;
            } else {
                tableHtml = `
                    <div class="bg-purple-50 p-3 rounded-lg mb-3">
                        <p class="text-sm text-purple-800"><i class="fas fa-info-circle mr-2"></i>แสดง ${result.count} รายการ จาก <strong>p4p_doctor_point</strong></p>
                    </div>
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50"><tr>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">รหัส</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Income</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Point</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">สถานะ</th>
                            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">วันที่อัปเดต</th>
                        </tr></thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${result.data.map(item => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-3 text-sm">${item.p4p_items_point_id||item.id||'-'}</td>
                                    <td class="px-4 py-3 text-sm font-mono">${item.icode||'-'}</td>
                                    <td class="px-4 py-3 text-sm">${item.income||'-'}</td>
                                    <td class="px-4 py-3 text-sm text-right">${item.point?parseFloat(item.point).toFixed(2):'0.00'}</td>
                                    <td class="px-4 py-3 text-sm">
                                        <span class="px-2 py-1 ${item.istatus==='Y'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'} rounded-full text-xs">
                                            ${item.istatus==='Y'?'Active':'Inactive'}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-sm">${item.update_datetime?new Date(item.update_datetime).toLocaleString('th-TH'):'-'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`;
            }
            section.innerHTML = tableHtml;
        } else {
            section.innerHTML = '<p class="text-gray-500 text-center py-8">ไม่พบข้อมูล</p>';
        }
    } catch (error) {
        section.innerHTML = '<p class="text-red-500 text-center py-8">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

document.getElementById('viewP4PBtn')?.addEventListener('click', () => viewImportedData('p4p'));
document.getElementById('viewTmpBtn')?.addEventListener('click', () => viewImportedData('tmp'));

// =====================================
// Log Modal for tmp_p4p_point (view only)
// =====================================

async function openTmpLogModal(icode) {
    document.getElementById('tmpLogIcodeLabel').textContent = icode;
    document.getElementById('tmpLogContent').innerHTML =
        '<p class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</p>';
    document.getElementById('tmpLogModal').classList.remove('hidden');

    try {
        const res = await fetch(`${API_URL}/p4p-doctor-point/${icode}/logs`);
        const result = await res.json();

        if (result.success && result.data.length > 0) {
            document.getElementById('tmpLogContent').innerHTML = `
                <table class="min-w-full text-sm divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">วันที่/เวลา</th>
                            <th class="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Point เดิม</th>
                            <th class="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Point ใหม่</th>
                            <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">โดย</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${result.data.map((log, i) => `
                            <tr class="${i === 0 ? 'bg-amber-50' : 'hover:bg-gray-50'}">
                                <td class="px-4 py-2 text-gray-600">${new Date(log.update_datetime).toLocaleString('th-TH')}</td>
                                <td class="px-4 py-2 text-right text-red-600 font-semibold">${log.point_old != null ? parseFloat(log.point_old).toFixed(2) : '-'}</td>
                                <td class="px-4 py-2 text-right text-green-600 font-semibold">${log.point_new != null ? parseFloat(log.point_new).toFixed(2) : '-'}</td>
                                <td class="px-4 py-2 text-gray-700">${log.officer_name || '-'}${i === 0 ? ' <span class="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">ล่าสุด</span>' : ''}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;
        } else {
            document.getElementById('tmpLogContent').innerHTML =
                '<p class="text-center py-8 text-gray-400"><i class="fas fa-inbox mr-2"></i>ยังไม่มีประวัติการแก้ไข</p>';
        }
    } catch (err) {
        document.getElementById('tmpLogContent').innerHTML =
            `<p class="text-center py-8 text-red-400">เกิดข้อผิดพลาด: ${err.message}</p>`;
    }
}

function closeTmpLogModal() {
    document.getElementById('tmpLogModal').classList.add('hidden');
}
document.getElementById('refreshPreviewBtn')?.addEventListener('click', () => {
    if (selectedIncome) loadPreviewData(selectedIncome);
});

// =====================================
// Select All
// =====================================

function selectAllItems(checked) {
    document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = checked);
    const all = document.getElementById('selectAllCheckbox');
    if (all) all.checked = checked;
}

// =====================================
// Initialize
// =====================================

document.addEventListener('DOMContentLoaded', async () => {
    const connected = await checkDbStatus();
    if (connected) {
        loadIncomeList();
    }
    // กด Escape ปิด log modal
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeTmpLogModal();
    });
});
