const express = require('express');
const router = express.Router();
const { pool, getClient } = require('../config/db');
const { verifyToken } = require('./auth');

// =====================================
// Helper: ดึงข้อมูล officer จาก Authorization header
// =====================================
function getOfficer(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { officer_id: null, officer_name: 'system' };
  const session = verifyToken(token);
  return session
    ? { officer_id: session.officer_id, officer_name: session.officer_name }
    : { officer_id: null, officer_name: 'system' };
}

// =====================================
// Helper: สร้างตาราง p4p_point_log ถ้ายังไม่มี
// =====================================
async function ensureP4PLogTable(client) {
  const check = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'p4p_point_log'
    ) as exists
  `);
  if (!check.rows[0].exists) {
    await client.query(`
      CREATE TABLE p4p_point_log (
        p4p_point_log_id SERIAL PRIMARY KEY,
        icode            VARCHAR(7),
        point_old        NUMERIC(15,3),
        point_new        NUMERIC(15,3),
        update_datetime  TIMESTAMP DEFAULT NOW(),
        officer_id       INTEGER,
        officer_name     VARCHAR(200)
      )
    `);
    console.log('✅ Created table: p4p_point_log');
  }
}

// =====================================
// Helper: batch insert log ลง p4p_point_log (1 query สำหรับทุกรายการ)
// =====================================
async function batchLogP4P(client, logItems, officerId, officerName) {
  if (!logItems || logItems.length === 0) return;
  const icodes     = logItems.map(l => l.icode);
  const pointOlds  = logItems.map(l => l.point_old ?? null);
  const pointNews  = logItems.map(l => l.point_new ?? 0);
  const officerIds = logItems.map(() => officerId ?? null);
  const officerNames = logItems.map(() => officerName ?? 'system');

  await client.query(`
    INSERT INTO p4p_point_log (icode, point_old, point_new, update_datetime, officer_id, officer_name)
    SELECT * FROM UNNEST(
      $1::text[], $2::numeric[], $3::numeric[], $4::timestamp[], $5::int[], $6::text[]
    ) AS t(icode, point_old, point_new, update_datetime, officer_id, officer_name)
  `, [icodes, pointOlds, pointNews, logItems.map(() => new Date()), officerIds, officerNames]);
}

// =====================================
// GET: ดึงรายการ Income ทั้งหมด
// =====================================
router.get('/income-list', async (req, res) => {
  try {
    // แสดง income ทั้งหมดจากตาราง income พร้อมนับจำนวนรายการและที่ import แล้ว
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'p4p_doctor_point'
      ) as exists
    `);
    const hasP4PTable = tableCheck.rows[0].exists;

    let result;
    if (hasP4PTable) {
      result = await pool.query(`
        SELECT
          i.income,
          i.name,
          i.income_group,
          COUNT(DISTINCT n.icode) as item_count,
          COUNT(DISTINCT p.icode) as imported_count
        FROM income i
        LEFT JOIN nondrugitems n ON i.income = n.income AND n.istatus = 'Y'
        LEFT JOIN p4p_doctor_point p ON n.icode = p.icode
        WHERE i.income IS NOT NULL AND i.name IS NOT NULL
        GROUP BY i.income, i.name, i.income_group
        ORDER BY i.income
      `);
    } else {
      result = await pool.query(`
        SELECT
          i.income,
          i.name,
          i.income_group,
          COUNT(DISTINCT n.icode) as item_count,
          0 as imported_count
        FROM income i
        LEFT JOIN nondrugitems n ON i.income = n.income AND n.istatus = 'Y'
        WHERE i.income IS NOT NULL AND i.name IS NOT NULL
        GROUP BY i.income, i.name, i.income_group
        ORDER BY i.income
      `);
    }

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching income list:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch income list',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงข้อมูล nondrugitems ตาม income
// =====================================
router.get('/nondrugitems/:income', async (req, res) => {
  try {
    const { income } = req.params;
    const { limit } = req.query;

    // ตรวจสอบว่ามีตาราง p4p_doctor_point หรือไม่
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'p4p_doctor_point'
      ) as exists
    `);
    const hasP4PTable = tableCheck.rows[0].exists;

    let queryText, queryParams;
    if (limit) {
      queryText = hasP4PTable
        ? `SELECT n.*, CASE WHEN p.icode IS NOT NULL THEN true ELSE false END AS already_imported
           FROM nondrugitems n
           LEFT JOIN p4p_doctor_point p ON n.icode = p.icode
           WHERE n.income = $1
             AND n.istatus = 'Y'
           ORDER BY n.name
           LIMIT $2`
        : `SELECT n.*, false AS already_imported
           FROM nondrugitems n
           WHERE n.income = $1
             AND n.istatus = 'Y'
           ORDER BY n.name
           LIMIT $2`;
      queryParams = [income, parseInt(limit)];
    } else {
      queryText = hasP4PTable
        ? `SELECT n.*, CASE WHEN p.icode IS NOT NULL THEN true ELSE false END AS already_imported
           FROM nondrugitems n
           LEFT JOIN p4p_doctor_point p ON n.icode = p.icode
           WHERE n.income = $1
             AND n.istatus = 'Y'
           ORDER BY n.name`
        : `SELECT n.*, false AS already_imported
           FROM nondrugitems n
           WHERE n.income = $1
             AND n.istatus = 'Y'
           ORDER BY n.name`;
      queryParams = [income];
    }

    const result = await pool.query(queryText, queryParams);

    return res.json({
      success: true,
      count: result.rowCount,
      income: income,
      data: result.rows
    });

  } catch (err) {
    console.error('Error fetching nondrugitems:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nondrugitems',
      message: err.message
    });
  }
});

// =====================================
// POST: Import ข้อมูลจาก nondrugitems ไปยัง p4p_doctor_point และ tmp_p4p_point
// =====================================
router.post('/import-data', async (req, res) => {
  const client = await getClient();
  const officer = getOfficer(req);

  try {
    const { income, user_id = 'system', selected_items } = req.body;
    const officerName = (officer.officer_name && officer.officer_name !== 'system')
      ? officer.officer_name : user_id;
    const officerId = officer.officer_id;

    if (!income)
      return res.status(400).json({ success: false, error: 'Missing required field: income' });
    if (!selected_items || !Array.isArray(selected_items) || selected_items.length === 0)
      return res.status(400).json({ success: false, error: 'กรุณาเลือกรายการที่ต้องการ Import อย่างน้อย 1 รายการ' });

    await client.query('BEGIN');

    // 1. income_name (1 query)
    const incomeResult = await client.query(`SELECT name FROM income WHERE income = $1`, [income]);
    const income_name = incomeResult.rows[0]?.name || '';
    const items = selected_items.map(item => ({ ...item, income_name }));
    const icodes = items.map(i => i.icode);
    console.log(`⏳ Importing ${items.length} items for income ${income}`);

    // 2. สร้างตารางและ index ถ้ายังไม่มี
    await client.query(`
      CREATE TABLE IF NOT EXISTS p4p_doctor_point (
        p4p_items_point_id INTEGER, icode VARCHAR(7), p4p_items_type_id INTEGER,
        point NUMERIC, istatus CHAR(1), income CHAR(2),
        begin_date DATE, finish_date DATE, update_datetime TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p4p_dp_icode ON p4p_doctor_point(icode)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tmp_p4p_point (
        income_name VARCHAR(200), icode VARCHAR(7), meaning VARCHAR(200),
        price NUMERIC, point_old NUMERIC(15,3), point_new NUMERIC(15,3), icd9cm VARCHAR(10)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tmp_p4p_icode ON tmp_p4p_point(icode)`);

    // ── p4p_doctor_point ──────────────────────────────────────────────────────

    // 3. ดึง icode+point ที่มีอยู่แล้วใน 1 query
    const existP4P = await client.query(
      `SELECT icode, point FROM p4p_doctor_point WHERE icode = ANY($1)`, [icodes]
    );
    const existMap = new Map(existP4P.rows.map(r => [r.icode, r.point]));

    const toInsert = items.filter(i => !existMap.has(i.icode));
    const toUpdate = items.filter(i =>  existMap.has(i.icode));

    // 4. batch INSERT (1 query)
    if (toInsert.length > 0) {
      await client.query(`
        INSERT INTO p4p_doctor_point (p4p_items_point_id, icode, point, istatus, income, update_datetime)
        SELECT (SELECT COALESCE(MAX(p4p_items_point_id), 0) FROM p4p_doctor_point) + ROW_NUMBER() OVER (),
               icode, 0, istatus, income, NOW()
        FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(icode, istatus, income)
      `, [toInsert.map(i => i.icode), toInsert.map(i => i.istatus || 'Y'), toInsert.map(i => i.income)]);
    }

    // 5. batch UPDATE (1 query)
    if (toUpdate.length > 0) {
      await client.query(`
        UPDATE p4p_doctor_point AS p
        SET point = 0, istatus = v.istatus, income = v.income, update_datetime = NOW()
        FROM (SELECT UNNEST($1::text[]) AS icode,
                     UNNEST($2::text[]) AS istatus,
                     UNNEST($3::text[]) AS income) AS v
        WHERE p.icode = v.icode
      `, [toUpdate.map(i => i.icode), toUpdate.map(i => i.istatus || 'Y'), toUpdate.map(i => i.income)]);
    }

    // 6. batch log (1 query)
    const logItems = [
      ...toInsert.map(i => ({ icode: i.icode, point_old: null,                  point_new: 0 })),
      ...toUpdate.map(i => ({ icode: i.icode, point_old: existMap.get(i.icode), point_new: 0 })),
    ];
    await ensureP4PLogTable(client);
    await batchLogP4P(client, logItems, officerId, officerName);

    // ── tmp_p4p_point ─────────────────────────────────────────────────────────

    // 7. ดึง icode ที่มีอยู่ใน 1 query
    const existTmp = await client.query(
      `SELECT icode FROM tmp_p4p_point WHERE icode = ANY($1)`, [icodes]
    );
    const existTmpSet = new Set(existTmp.rows.map(r => r.icode));

    const tmpInsert = items.filter(i => !existTmpSet.has(i.icode));
    const tmpUpdate = items.filter(i =>  existTmpSet.has(i.icode));
    const prices    = items.reduce((m, i) => { m.set(i.icode, parseFloat(i.unitprice || i.price || i.unit_price || 0)); return m; }, new Map());

    // 8. batch INSERT tmp (1 query)
    if (tmpInsert.length > 0) {
      await client.query(`
        INSERT INTO tmp_p4p_point (income_name, icode, meaning, price)
        SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::numeric[])
          AS t(income_name, icode, meaning, price)
      `, [tmpInsert.map(i => i.income_name), tmpInsert.map(i => i.icode),
          tmpInsert.map(i => i.name || ''), tmpInsert.map(i => prices.get(i.icode))]);
    }

    // 9. batch UPDATE tmp (1 query)
    if (tmpUpdate.length > 0) {
      await client.query(`
        UPDATE tmp_p4p_point AS t
        SET income_name = v.income_name, meaning = v.meaning, price = v.price
        FROM (SELECT UNNEST($1::text[]) AS icode,
                     UNNEST($2::text[]) AS income_name,
                     UNNEST($3::text[]) AS meaning,
                     UNNEST($4::numeric[]) AS price) AS v
        WHERE t.icode = v.icode
      `, [tmpUpdate.map(i => i.icode), tmpUpdate.map(i => i.income_name),
          tmpUpdate.map(i => i.name || ''), tmpUpdate.map(i => prices.get(i.icode))]);
    }

    await client.query('COMMIT');
    console.log(`✅ Imported ${items.length} items (insert:${toInsert.length} update:${toUpdate.length})`);

    res.status(201).json({
      success: true,
      message: 'Data imported successfully',
      summary: {
        income,
        total_items: items.length,
        p4p_doctor_point: { inserted: toInsert.length, updated: toUpdate.length, skipped: 0 },
        tmp_p4p_point:    { inserted: tmpInsert.length, updated: tmpUpdate.length }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', err);
    res.status(500).json({ success: false, error: 'Failed to import data', message: err.message });
  } finally {
    client.release();
  }
});

// =====================================
// GET: ดึงรายการ income ทั้งหมดจากตาราง income (พร้อมจำนวนใน p4p_doctor_point)
// =====================================
router.get('/income-filter-list', async (req, res) => {
  try {
    // ตรวจสอบว่ามีตาราง p4p_doctor_point หรือไม่
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'p4p_doctor_point'
      ) as exists
    `);
    const hasPdpTable = tableCheck.rows[0].exists;

    let result;
    if (hasPdpTable) {
      result = await pool.query(`
        SELECT i.income, i.name as income_name,
               COUNT(p.icode) as imported_count
        FROM income i
        LEFT JOIN p4p_doctor_point p ON i.income = p.income
        WHERE i.income IS NOT NULL AND i.name IS NOT NULL
        GROUP BY i.income, i.name
        ORDER BY i.name
      `);
    } else {
      result = await pool.query(`
        SELECT income, name as income_name, 0 as imported_count
        FROM income
        WHERE income IS NOT NULL AND name IS NOT NULL
        ORDER BY name
      `);
    }

    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('Error fetching income-filter-list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// GET: ดึงรายการ income ที่มีใน p4p_doctor_point
// =====================================
router.get('/p4p-income-list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.income, i.name as income_name, COUNT(p.icode) as item_count
      FROM p4p_doctor_point p
      LEFT JOIN income i ON p.income = i.income
      WHERE p.income IS NOT NULL
      GROUP BY p.income, i.name
      ORDER BY i.name
    `);
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// GET: ดึงข้อมูลจาก p4p_doctor_point
// =====================================
router.get('/p4p-doctor-point', async (req, res) => {
  try {
    const { limit, income } = req.query;

    let query, params;

    if (income && limit) {
      query = `
        SELECT p.*, i.name as income_name, n.name as item_name
        FROM p4p_doctor_point p
        LEFT JOIN income i ON p.income = i.income
        LEFT JOIN nondrugitems n ON p.icode = n.icode
        WHERE p.income = $1
        ORDER BY p.income, p.icode
        LIMIT $2
      `;
      params = [income, parseInt(limit)];
    } else if (income) {
      query = `
        SELECT p.*, i.name as income_name, n.name as item_name
        FROM p4p_doctor_point p
        LEFT JOIN income i ON p.income = i.income
        LEFT JOIN nondrugitems n ON p.icode = n.icode
        WHERE p.income = $1
        ORDER BY p.income, p.icode
      `;
      params = [income];
    } else if (limit) {
      query = `
        SELECT p.*, i.name as income_name, n.name as item_name
        FROM p4p_doctor_point p
        LEFT JOIN income i ON p.income = i.income
        LEFT JOIN nondrugitems n ON p.icode = n.icode
        ORDER BY p.income, p.icode
        LIMIT $1
      `;
      params = [parseInt(limit)];
    } else {
      query = `
        SELECT p.*, i.name as income_name, n.name as item_name
        FROM p4p_doctor_point p
        LEFT JOIN income i ON p.income = i.income
        LEFT JOIN nondrugitems n ON p.icode = n.icode
        ORDER BY p.income, p.icode
      `;
      params = [];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching p4p_doctor_point:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch p4p_doctor_point',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงข้อมูลจาก tmp_p4p_point
// =====================================
router.get('/tmp-p4p-point', async (req, res) => {
  try {
    const { limit = 100, offset = 0, income_name } = req.query;

    let query, params;

    if (income_name) {
      // กรองตาม income_name
      query = `
        SELECT * FROM tmp_p4p_point
        WHERE income_name = $1
        ORDER BY icode DESC
        LIMIT $2 OFFSET $3
      `;
      params = [income_name, parseInt(limit), parseInt(offset)];
    } else {
      // แสดงทั้งหมด
      query = `
        SELECT * FROM tmp_p4p_point
        ORDER BY icode DESC
        LIMIT $1 OFFSET $2
      `;
      params = [parseInt(limit), parseInt(offset)];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching tmp_p4p_point:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tmp_p4p_point',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงรายการ income_name จาก tmp_p4p_point
// =====================================
router.get('/tmp-income-list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT income_name, COUNT(*) as item_count
      FROM tmp_p4p_point
      WHERE income_name IS NOT NULL
      GROUP BY income_name
      ORDER BY income_name
    `);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching tmp income list:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tmp income list',
      message: err.message
    });
  }
});

// =====================================
// PUT: อัปเดต point_new ใน tmp_p4p_point (พร้อม Log)
// =====================================
router.put('/tmp-p4p-point/:icode', async (req, res) => {
  const client = await getClient();
  const officer = getOfficer(req);

  try {
    const { icode } = req.params;
    const { point_new, user_name = 'admin' } = req.body;
    const officerName = officer.officer_name !== 'system' ? officer.officer_name : user_name;

    await client.query('BEGIN');

    // ดึงข้อมูลปัจจุบัน
    const getCurrentPoint = await client.query(`
      SELECT point_new, meaning, income_name FROM tmp_p4p_point WHERE icode = $1
    `, [icode]);

    if (getCurrentPoint.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const oldPointNew = getCurrentPoint.rows[0].point_new;
    const meaning = getCurrentPoint.rows[0].meaning;
    const income_name = getCurrentPoint.rows[0].income_name;

    // Update: ค่าเดิมของ point_new ไปที่ point_old, ค่าใหม่ใส่ที่ point_new
    const result = await client.query(`
      UPDATE tmp_p4p_point
      SET point_old = $1, point_new = $2
      WHERE icode = $3
      RETURNING *
    `, [oldPointNew, point_new, icode]);

    // เช็คว่ามีตาราง log หรือยัง ถ้ายังให้สร้าง
    const checkLogTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tmp_p4p_point_log'
      );
    `);

    if (!checkLogTable.rows[0].exists) {
      await client.query(`
        CREATE TABLE tmp_p4p_point_log (
          id SERIAL PRIMARY KEY,
          icode VARCHAR(50),
          meaning TEXT,
          income_name VARCHAR(255),
          old_point DECIMAL(10,2),
          new_point DECIMAL(10,2),
          changed_by VARCHAR(100),
          changed_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ Created table: tmp_p4p_point_log');
    }

    // บันทึก Log การเปลี่ยนแปลงลง tmp_p4p_point_log
    await client.query(`
      INSERT INTO tmp_p4p_point_log (
        icode, meaning, income_name, old_point, new_point, changed_by, changed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [icode, meaning, income_name, oldPointNew, point_new, officerName]);

    // บันทึก Log ลง p4p_point_log (ตาราง log กลาง)
    await ensureP4PLogTable(client);
    await client.query(`
      INSERT INTO p4p_point_log (icode, point_old, point_new, update_datetime, officer_id, officer_name)
      VALUES ($1, $2, $3, NOW(), $4, $5)
    `, [icode, oldPointNew, point_new, officer.officer_id, officerName]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Updated successfully',
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating tmp_p4p_point:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update tmp_p4p_point',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================
// GET: ดึง Log การแก้ไขของแต่ละ icode
// =====================================
router.get('/tmp-p4p-point/:icode/logs', async (req, res) => {
  try {
    const { icode } = req.params;

    const result = await pool.query(`
      SELECT * FROM tmp_p4p_point_log
      WHERE icode = $1
      ORDER BY changed_at DESC
    `, [icode]);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: err.message
    });
  }
});

// =====================================
// PUT: แก้ไข point และ/หรือ istatus ใน p4p_doctor_point
// =====================================
router.put('/p4p-doctor-point/:icode', async (req, res) => {
  const client = await getClient();
  const officer = getOfficer(req);

  try {
    const { icode } = req.params;
    const { point, istatus } = req.body;

    await client.query('BEGIN');

    // ดึงค่าเดิม
    const current = await client.query(`
      SELECT point, istatus FROM p4p_doctor_point WHERE icode = $1
    `, [icode]);

    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'ไม่พบรายการ' });
    }

    const oldPoint = current.rows[0].point;
    const oldIstatus = current.rows[0].istatus;

    const newPoint   = point   !== undefined ? point   : oldPoint;
    const newIstatus = istatus !== undefined ? istatus : oldIstatus;

    // อัปเดต
    const result = await client.query(`
      UPDATE p4p_doctor_point
      SET point = $1, istatus = $2, update_datetime = NOW()
      WHERE icode = $3
      RETURNING *
    `, [newPoint, newIstatus, icode]);

    // อัปเดต point_old และ point_new ใน tmp_p4p_point (ถ้ามี icode นั้น)
    await client.query(`
      UPDATE tmp_p4p_point
      SET point_old = point_new, point_new = $1
      WHERE icode = $2
    `, [newPoint, icode]);

    // Log ลง p4p_point_log
    await ensureP4PLogTable(client);
    await client.query(`
      INSERT INTO p4p_point_log (icode, point_old, point_new, update_datetime, officer_id, officer_name)
      VALUES ($1, $2, $3, NOW(), $4, $5)
    `, [icode, oldPoint, newPoint, officer.officer_id, officer.officer_name]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Updated successfully', data: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating p4p_doctor_point:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// =====================================
// GET: ดึง Log จาก p4p_point_log ตาม icode
// =====================================
router.get('/p4p-doctor-point/:icode/logs', async (req, res) => {
  try {
    const { icode } = req.params;

    // ตรวจสอบว่ามีตาราง p4p_point_log ก่อน
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'p4p_point_log'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const result = await pool.query(`
      SELECT * FROM p4p_point_log
      WHERE icode = $1
      ORDER BY update_datetime DESC
    `, [icode]);

    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// DELETE: ล้างข้อมูลใน tmp_p4p_point
// =====================================
router.delete('/tmp-p4p-point/clear', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tmp_p4p_point');

    res.json({
      success: true,
      message: 'Cleared tmp_p4p_point table',
      deleted_count: result.rowCount
    });
  } catch (err) {
    console.error('Error clearing tmp_p4p_point:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear tmp_p4p_point',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงรายชื่อแพทย์ทั้งหมดที่เปิดใช้งาน (status='Y')
// =====================================
router.get('/active-doctors', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT code, name FROM doctor WHERE active = 'Y' ORDER BY name`
    );
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// GET: ดึงรายชื่อแพทย์ที่มีรายการใน opitemrece + p4p_doctor_point
// =====================================
router.get('/doctors', async (req, res) => {
  try {
    const { date_from, date_to, dept_code } = req.query;
    const params = [];
    let whereExtra = '';

    if (date_from && date_to) {
      params.push(date_from, date_to);
      whereExtra += `AND o.vstdate BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    // กรองตาม dept_code โดย doctor.position_id -> doctor_position.hos_guid LIKE '%X%'
    // dept_code=1 (แพทย์) = ไม่กรอง (แสดงทั้งหมด)
    let deptJoin = '';
    let deptWhere = '';
    if (dept_code && String(dept_code) !== '1') {
      params.push(`%${dept_code}%`);
      deptJoin = `LEFT JOIN doctor_position dp ON d.position_id = dp.id`;
      deptWhere = `AND TRIM(dp.hos_guid) LIKE $${params.length}`;
    }

    const result = await pool.query(`
      SELECT DISTINCT d.code, d.name
      FROM opitemrece o
      INNER JOIN p4p_doctor_point p ON o.icode = p.icode
      INNER JOIN doctor d ON o.doctor = d.code
      ${deptJoin}
      WHERE d.name IS NOT NULL AND d.code IS NOT NULL
        ${whereExtra}
        ${deptWhere}
      GROUP BY d.code, d.name
      ORDER BY d.name
    `, params);
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// GET: รายงาน P4P ตามแพทย์ วันที่ income
// =====================================
router.get('/report', async (req, res) => {
  try {
    const { date_from, date_to, doctor, income } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด' });
    }

    const params = [date_from, date_to];
    let doctorFilter = '';
    let incomeFilter = '';

    if (doctor) {
      params.push(doctor);
      doctorFilter = `AND o.doctor = $${params.length}`;
    }
    if (income) {
      params.push(income);
      incomeFilter = `AND p.income = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        o.vstdate,
        o.hn,
        o.icode,
        COALESCE(n.name, o.icode) AS item_name,
        p.point,
        p.income,
        COALESCE(i.name, p.income) AS income_name,
        d.code AS doctor_code,
        d.name AS doctor_name
      FROM opitemrece o
      INNER JOIN p4p_doctor_point p ON o.icode = p.icode
      LEFT JOIN nondrugitems n ON o.icode = n.icode
      LEFT JOIN income i ON p.income = i.income
      LEFT JOIN doctor d ON o.doctor = d.code
      WHERE o.vstdate BETWEEN $1 AND $2
        ${doctorFilter}
        ${incomeFilter}
      ORDER BY o.vstdate, o.hn, o.icode
    `, params);

    const totalPoint = result.rows.reduce((s, r) => s + (parseFloat(r.point) || 0), 0);

    res.json({
      success: true,
      count: result.rowCount,
      total_point: totalPoint,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// กลุ่มผู้ปฏิบัติงาน (work_group)
// =====================================

// สร้างตาราง work_group ถ้ายังไม่มี
async function ensureWorkGroupTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p4p_work_group (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(200) NOT NULL,
      note      TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS p4p_work_group_doctor (
      id         SERIAL PRIMARY KEY,
      group_id   INTEGER REFERENCES p4p_work_group(id) ON DELETE CASCADE,
      doctor_code VARCHAR(20) NOT NULL,
      doctor_name VARCHAR(200),
      UNIQUE(group_id, doctor_code)
    )
  `);
}

// GET: รายการกลุ่มทั้งหมด
router.get('/work-groups', async (req, res) => {
  try {
    await ensureWorkGroupTable();
    const result = await pool.query(`
      SELECT g.id, g.name, g.note, g.created_at,
             COUNT(d.id) AS doctor_count
      FROM p4p_work_group g
      LEFT JOIN p4p_work_group_doctor d ON g.id = d.group_id
      GROUP BY g.id ORDER BY g.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: สร้างกลุ่มใหม่
router.post('/work-groups', async (req, res) => {
  try {
    await ensureWorkGroupTable();
    const { name, note, doctors = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อกลุ่ม' });
    const r = await pool.query(
      `INSERT INTO p4p_work_group (name, note) VALUES ($1, $2) RETURNING *`,
      [name, note || null]
    );
    const groupId = r.rows[0].id;
    if (doctors.length > 0) {
      for (const d of doctors) {
        await pool.query(
          `INSERT INTO p4p_work_group_doctor (group_id, doctor_code, doctor_name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [groupId, d.code, d.name]
        );
      }
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: แก้ไขกลุ่ม
router.put('/work-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, note, doctors } = req.body;
    if (name) await pool.query(`UPDATE p4p_work_group SET name=$1, note=$2 WHERE id=$3`, [name, note || null, id]);
    if (Array.isArray(doctors)) {
      await pool.query(`DELETE FROM p4p_work_group_doctor WHERE group_id=$1`, [id]);
      for (const d of doctors) {
        await pool.query(
          `INSERT INTO p4p_work_group_doctor (group_id, doctor_code, doctor_name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, d.code, d.name]
        );
      }
    }
    const r = await pool.query(`SELECT * FROM p4p_work_group WHERE id=$1`, [id]);
    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE: ลบกลุ่ม
router.delete('/work-groups/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM p4p_work_group WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: แพทย์ในกลุ่ม
router.get('/work-groups/:id/doctors', async (req, res) => {
  try {
    await ensureWorkGroupTable();
    const result = await pool.query(
      `SELECT doctor_code AS code, doctor_name AS name FROM p4p_work_group_doctor WHERE group_id=$1 ORDER BY doctor_name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================
// ตั้งค่า Position ของแต่ละหน่วยงาน
// =====================================

// GET: introspect doctor_position columns
router.get('/doctor-positions/columns', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='doctor_position' ORDER BY ordinal_position`
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: introspect doctor table columns
router.get('/doctor-table-columns', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='doctor' ORDER BY ordinal_position`
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: sample doctor hos_guid values
router.get('/doctor-hos-guid-sample', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT hos_guid, COUNT(*) as cnt FROM doctor WHERE hos_guid IS NOT NULL AND hos_guid != '' GROUP BY hos_guid ORDER BY cnt DESC LIMIT 20`
    );
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: ดึงรายการ doctor_position ทั้งหมด (id + name + hos_guid)
router.get('/doctor-positions', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, TRIM(hos_guid) AS hos_guid FROM doctor_position ORDER BY name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: บันทึก hos_guid สำหรับ dept_code (ตัวเลข 1-8)
router.put('/doctor-positions/dept/:dept_code', async (req, res) => {
  const { dept_code } = req.params;
  const { position_ids } = req.body; // array of id
  try {
    // 1. หา positions ที่เคยมี dept_code นี้ (ก่อนบันทึก) — เพื่อ sync doctors ที่ถูกเอาออก
    const oldResult = await pool.query(
      `SELECT id FROM doctor_position
       WHERE TRIM(hos_guid::text) = $1
          OR TRIM(hos_guid::text) LIKE $1 || ',%'
          OR TRIM(hos_guid::text) LIKE '%,' || $1
          OR TRIM(hos_guid::text) LIKE '%,' || $1 || ',%'`,
      [String(dept_code)]
    );
    const oldPositionIds = oldResult.rows.map(r => r.id);

    // 2. ล้าง dept_code ออกจาก hos_guid ของทุก row ก่อน
    const existingRows = await pool.query(`SELECT id, TRIM(hos_guid::text) AS hos_guid FROM doctor_position`);
    for (const row of existingRows.rows) {
      const current = (row.hos_guid || '').split(',').map(s => s.trim()).filter(Boolean);
      const removed = current.filter(v => v !== String(dept_code));
      const newVal = removed.length > 0 ? removed.join(',') : null;
      if (newVal !== (row.hos_guid || null)) {
        await pool.query(`UPDATE doctor_position SET hos_guid = $1 WHERE id = $2`, [newVal, row.id]);
      }
    }

    // 3. เพิ่ม dept_code เข้า rows ที่เลือก
    const newPositionIds = Array.isArray(position_ids) ? position_ids.map(p => parseInt(p)) : [];
    for (const pid of newPositionIds) {
      const r = await pool.query(`SELECT TRIM(hos_guid::text) AS hos_guid FROM doctor_position WHERE id = $1`, [pid]);
      if (r.rows.length === 0) continue;
      const current = (r.rows[0].hos_guid || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!current.includes(String(dept_code))) current.push(String(dept_code));
      await pool.query(`UPDATE doctor_position SET hos_guid = $1 WHERE id = $2`, [current.join(','), pid]);
    }

    // 4. หา positions ที่ได้รับผลกระทบ (เดิม + ใหม่)
    const affectedIds = [...new Set([...oldPositionIds, ...newPositionIds])];
    if (affectedIds.length === 0) {
      return res.json({ success: true, synced: 0 });
    }

    // 5. ตรวจสอบว่ามี doctor ที่ position_id ตรงกับ affectedIds หรือไม่
    const matchCheck = await pool.query(
      `SELECT COUNT(*) AS cnt FROM doctor WHERE position_id = ANY($1)`,
      [affectedIds]
    );
    const matched = parseInt(matchCheck.rows[0].cnt);
    console.log(`📋 positions affected: [${affectedIds.join(',')}] → doctors matched: ${matched}`);

    if (matched === 0) {
      console.warn(`⚠️  ไม่มี doctor ที่ position_id ตรงกับ positions ที่บันทึก`);
      return res.json({ success: true, synced: 0, warning: 'ไม่มี doctor ที่ position_id ตรงกัน' });
    }

    // 6. Sync doctor.hos_guid เฉพาะ doctors ที่ position_id ตรงกับ affectedIds
    const syncResult = await pool.query(`
      UPDATE doctor d
      SET hos_guid = sub.dept_codes
      FROM (
        SELECT dp.id AS pos_id,
          NULLIF(
            (SELECT string_agg(TRIM(v), ',' ORDER BY TRIM(v)::integer)
             FROM unnest(string_to_array(COALESCE(TRIM(dp.hos_guid::text), ''), ',')) AS t(v)
             WHERE TRIM(v) ~ '^[1-8]$'
            ), ''
          ) AS dept_codes
        FROM doctor_position dp
        WHERE dp.id = ANY($1)
      ) sub
      WHERE d.position_id = sub.pos_id
    `, [affectedIds]);

    console.log(`✅ Synced doctor.hos_guid: ${syncResult.rowCount} rows (positions: [${affectedIds.join(',')}])`);
    res.json({ success: true, synced: syncResult.rowCount });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: ดึง position ที่ map กับ dept_code นั้นๆ
router.get('/doctor-positions/dept/:dept_code', async (req, res) => {
  const { dept_code } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, TRIM(hos_guid) AS hos_guid FROM doctor_position
       WHERE TRIM(hos_guid) = $1
          OR TRIM(hos_guid) LIKE $1 || ',%'
          OR TRIM(hos_guid) LIKE '%,' || $1
          OR TRIM(hos_guid) LIKE '%,' || $1 || ',%'
       ORDER BY name`,
      [String(dept_code)]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
