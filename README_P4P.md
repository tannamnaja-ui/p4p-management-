# P4P Data Import System

ระบบนำเข้าข้อมูลจากตาราง `nondrugitems` ไปยัง `p4p_doctor_point` และ `tmp_p4p_point`

---

## 🎯 คุณสมบัติของระบบ

1. **เลือก Income** - เลือกประเภท Income จากรายการ
2. **ดูตัวอย่างข้อมูล** - แสดงข้อมูลจาก nondrugitems ที่จะ Import
3. **Import ข้อมูล** - นำข้อมูลเข้าตาราง p4p_doctor_point และ tmp_p4p_point
4. **ดูข้อมูลที่ Import** - ตรวจสอบข้อมูลที่ Import แล้ว

---

## 📁 ไฟล์ที่เพิ่ม

```
New p4p/
├── routes/
│   └── p4p.js              ✅ API Routes สำหรับ P4P
├── public/
│   ├── index.html          ✅ หน้าเว็บ Frontend
│   └── app.js              ✅ JavaScript
├── server.js               ✅ (อัปเดต - เพิ่ม p4p routes)
└── README_P4P.md          ✅ Documentation
```

---

## 🚀 วิธีการใช้งาน

### 1. รันเซิร์ฟเวอร์

```bash
cd "D:\work\งานโรงพยาบาล\ข้อมูลโรงพยาบาล\พุทธชิน\งาน MA\ครั้งที่ 1\New p4p"

# ถ้ายังไม่ได้ติดตั้ง dependencies
npm install

# รันเซิร์ฟเวอร์
npm start
```

### 2. เปิดหน้าเว็บ

เปิดเบราว์เซอร์ไปที่:
```
http://localhost:3000
```

### 3. ขั้นตอนการใช้งาน

1. **เลือก Income** จาก dropdown
2. **ดูตัวอย่างข้อมูล** ที่จะ Import (แสดง 20 รายการแรก)
3. **คลิกปุ่ม Import** เพื่อนำข้อมูลเข้าระบบ
4. **ตรวจสอบผลลัพธ์** และดูข้อมูลที่ Import แล้ว

---

## 📡 API Endpoints

### 1. ดึงรายการ Income
```http
GET /api/p4p/income-list
```

**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "income": "01",
      "name": "ค่าตรวจวินิจฉัย",
      "income_group": "OP",
      "item_count": 150
    }
  ]
}
```

### 2. ดึงข้อมูล nondrugitems ตาม income
```http
GET /api/p4p/nondrugitems/:income?limit=100
```

**Example:**
```bash
curl http://localhost:3000/api/p4p/nondrugitems/01?limit=20
```

### 3. Import ข้อมูล
```http
POST /api/p4p/import-data
Content-Type: application/json

{
  "income": "01",
  "user_id": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data imported successfully",
  "summary": {
    "income": "01",
    "total_items": 150,
    "p4p_doctor_point": {
      "inserted": 120,
      "updated": 25,
      "skipped": 5
    },
    "tmp_p4p_point": {
      "inserted": 150
    }
  },
  "timestamp": "2026-01-22T10:30:00.000Z"
}
```

### 4. ดูข้อมูล p4p_doctor_point
```http
GET /api/p4p/p4p-doctor-point?limit=50&income=01
```

### 5. ดูข้อมูล tmp_p4p_point
```http
GET /api/p4p/tmp-p4p-point?limit=50
```

### 6. ล้างข้อมูล tmp_p4p_point
```http
DELETE /api/p4p/tmp-p4p-point/clear
```

---

## 🗄️ โครงสร้างตาราง

### ตาราง `p4p_doctor_point`

```sql
CREATE TABLE p4p_doctor_point (
  id SERIAL PRIMARY KEY,
  icode VARCHAR(50) UNIQUE,
  item_name VARCHAR(255),
  income VARCHAR(50),
  unitprice DECIMAL(10,2),
  point DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ตาราง `tmp_p4p_point`

```sql
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
```

**หมายเหตุ:** ตารางจะถูกสร้างอัตโนมัติเมื่อ Import ครั้งแรก

---

## 🔄 กระบวนการ Import

```
1. เลือก Income จาก dropdown
   ↓
2. ระบบดึงข้อมูลจาก nondrugitems WHERE income = 'XX'
   ↓
3. กรองเฉพาะ istatus = 'Y' (Active)
   ↓
4. Insert/Update ข้อมูลเข้า p4p_doctor_point
   - ถ้า icode ซ้ำ → UPDATE
   - ถ้าไม่ซ้ำ → INSERT
   ↓
5. Insert ข้อมูลเข้า tmp_p4p_point (ไม่เช็คซ้ำ)
   ↓
6. แสดงผลสรุปการ Import
```

---

## 📊 ตัวอย่างข้อมูลที่ Import

### ข้อมูลจาก `nondrugitems`
```
icode: "001"
name: "ค่าตรวจร่างกายทั่วไป"
unitprice: 100.00
income: "01"
istatus: "Y"
```

### จะถูก Insert เป็น

**ใน `p4p_doctor_point`:**
```
icode: "001"
item_name: "ค่าตรวจร่างกายทั่วไป"
income: "01"
unitprice: 100.00
point: 100.00
created_by: "admin"
```

**ใน `tmp_p4p_point`:**
```
icode: "001"
item_name: "ค่าตรวจร่างกายทั่วไป"
income: "01"
unitprice: 100.00
point: 100.00
imported_by: "admin"
```

---

## ⚠️ ข้อควรระวัง

1. **ข้อมูลซ้ำ**: ตาราง `p4p_doctor_point` มี UNIQUE constraint ที่ `icode` จะ UPDATE ถ้าซ้ำ
2. **tmp_p4p_point**: ไม่มีการเช็คซ้ำ จะ INSERT ทุกครั้ง
3. **Transaction**: ทุกการ Import ใช้ Transaction เพื่อความปลอดภัย
4. **Rollback**: ถ้าเกิดข้อผิดพลาดจะ Rollback อัตโนมัติ

---

## 🧪 การทดสอบ

### ทดสอบ API ด้วย curl

```bash
# 1. ดึงรายการ Income
curl http://localhost:3000/api/p4p/income-list

# 2. ดูข้อมูล nondrugitems
curl http://localhost:3000/api/p4p/nondrugitems/01

# 3. Import ข้อมูล
curl -X POST http://localhost:3000/api/p4p/import-data \
  -H "Content-Type: application/json" \
  -d '{"income":"01","user_id":"test"}'

# 4. ดูข้อมูลที่ Import
curl http://localhost:3000/api/p4p/p4p-doctor-point?limit=10
```

---

## 📸 Screenshot หน้าเว็บ

หน้าเว็บประกอบด้วย:

1. **Header** - ชื่อระบบและโรงพยาบาล
2. **Step 1** - เลือก Income
3. **Step 2** - Preview ข้อมูลที่จะ Import
4. **Step 3** - ปุ่ม Import และแสดงผลลัพธ์
5. **Step 4** - ดูข้อมูลที่ Import แล้ว

---

## 🛠️ Troubleshooting

### ปัญหา: ไม่มีข้อมูล Income
**วิธีแก้:** ตรวจสอบว่ามีตาราง `income` และ `nondrugitems` ในฐานข้อมูล

### ปัญหา: Import ไม่สำเร็จ
**วิธีแก้:**
1. ตรวจสอบ Console เพื่อดู Error
2. ตรวจสอบว่า PostgreSQL เชื่อมต่อได้
3. ตรวจสอบสิทธิ์ในการสร้างตาราง

### ปัญหา: หน้าเว็บไม่แสดง
**วิธีแก้:**
1. ตรวจสอบว่าเซิร์ฟเวอร์รันอยู่
2. ตรวจสอบ URL ต้องเป็น `http://localhost:3000`
3. ตรวจสอบ Console ของเบราว์เซอร์

---

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อทีม IT โรงพยาบาลพุทธชินราช

---

**Created by:** Claude AI Assistant
**Date:** 2026-01-22
**Version:** 1.0.0
