const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: ดึง settings ปัจจุบัน
router.get('/connection', (req, res) => {
  const settings = db.loadSettings();
  res.json({
    success: true,
    connected: db.isConnected(),
    db_type: settings.db_type,
    db_host: settings.db_host,
    db_port: settings.db_port,
    db_user: settings.db_user,
    db_name: settings.db_name,
    db_password: settings.db_password || ''
  });
});

// POST: ทดสอบ connection
router.post('/test', async (req, res) => {
  const { db_type, db_host, db_port, db_user, db_password, db_name } = req.body;

  if (!db_type || !db_host || !db_user || !db_name) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  const result = await db.testConnection({ db_type, db_host, db_port, db_user, db_password, db_name });
  res.json(result);
});

// POST: บันทึกและเชื่อมต่อ
router.post('/connect', async (req, res) => {
  let { db_type, db_host, db_port, db_user, db_password, db_name } = req.body;

  if (!db_type || !db_host || !db_user || !db_name) {
    return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  // ถ้า password ว่างเปล่า ให้ใช้ password ที่บันทึกไว้เดิม
  if (!db_password) {
    const saved = db.loadSettings();
    if (saved.db_password) {
      db_password = saved.db_password;
    }
  }

  const result = await db.connect({ db_type, db_host, db_port, db_user, db_password: db_password || '', db_name });
  res.json(result);
});

// POST: สร้างตาราง p4p_doctor_point, tmp_p4p_point, p4p_point_log
router.post('/create-tables', async (req, res) => {
  const TABLE_DEFINITIONS = [
    {
      name: 'p4p_doctor_point',
      columns: [
        { name: 'p4p_items_point_id', pg: 'INTEGER',       my: 'INT' },
        { name: 'icode',              pg: 'VARCHAR(7)',    my: 'VARCHAR(7)' },
        { name: 'p4p_items_type_id',  pg: 'INTEGER',       my: 'INT' },
        { name: 'point',              pg: 'NUMERIC',       my: 'DECIMAL(15,2)' },
        { name: 'istatus',            pg: 'CHAR(1)',        my: 'CHAR(1)' },
        { name: 'income',             pg: 'CHAR(2)',        my: 'CHAR(2)' },
        { name: 'begin_date',         pg: 'DATE',          my: 'DATE' },
        { name: 'finish_date',        pg: 'DATE',          my: 'DATE' },
        { name: 'update_datetime',    pg: 'TIMESTAMP',     my: 'DATETIME' },
      ]
    },
    {
      name: 'tmp_p4p_point',
      columns: [
        { name: 'income_name', pg: 'VARCHAR(200)',  my: 'VARCHAR(200)' },
        { name: 'icode',       pg: 'VARCHAR(7)',    my: 'VARCHAR(7)' },
        { name: 'meaning',     pg: 'VARCHAR(200)',  my: 'VARCHAR(200)' },
        { name: 'price',       pg: 'NUMERIC',       my: 'DECIMAL(15,2)' },
        { name: 'point_old',   pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
        { name: 'point_new',   pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
        { name: 'icd9cm',      pg: 'VARCHAR(10)',   my: 'VARCHAR(10)' },
      ]
    },
    {
      name: 'p4p_point_log',
      columns: [
        { name: 'p4p_point_log_id', pg: 'INTEGER',       my: 'INT' },
        { name: 'icode',            pg: 'VARCHAR(7)',    my: 'VARCHAR(7)' },
        { name: 'point_old',        pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
        { name: 'point_new',        pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
        { name: 'update_datetime',  pg: 'TIMESTAMP',     my: 'DATETIME' },
        { name: 'officer_id',       pg: 'INTEGER',       my: 'INT' },
        { name: 'officer_name',     pg: 'VARCHAR(200)',  my: 'VARCHAR(200)' },
      ]
    }
  ];

  const settings = db.loadSettings();
  const dbType = db.currentType();
  const logs = [];

  try {
    for (const table of TABLE_DEFINITIONS) {
      const tableLog = { name: table.name, status: '', columns: [] };

      // ตรวจสอบว่ามีตารางหรือไม่
      let tableExists = false;
      if (dbType === 'postgresql') {
        const r = await db.pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) as exists`,
          [table.name]
        );
        tableExists = r.rows[0].exists;
      } else {
        const r = await db.pool.query(
          `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,
          [table.name]
        );
        tableExists = parseInt(r.rows[0].cnt) > 0;
      }

      if (!tableExists) {
        // สร้างตารางใหม่
        const colDefs = dbType === 'postgresql'
          ? table.columns.map(c => `${c.name} ${c.pg}`).join(', ')
          : table.columns.map(c => `\`${c.name}\` ${c.my}`).join(', ');

        const createSQL = dbType === 'postgresql'
          ? `CREATE TABLE ${table.name} (${colDefs})`
          : `CREATE TABLE \`${table.name}\` (${colDefs}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

        await db.pool.query(createSQL);
        tableLog.status = 'created';
        tableLog.columns = table.columns.map(c => ({ name: c.name, action: 'created' }));
      } else {
        tableLog.status = 'exists';

        // ดึง columns ที่มีอยู่
        let existingSet;
        if (dbType === 'postgresql') {
          const r = await db.pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
            [table.name]
          );
          existingSet = new Set(r.rows.map(row => row.column_name));
        } else {
          const r = await db.pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`,
            [table.name]
          );
          existingSet = new Set(r.rows.map(row => row.column_name));
        }

        for (const col of table.columns) {
          if (!existingSet.has(col.name)) {
            const alterSQL = dbType === 'postgresql'
              ? `ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.pg}`
              : `ALTER TABLE \`${table.name}\` ADD COLUMN \`${col.name}\` ${col.my}`;
            await db.pool.query(alterSQL);
            tableLog.columns.push({ name: col.name, action: 'added' });
          } else {
            tableLog.columns.push({ name: col.name, action: 'exists' });
          }
        }
      }

      logs.push(tableLog);
    }

    res.json({ success: true, logs });
  } catch (err) {
    console.error('Error creating tables:', err);
    res.status(500).json({ success: false, error: err.message, logs });
  }
});

// GET: ตรวจสอบว่าตาราง P4P ครบถ้วนหรือไม่ (รายงานสถานะของทุกตาราง พร้อมชื่อตาราง)
router.get('/check-tables', async (req, res) => {
  const REQUIRED_LIST = [
    { name: 'p4p_doctor_point',     cols: ['p4p_items_point_id','icode','p4p_items_type_id','point','istatus','income','begin_date','finish_date','update_datetime'] },
    { name: 'tmp_p4p_point',        cols: ['income_name','icode','meaning','price','point_old','point_new','icd9cm'] },
    { name: 'p4p_point_log',        cols: ['p4p_point_log_id','icode','point_old','point_new','update_datetime','officer_id','officer_name'] }
  ];

  if (!db.isConnected()) {
    return res.json({
      success: true,
      complete: false,
      reason: 'not_connected',
      tables: REQUIRED_LIST.map(t => ({ name: t.name, exists: false, missing_columns: [], complete: false }))
    });
  }

  const isMySQL = db.currentType() === 'mysql';
  const tables = [];
  let allComplete = true;

  try {
    for (const t of REQUIRED_LIST) {
      const tableCheck = isMySQL
        ? await db.pool.query(
            `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,
            [t.name]
          )
        : await db.pool.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) as exists`,
            [t.name]
          );
      const exists = isMySQL
        ? parseInt(tableCheck.rows[0].cnt) > 0
        : tableCheck.rows[0].exists;

      let missingColumns = [];
      if (exists) {
        const colCheck = isMySQL
          ? await db.pool.query(
              `SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=?`,
              [t.name]
            )
          : await db.pool.query(
              `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
              [t.name]
            );
        const existingCols = new Set(colCheck.rows.map(r => r.column_name));
        missingColumns = t.cols.filter(c => !existingCols.has(c));
      }

      const complete = exists && missingColumns.length === 0;
      if (!complete) allComplete = false;
      tables.push({ name: t.name, exists, missing_columns: missingColumns, complete });
    }

    return res.json({ success: true, complete: allComplete, tables });
  } catch (err) {
    return res.json({
      success: true,
      complete: false,
      reason: err.message,
      tables: REQUIRED_LIST.map(t => ({ name: t.name, exists: false, missing_columns: [], complete: false }))
    });
  }
});

// GET: ดึงรายการห้องทำงาน สำหรับ dropdown หน้า login
router.get('/departments', async (req, res) => {
  if (!db.isConnected()) {
    return res.json({ success: true, data: [] });
  }
  try {
    const result = await db.pool.query(
      `SELECT depcode, department AS depname FROM kskdepartment WHERE depcode_active = 'Y' ORDER BY department`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.json({ success: false, data: [], error: err.message });
  }
});

// GET: ดึงชื่อโรงพยาบาลจาก opdconfig
router.get('/hospital-name', async (req, res) => {
  try {
    const result = await db.pool.query(
      'SELECT hospitalname FROM opdconfig LIMIT 1'
    );
    const name = result.rows[0]?.hospitalname || '';
    res.json({ success: true, hospitalname: name });
  } catch (err) {
    res.json({ success: false, hospitalname: '', error: err.message });
  }
});

// POST: ล้าง connection
router.post('/disconnect', async (req, res) => {
  try {
    await db.closePool();
    db.saveSettings({ db_type: '', db_host: '', db_port: '', db_user: '', db_password: '', db_name: '' });
    res.json({ success: true, message: 'ล้างการเชื่อมต่อแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
