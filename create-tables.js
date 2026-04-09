/**
 * create-tables.js
 * สร้างตาราง p4p_doctor_point, tmp_p4p_point, p4p_point_log
 * ตรวจสอบก่อนว่ามีตารางและ column แล้วหรือไม่ ถ้ามีให้ข้ามไป
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, 'config', 'settings.json');

// ===== อ่าน settings =====
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch (e) {
    console.error('❌ ไม่พบไฟล์ config/settings.json กรุณาตั้งค่าการเชื่อมต่อก่อน');
    process.exit(1);
  }
}

// ===== นิยามตารางและ column =====
const TABLE_DEFINITIONS = [
  {
    name: 'p4p_doctor_point',
    columns: [
      { name: 'p4p_items_point_id', pg: 'INTEGER',      my: 'INT' },
      { name: 'icode',              pg: 'VARCHAR(7)',   my: 'VARCHAR(7)' },
      { name: 'p4p_items_type_id',  pg: 'INTEGER',      my: 'INT' },
      { name: 'point',              pg: 'NUMERIC',      my: 'DECIMAL(15,2)' },
      { name: 'istatus',            pg: 'CHAR(1)',       my: 'CHAR(1)' },
      { name: 'income',             pg: 'CHAR(2)',       my: 'CHAR(2)' },
      { name: 'begin_date',         pg: 'DATE',         my: 'DATE' },
      { name: 'finish_date',        pg: 'DATE',         my: 'DATE' },
      { name: 'update_datetime',    pg: 'TIMESTAMP',    my: 'DATETIME' },
    ]
  },
  {
    name: 'tmp_p4p_point',
    columns: [
      { name: 'income_name', pg: 'VARCHAR(200)', my: 'VARCHAR(200)' },
      { name: 'icode',       pg: 'VARCHAR(7)',   my: 'VARCHAR(7)' },
      { name: 'meaning',     pg: 'VARCHAR(200)', my: 'VARCHAR(200)' },
      { name: 'price',       pg: 'NUMERIC',      my: 'DECIMAL(15,2)' },
      { name: 'point_old',   pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
      { name: 'point_new',   pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
      { name: 'icd9cm',      pg: 'VARCHAR(10)',  my: 'VARCHAR(10)' },
    ]
  },
  {
    name: 'p4p_point_log',
    columns: [
      { name: 'p4p_point_log_id', pg: 'INTEGER',      my: 'INT' },
      { name: 'icode',            pg: 'VARCHAR(7)',   my: 'VARCHAR(7)' },
      { name: 'point_old',        pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
      { name: 'point_new',        pg: 'NUMERIC(15,3)', my: 'DECIMAL(15,3)' },
      { name: 'update_datetime',  pg: 'TIMESTAMP',    my: 'DATETIME' },
      { name: 'officer_id',       pg: 'INTEGER',      my: 'INT' },
      { name: 'officer_name',     pg: 'VARCHAR(200)', my: 'VARCHAR(200)' },
    ]
  }
];

// ===== PostgreSQL =====
async function runPostgres(settings) {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: settings.db_host,
    port: parseInt(settings.db_port) || 5432,
    user: settings.db_user,
    password: settings.db_password,
    database: settings.db_name,
    connectionTimeoutMillis: 5000
  });

  const client = await pool.connect();
  console.log(`✅ เชื่อมต่อ PostgreSQL @ ${settings.db_host}:${settings.db_port}/${settings.db_name}\n`);

  try {
    for (const table of TABLE_DEFINITIONS) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 ตาราง: ${table.name}`);

      // ตรวจสอบตาราง
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, [table.name]);

      if (!tableExists.rows[0].exists) {
        // สร้างตารางใหม่
        const colDefs = table.columns.map(c => `  ${c.name} ${c.pg}`).join(',\n');
        await client.query(`CREATE TABLE ${table.name} (\n${colDefs}\n)`);
        console.log(`  ✅ สร้างตารางใหม่ "${table.name}" พร้อม ${table.columns.length} columns`);
      } else {
        console.log(`  ℹ️  ตาราง "${table.name}" มีอยู่แล้ว — ตรวจสอบ columns...`);

        // ดึง columns ที่มีอยู่
        const existingCols = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
        `, [table.name]);
        const existingSet = new Set(existingCols.rows.map(r => r.column_name));

        let added = 0;
        for (const col of table.columns) {
          if (!existingSet.has(col.name)) {
            await client.query(`ALTER TABLE ${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.pg}`);
            console.log(`  ➕ เพิ่ม column: ${col.name} (${col.pg})`);
            added++;
          } else {
            console.log(`  ✔  column "${col.name}" มีอยู่แล้ว`);
          }
        }
        if (added === 0) console.log(`  ✅ ทุก column ครบแล้ว ไม่มีการแก้ไข`);
      }
      console.log('');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// ===== MySQL =====
async function runMySQL(settings) {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: settings.db_host,
    port: parseInt(settings.db_port) || 3306,
    user: settings.db_user,
    password: settings.db_password,
    database: settings.db_name,
    connectTimeout: 5000
  });
  console.log(`✅ เชื่อมต่อ MySQL @ ${settings.db_host}:${settings.db_port}/${settings.db_name}\n`);

  try {
    for (const table of TABLE_DEFINITIONS) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 ตาราง: ${table.name}`);

      // ตรวจสอบตาราง
      const [rows] = await conn.query(`
        SELECT COUNT(*) as cnt FROM information_schema.tables
        WHERE table_schema = ? AND table_name = ?
      `, [settings.db_name, table.name]);

      if (rows[0].cnt === 0) {
        // สร้างตารางใหม่
        const colDefs = table.columns.map(c => `  \`${c.name}\` ${c.my}`).join(',\n');
        await conn.query(`CREATE TABLE \`${table.name}\` (\n${colDefs}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        console.log(`  ✅ สร้างตารางใหม่ "${table.name}" พร้อม ${table.columns.length} columns`);
      } else {
        console.log(`  ℹ️  ตาราง "${table.name}" มีอยู่แล้ว — ตรวจสอบ columns...`);

        const [existingCols] = await conn.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ?
        `, [settings.db_name, table.name]);
        const existingSet = new Set(existingCols.map(r => r.column_name));

        let added = 0;
        for (const col of table.columns) {
          if (!existingSet.has(col.name)) {
            await conn.query(`ALTER TABLE \`${table.name}\` ADD COLUMN \`${col.name}\` ${col.my}`);
            console.log(`  ➕ เพิ่ม column: ${col.name} (${col.my})`);
            added++;
          } else {
            console.log(`  ✔  column "${col.name}" มีอยู่แล้ว`);
          }
        }
        if (added === 0) console.log(`  ✅ ทุก column ครบแล้ว ไม่มีการแก้ไข`);
      }
      console.log('');
    }
  } finally {
    await conn.end();
  }
}

// ===== Main =====
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   P4P Create Tables Script               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const settings = loadSettings();

  if (!settings.db_host || !settings.db_type) {
    console.error('❌ ยังไม่มีการตั้งค่าฐานข้อมูล กรุณาตั้งค่าผ่านหน้าเว็บก่อน');
    process.exit(1);
  }

  console.log(`🔌 ประเภทฐานข้อมูล : ${settings.db_type}`);
  console.log(`🖥  Host            : ${settings.db_host}:${settings.db_port}`);
  console.log(`🗄  Database        : ${settings.db_name}`);
  console.log('');

  try {
    if (settings.db_type === 'postgresql') {
      await runPostgres(settings);
    } else if (settings.db_type === 'mysql') {
      await runMySQL(settings);
    } else {
      console.error(`❌ ประเภทฐานข้อมูลไม่รองรับ: ${settings.db_type}`);
      process.exit(1);
    }

    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ✅ เสร็จสิ้น                            ║');
    console.log('╚══════════════════════════════════════════╝');
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  }
}

main();
