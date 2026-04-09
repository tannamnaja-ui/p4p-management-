const express = require('express');
const router = express.Router();
const { pool, getClient } = require('../config/db');

// =====================================
// GET: ดึงข้อมูลผู้ป่วยทั้งหมด
// =====================================
router.get('/patients', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT * FROM patient
       ORDER BY hn DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patients',
      message: err.message
    });
  }
});

// =====================================
// GET: ค้นหาผู้ป่วยตาม HN
// =====================================
router.get('/patient/:hn', async (req, res) => {
  try {
    const { hn } = req.params;

    const result = await pool.query(
      'SELECT * FROM patient WHERE hn = $1',
      [hn]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found',
        hn: hn
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching patient:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient',
      message: err.message
    });
  }
});

// =====================================
// POST: เพิ่มข้อมูลผู้ป่วยใหม่
// =====================================
router.post('/patient', async (req, res) => {
  const client = await getClient();

  try {
    const { hn, cid, pname, fname, lname, birthdate, sex } = req.body;

    // Validation
    if (!hn || !cid || !fname || !lname) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['hn', 'cid', 'fname', 'lname']
      });
    }

    // เริ่ม Transaction
    await client.query('BEGIN');

    // ตรวจสอบว่า HN ซ้ำหรือไม่
    const checkHN = await client.query(
      'SELECT hn FROM patient WHERE hn = $1',
      [hn]
    );

    if (checkHN.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'HN already exists',
        hn: hn
      });
    }

    // Insert ข้อมูล
    const insertQuery = `
      INSERT INTO patient (hn, cid, pname, fname, lname, birthdate, sex, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      hn,
      cid,
      pname || '',
      fname,
      lname,
      birthdate || null,
      sex || 'U'
    ]);

    // Commit Transaction
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating patient:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create patient',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================
// PUT: แก้ไขข้อมูลผู้ป่วย
// =====================================
router.put('/patient/:hn', async (req, res) => {
  const client = await getClient();

  try {
    const { hn } = req.params;
    const { pname, fname, lname, birthdate, sex } = req.body;

    await client.query('BEGIN');

    const updateQuery = `
      UPDATE patient
      SET pname = COALESCE($1, pname),
          fname = COALESCE($2, fname),
          lname = COALESCE($3, lname),
          birthdate = COALESCE($4, birthdate),
          sex = COALESCE($5, sex),
          updated_at = NOW()
      WHERE hn = $6
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      pname, fname, lname, birthdate, sex, hn
    ]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Patient not found',
        hn: hn
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating patient:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update patient',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// =====================================
// DELETE: ลบข้อมูลผู้ป่วย
// =====================================
router.delete('/patient/:hn', async (req, res) => {
  try {
    const { hn } = req.params;

    const result = await pool.query(
      'DELETE FROM patient WHERE hn = $1 RETURNING hn',
      [hn]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found',
        hn: hn
      });
    }

    res.json({
      success: true,
      message: 'Patient deleted successfully',
      hn: hn
    });

  } catch (err) {
    console.error('Error deleting patient:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete patient',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงข้อมูล OVST (Visit)
// =====================================
router.get('/visits', async (req, res) => {
  try {
    const { limit = 100, vstdate } = req.query;

    let query = 'SELECT * FROM ovst ORDER BY vstdate DESC, vsttime DESC LIMIT $1';
    let params = [parseInt(limit)];

    if (vstdate) {
      query = 'SELECT * FROM ovst WHERE vstdate = $1 ORDER BY vsttime DESC LIMIT $2';
      params = [vstdate, parseInt(limit)];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching visits:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch visits',
      message: err.message
    });
  }
});

// =====================================
// GET: ดึงข้อมูล Doctor Operation
// =====================================
router.get('/operations', async (req, res) => {
  try {
    const { limit = 100, start_date } = req.query;

    let query = 'SELECT * FROM doctor_operation ORDER BY begin_date_time DESC LIMIT $1';
    let params = [parseInt(limit)];

    if (start_date) {
      query = `SELECT * FROM doctor_operation
               WHERE DATE(begin_date_time) >= $1
               ORDER BY begin_date_time DESC
               LIMIT $2`;
      params = [start_date, parseInt(limit)];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching operations:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch operations',
      message: err.message
    });
  }
});

// =====================================
// GET: สถิติผู้ป่วย
// =====================================
router.get('/stats/patients', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_patients,
        COUNT(CASE WHEN sex = 'M' THEN 1 END) as male_count,
        COUNT(CASE WHEN sex = 'F' THEN 1 END) as female_count,
        COUNT(CASE WHEN birthdate IS NOT NULL THEN 1 END) as with_birthdate
      FROM patient
    `);

    res.json({
      success: true,
      data: stats.rows[0]
    });
  } catch (err) {
    console.error('Error fetching patient stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient statistics',
      message: err.message
    });
  }
});

module.exports = router;
