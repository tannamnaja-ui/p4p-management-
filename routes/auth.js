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
    }
  });
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
