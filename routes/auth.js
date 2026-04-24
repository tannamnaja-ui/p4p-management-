const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');

// ===== In-memory session store =====
// Map<token, { officer_id, officer_name, login_name, created_at }>
const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

// =====================================
// POST /api/auth/login
// =====================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'กรุณากรอก Username และ Password' });
  }

  if (!db.isConnected()) {
    return res.status(503).json({ success: false, error: 'ยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาตั้งค่าการเชื่อมต่อก่อน' });
  }

  const passwordMd5 = crypto.createHash('md5').update(password).digest('hex').toUpperCase();

  try {
    const isMySQL = db.currentType() === 'mysql';
    const query = isMySQL
      ? `SELECT officer_id, officer_login_name, officer_name
         FROM officer
         WHERE officer_login_name = ?
           AND officer_login_password_md5 = ?
           AND officer_active = 'Y'
         LIMIT 1`
      : `SELECT officer_id, officer_login_name, officer_name
         FROM officer
         WHERE officer_login_name = $1
           AND officer_login_password_md5 = $2
           AND officer_active = 'Y'
         LIMIT 1`;

    const result = await db.pool.query(query, [username, passwordMd5]);

    if (result.rows.length === 0) {
      // ตรวจสอบว่า user มีอยู่แต่ไม่ active หรือ password ผิด
      const isMySQL2 = db.currentType() === 'mysql';
      const checkQuery = isMySQL2
        ? `SELECT officer_active FROM officer WHERE officer_login_name = ? AND officer_login_password_md5 = ? LIMIT 1`
        : `SELECT officer_active FROM officer WHERE officer_login_name = $1 AND officer_login_password_md5 = $2 LIMIT 1`;
      const checkResult = await db.pool.query(checkQuery, [username, passwordMd5]);

      if (checkResult.rows.length > 0) {
        return res.status(401).json({ success: false, error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน (officer_active ไม่ใช่ Y)' });
      }
      return res.status(401).json({ success: false, error: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const officer = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');

    sessions.set(token, {
      officer_id: officer.officer_id,
      officer_name: officer.officer_name,
      login_name: officer.officer_login_name,
      created_at: Date.now()
    });

    console.log(`✅ Login: ${officer.officer_login_name} (${officer.officer_name})`);

    res.json({
      success: true,
      token,
      officer: {
        id: officer.officer_id,
        name: officer.officer_name,
        login_name: officer.officer_login_name
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// =====================================
// POST /api/auth/verify
// =====================================
router.post('/verify', (req, res) => {
  const { token } = req.body;

  if (!token || !sessions.has(token)) {
    return res.json({ success: false, valid: false });
  }

  const session = sessions.get(token);

  if (Date.now() - session.created_at > SESSION_TTL) {
    sessions.delete(token);
    return res.json({ success: false, valid: false });
  }

  res.json({
    success: true,
    valid: true,
    officer: {
      id: session.officer_id,
      name: session.officer_name,
      login_name: session.login_name
    },
    db: {
      db_name: session.db_name || '',
      db_type: session.db_type || '',
      db_host: session.db_host || '',
      db_port: session.db_port || '',
      db_user: session.db_user || ''
    }
  });
});

// =====================================
// POST /api/auth/reconnect
// =====================================
router.post('/reconnect', async (req, res) => {
  const { token } = req.body;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: 'Session หมดอายุ กรุณา Login ใหม่' });
  }
  const session = sessions.get(token);
  if (Date.now() - session.created_at > SESSION_TTL) {
    sessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session หมดอายุ กรุณา Login ใหม่' });
  }
  const { db_type, db_host, db_port, db_name, db_user, db_password } = session;
  if (!db_host || !db_user || !db_name) {
    return res.status(400).json({ success: false, error: 'ไม่มีข้อมูล DB ใน Session กรุณา Login ใหม่' });
  }
  const result = await db.connect({ db_type, db_host, db_port, db_user, db_password: db_password || '', db_name });
  if (result.success) console.log(`✅ Reconnected: ${db_type} @ ${db_host}/${db_name}`);
  res.json(result);
});

// =====================================
// POST /api/auth/bms-login  (BMS HOSxP Session)
// =====================================
router.post('/bms-login', async (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: 'ไม่มี Session Code' });
  }

  try {
    const url = `https://hosxp.net/phapi/PasteJSON?Action=GET&code=${encodeURIComponent(code.trim())}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return res.status(401).json({ success: false, error: `BMS API ตอบกลับ HTTP ${response.status}` });
    }

    const text = await response.text();
    if (!text || text.trim() === '' || text.trim() === 'null') {
      return res.status(401).json({ success: false, error: 'Session Code ไม่ถูกต้องหรือหมดอายุ' });
    }

    let data;
    try { data = JSON.parse(text); } catch {
      return res.status(401).json({ success: false, error: 'BMS ตอบกลับข้อมูลไม่ถูกต้อง' });
    }

    if (!data || data.MessageCode !== 200) {
      return res.status(401).json({ success: false, error: 'Session Code ไม่ถูกต้องหรือหมดอายุ' });
    }

    // ดึงข้อมูล user จาก result.user_info (BMS PasteJSON format)
    const userInfo = data.result?.user_info || {};
    const loginName = userInfo.doctor_code || userInfo.user_cid || userInfo.bms_session_code || String(code.trim());
    const displayName = userInfo.name || loginName;

    // ดึงข้อมูล DB ครบทั้งหมดจาก BMS session
    const dbName     = userInfo.bms_database_name     || '';
    const dbType     = (userInfo.bms_database_type    || 'postgresql').toLowerCase();
    const dbHost     = userInfo.bms_database_host     || userInfo.bms_database_server || '';
    const dbPort     = String(userInfo.bms_database_port || (dbType === 'mysql' ? '3306' : '5432'));
    const dbUser     = userInfo.bms_database_username || userInfo.bms_database_user   || '';
    const dbPassword = userInfo.bms_database_password || '';

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      officer_id: loginName,
      officer_name: displayName,
      login_name: loginName,
      created_at: Date.now(),
      db_name: dbName,
      db_type: dbType,
      db_host: dbHost,
      db_port: dbPort,
      db_user: dbUser,
      db_password: dbPassword   // เก็บไว้ server-side เท่านั้น ไม่ส่งกลับ client
    });

    console.log(`✅ BMS Login: ${loginName} (${displayName})`);

    // Auto-connect ด้วยข้อมูลทั้งหมดจาก BMS
    if (dbHost && dbUser && dbName) {
      const connectResult = await db.connect({
        db_type: dbType, db_host: dbHost, db_port: dbPort,
        db_user: dbUser, db_password: dbPassword, db_name: dbName
      });
      if (connectResult.success) {
        console.log(`✅ Auto-connected: ${dbType} @ ${dbHost}/${dbName}`);
      } else {
        console.warn(`⚠️  Auto-connect failed: ${connectResult.error}`);
      }
    }

    // ส่ง db info กลับ client โดยไม่รวม password
    res.json({
      success: true,
      token,
      officer: { id: loginName, name: displayName, login_name: loginName },
      db: { db_name: dbName, db_type: dbType, db_host: dbHost, db_port: dbPort, db_user: dbUser }
    });

  } catch (err) {
    console.error('BMS login error:', err);
    res.status(500).json({ success: false, error: 'ไม่สามารถติดต่อ BMS ได้: ' + err.message });
  }
});

// =====================================
// POST /api/auth/logout
// =====================================
router.post('/logout', (req, res) => {
  const { token } = req.body;
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// =====================================
// Export: verifyToken สำหรับ route อื่นใช้
// =====================================
function verifyToken(token) {
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  if (Date.now() - session.created_at > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return { officer_id: session.officer_id, officer_name: session.officer_name, login_name: session.login_name };
}

module.exports = router;
module.exports.verifyToken = verifyToken;
