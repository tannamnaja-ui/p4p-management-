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

    // ใช้ชื่อจาก token ก่อน ถ้าไม่มี (session หมด/server restart) ให้ใช้ user_id จาก body
    const officerName = (officer.officer_name && officer.officer_name !== 'system')
      ? officer.officer_name
      : user_id;
    const officerId = officer.officer_id;

    if (!income) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: income'
      });
    }

    // บังคับให้ต้องส่ง selected_items มาเสมอ
    if (!selected_items || !Array.isArray(selected_items) || selected_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาเลือกรายการที่ต้องการ Import อย่างน้อย 1 รายการ'
      });
    }

    await client.query('BEGIN');

    // ดึง income_name จากตาราง income
    const incomeResult = await client.query(`
      SELECT name FROM income WHERE income = $1
    `, [income]);
    const income_name = incomeResult.rows[0]?.name || '';

    // ใช้เฉพาะรายการที่ถูกเลือกและส่งมาจาก frontend
    const items = selected_items.map(item => ({
      ...item,
      income_name: income_name
    }));

    console.log(`✅ Importing ${items.length} selected items for income ${income}`);

    // 2. ตรวจสอบว่ามีตาราง p4p_doctor_point และ tmp_p4p_point หรือไม่
    const checkTableP4P = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'p4p_doctor_point'
      );
    `);

    const checkTableTmp = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'tmp_p4p_point'
      );
    `);

    // 2.5 ตรวจสอบโครงสร้างตาราง p4p_doctor_point ที่มีอยู่
    let p4pColumns = {};
    let tmpColumns = {};

    if (checkTableP4P.rows[0].exists) {
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'p4p_doctor_point'
      `);
      columnsResult.rows.forEach(row => {
        p4pColumns[row.column_name] = true;
      });
      console.log('📋 p4p_doctor_point columns:', Object.keys(p4pColumns));
    }

    if (checkTableTmp.rows[0].exists) {
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'tmp_p4p_point'
      `);
      columnsResult.rows.forEach(row => {
        tmpColumns[row.column_name] = true;
      });
      console.log('📋 tmp_p4p_point columns:', Object.keys(tmpColumns));
    }

    // 3. สร้างตารางถ้ายังไม่มี
    if (!checkTableP4P.rows[0].exists) {
      await client.query(`
        CREATE TABLE p4p_doctor_point (
          id SERIAL PRIMARY KEY,
          icode VARCHAR(50),
          item_name VARCHAR(255),
          income VARCHAR(50),
          unitprice DECIMAL(10,2),
          point DECIMAL(10,2),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(50),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(icode)
        );
      `);
      console.log('✅ Created table: p4p_doctor_point');
    }

    if (!checkTableTmp.rows[0].exists) {
      await client.query(`
        CREATE TABLE tmp_p4p_point (
          id SERIAL PRIMARY KEY,
          icode VARCHAR(50),
          item_name VARCHAR(255),
          income VARCHAR(50),
          unitprice DECIMAL(10,2),
          point DECIMAL(10,2),
          description TEXT,
          import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          imported_by VARCHAR(50)
        );
      `);
      console.log('✅ Created table: tmp_p4p_point');
    }

    // 4. Insert ข้อมูลเข้า p4p_doctor_point
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const p4pLogItems = []; // เก็บ log สำหรับ batch insert

    // หา p4p_items_point_id ที่มากที่สุด
    const maxIdResult = await client.query(`
      SELECT COALESCE(MAX(p4p_items_point_id), 0) as max_id FROM p4p_doctor_point
    `);
    let currentId = maxIdResult.rows[0].max_id;

    for (const item of items) {
      try {
        currentId++;

        // ตรวจสอบว่ามี icode นี้อยู่แล้วหรือไม่
        const checkExists = await client.query(`
          SELECT p4p_items_point_id, point FROM p4p_doctor_point WHERE icode = $1
        `, [item.icode]);

        if (checkExists.rowCount > 0) {
          const oldPoint = checkExists.rows[0].point;
          await client.query(`
            UPDATE p4p_doctor_point
            SET point = $1, istatus = $2, income = $3, update_datetime = NOW()
            WHERE icode = $4
          `, [0, item.istatus, item.income, item.icode]);
          updatedCount++;
          p4pLogItems.push({ icode: item.icode, point_old: oldPoint, point_new: 0 });
        } else {
          await client.query(`
            INSERT INTO p4p_doctor_point (
              p4p_items_point_id, icode, point, istatus, income, update_datetime
            ) VALUES ($1, $2, $3, $4, $5, NOW())
          `, [currentId, item.icode, 0, item.istatus, item.income]);
          insertedCount++;
          p4pLogItems.push({ icode: item.icode, point_old: null, point_new: 0 });
        }

      } catch (err) {
        console.error(`Error inserting icode ${item.icode}:`, err.message);
        skippedCount++;
      }
    }

    // 4.5 บันทึก Log ลง p4p_point_log (batch insert)
    await ensureP4PLogTable(client);
    await batchLogP4P(client, p4pLogItems, officerId, officerName);
    console.log(`📝 Logged ${p4pLogItems.length} entries to p4p_point_log`);

    // 5. Insert ข้อมูลเข้า tmp_p4p_point (เช็คซ้ำก่อน)
    let tmpInsertedCount = 0;
    let tmpUpdatedCount = 0;

    for (const item of items) {
      try {
        // หาค่าราคาจากคอลัมน์ที่มีจริง
        const price = item.unitprice || item.price || item.unit_price || 0;

        // ตรวจสอบว่ามี icode นี้อยู่แล้วหรือไม่
        const checkTmpExists = await client.query(`
          SELECT icode FROM tmp_p4p_point WHERE icode = $1
        `, [item.icode]);

        if (checkTmpExists.rowCount > 0) {
          // UPDATE ถ้ามีอยู่แล้ว
          await client.query(`
            UPDATE tmp_p4p_point
            SET income_name = $1, meaning = $2, price = $3
            WHERE icode = $4
          `, [item.income_name, item.name, price, item.icode]);
          tmpUpdatedCount++;
        } else {
          // INSERT ถ้ายังไม่มี
          await client.query(`
            INSERT INTO tmp_p4p_point (
              income_name, icode, meaning, price
            ) VALUES ($1, $2, $3, $4)
          `, [
            item.income_name,  // จาก income.name (ได้จาก JOIN แล้ว)
            item.icode,        // จาก nondrugitems.icode
            item.name,         // จาก nondrugitems.name (ใช้เป็น meaning)
            price              // จาก nondrugitems.unitprice
          ]);
          tmpInsertedCount++;
        }

      } catch (err) {
        console.error(`Error inserting to tmp_p4p_point icode ${item.icode}:`, err.message);
      }
    }

    // 6. Commit Transaction
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Data imported successfully',
      summary: {
        income: income,
        total_items: items.length,
        p4p_doctor_point: {
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount
        },
        tmp_p4p_point: {
          inserted: tmpInsertedCount,
          updated: tmpUpdatedCount
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to import data',
      message: err.message
    });
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
    // ล้าง dept_code ออกจาก hos_guid ของทุก row ก่อน
    const existingRows = await pool.query(`SELECT id, TRIM(hos_guid) AS hos_guid FROM doctor_position`);
    for (const row of existingRows.rows) {
      const current = (row.hos_guid || '').split(',').map(s => s.trim()).filter(Boolean);
      const removed = current.filter(v => v !== String(dept_code));
      const newVal = removed.length > 0 ? removed.join(',') : null;
      if (newVal !== (row.hos_guid || null)) {
        await pool.query(`UPDATE doctor_position SET hos_guid = $1 WHERE id = $2`, [newVal, row.id]);
      }
    }
    // เพิ่ม dept_code เข้า rows ที่เลือก
    if (Array.isArray(position_ids)) {
      for (const pid of position_ids) {
        const r = await pool.query(`SELECT TRIM(hos_guid) AS hos_guid FROM doctor_position WHERE id = $1`, [pid]);
        if (r.rows.length === 0) continue;
        const current = (r.rows[0].hos_guid || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!current.includes(String(dept_code))) current.push(String(dept_code));
        await pool.query(`UPDATE doctor_position SET hos_guid = $1 WHERE id = $2`, [current.join(','), pid]);
      }
    }
    res.json({ success: true });
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
