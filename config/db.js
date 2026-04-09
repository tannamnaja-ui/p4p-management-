const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// ===== อ่าน/เขียน settings =====
function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { db_type: '', db_host: '', db_port: '', db_user: '', db_password: '', db_name: '' };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

// ===== Connection State =====
let currentPool = null;
let currentType = null; // 'postgresql' | 'mysql'
let isConnected = false;

// ===== สร้าง Pool ตาม type =====
function createPool(settings) {
  const { db_type, db_host, db_port, db_user, db_password, db_name } = settings;

  if (db_type === 'postgresql') {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: db_host,
      port: parseInt(db_port) || 5432,
      user: db_user,
      password: db_password,
      database: db_name,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on('error', (err) => {
      console.error('❌ PostgreSQL pool error:', err.message);
      isConnected = false;
    });
    return pool;
  }

  if (db_type === 'mysql') {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: db_host,
      port: parseInt(db_port) || 3306,
      user: db_user,
      password: db_password,
      database: db_name,
      waitForConnections: true,
      connectionLimit: 20,
      connectTimeout: 5000
    });
    return pool;
  }

  return null;
}

// ===== ทดสอบ connection =====
async function testConnection(settings) {
  const { db_type } = settings;
  const pool = createPool(settings);

  if (!pool) {
    return { success: false, error: 'กรุณาเลือกประเภทฐานข้อมูล' };
  }

  try {
    if (db_type === 'postgresql') {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      client.release();
      await pool.end();
      return {
        success: true,
        time: result.rows[0].current_time,
        version: result.rows[0].pg_version
      };
    }

    if (db_type === 'mysql') {
      const conn = await pool.getConnection();
      const [rows] = await conn.query('SELECT NOW() as current_time, VERSION() as version');
      conn.release();
      await pool.end();
      return {
        success: true,
        time: rows[0].current_time,
        version: rows[0].version
      };
    }
  } catch (err) {
    try { await pool.end(); } catch {}
    return { success: false, error: err.message };
  }
}

// ===== เชื่อมต่อจริง (บันทึก pool ไว้ใช้) =====
async function connect(settings) {
  // ปิด pool เดิมถ้ามี
  if (currentPool) {
    try {
      if (currentType === 'postgresql') await currentPool.end();
      else if (currentType === 'mysql') await currentPool.end();
    } catch {}
    currentPool = null;
    currentType = null;
    isConnected = false;
  }

  const pool = createPool(settings);
  if (!pool) return { success: false, error: 'กรุณาเลือกประเภทฐานข้อมูล' };

  try {
    if (settings.db_type === 'postgresql') {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } else if (settings.db_type === 'mysql') {
      const conn = await pool.getConnection();
      await conn.query('SELECT 1');
      conn.release();
    }

    currentPool = pool;
    currentType = settings.db_type;
    isConnected = true;
    saveSettings(settings);
    console.log(`✅ Connected to ${settings.db_type} @ ${settings.db_host}:${settings.db_port}/${settings.db_name}`);
    return { success: true };
  } catch (err) {
    try { await pool.end(); } catch {}
    return { success: false, error: err.message };
  }
}

// ===== Query Wrapper (ใช้งาน pool ปัจจุบัน) =====
const pool = new Proxy({}, {
  get(_, prop) {
    if (!currentPool) {
      if (prop === 'query') {
        return async () => { throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล กรุณาตั้งค่าก่อน'); };
      }
    }
    if (prop === 'query') {
      return async (text, params) => {
        if (!currentPool) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
        if (currentType === 'postgresql') {
          return await currentPool.query(text, params);
        }
        if (currentType === 'mysql') {
          const [rows] = await currentPool.execute(text, params);
          return { rows, rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows };
        }
      };
    }
    return currentPool ? currentPool[prop] : undefined;
  }
});

async function getClient() {
  if (!currentPool) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');

  if (currentType === 'postgresql') {
    return await currentPool.connect();
  }

  if (currentType === 'mysql') {
    const conn = await currentPool.getConnection();
    // Wrap เพื่อให้ interface เหมือน pg client
    return {
      query: async (text, params) => {
        // แปลง $1,$2 → ? สำหรับ MySQL
        const mysqlText = text.replace(/\$(\d+)/g, '?');
        const [rows] = await conn.execute(mysqlText, params);
        return { rows, rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows };
      },
      release: () => conn.release()
    };
  }
}

async function closePool() {
  if (currentPool) {
    await currentPool.end();
    currentPool = null;
    currentType = null;
    isConnected = false;
  }
}

module.exports = {
  pool,
  getClient,
  closePool,
  testConnection,
  connect,
  loadSettings,
  saveSettings,
  isConnected: () => isConnected,
  currentType: () => currentType
};
