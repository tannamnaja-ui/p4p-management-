# Buddhachin Hospital Backend API

Backend API สำหรับเชื่อมต่อกับ PostgreSQL Database โรงพยาบาลพุทธชินราช

## 📋 ข้อมูลโปรเจค

- **โรงพยาบาล**: โรงพยาบาลพุทธชินราช
- **Database**: PostgreSQL
- **Framework**: Node.js + Express
- **Version**: 1.0.0

---

## 🚀 การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

ไฟล์ `.env` ได้ถูกสร้างไว้แล้วพร้อมค่า:

```env
DB_HOST=192.168.50.18
DB_PORT=5432
DB_USER=buddhachin
DB_PASSWORD=Bud@hos20
DB_NAME=buddhachin
PORT=3000
```

### 3. รันเซิร์ฟเวอร์

#### Development Mode (พร้อม auto-restart)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

---

## 📡 API Endpoints

### 🏥 Patient Management

#### 1. ดึงข้อมูลผู้ป่วยทั้งหมด
```http
GET /api/patients?limit=100&offset=0
```

**Response:**
```json
{
  "success": true,
  "count": 100,
  "data": [...]
}
```

#### 2. ค้นหาผู้ป่วยตาม HN
```http
GET /api/patient/:hn
```

**Example:**
```bash
curl http://localhost:3000/api/patient/123456
```

#### 3. เพิ่มข้อมูลผู้ป่วยใหม่
```http
POST /api/patient
Content-Type: application/json

{
  "hn": "123456",
  "cid": "1234567890123",
  "pname": "นาย",
  "fname": "สมชาย",
  "lname": "ใจดี",
  "birthdate": "1990-01-01",
  "sex": "M"
}
```

#### 4. แก้ไขข้อมูลผู้ป่วย
```http
PUT /api/patient/:hn
Content-Type: application/json

{
  "fname": "สมชาย",
  "lname": "ใจดีมาก"
}
```

#### 5. ลบข้อมูลผู้ป่วย
```http
DELETE /api/patient/:hn
```

---

### 🏥 Visit Management

#### ดึงข้อมูล Visit
```http
GET /api/visits?limit=100&vstdate=2024-01-20
```

---

### 🏥 Operation Management

#### ดึงข้อมูลหัตถการ
```http
GET /api/operations?limit=100&start_date=2024-01-01
```

---

### 📊 Statistics

#### สถิติผู้ป่วย
```http
GET /api/stats/patients
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_patients": 1500,
    "male_count": 750,
    "female_count": 700,
    "with_birthdate": 1400
  }
}
```

---

### 🔧 System Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "service": "Buddhachin Hospital Backend API",
  "database": "Connected",
  "dbInfo": {
    "time": "2024-01-20T10:30:00Z",
    "version": "PostgreSQL 14.x"
  }
}
```

#### Root
```http
GET /
```

---

## 📁 โครงสร้างโปรเจค

```
New p4p/
├── config/
│   └── db.js              # Database connection
├── routes/
│   └── data.js            # API routes
├── .env                   # Environment variables
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies
├── server.js             # Main server file
└── README.md             # Documentation
```

---

## 🔒 Database Configuration

### ข้อมูลการเชื่อมต่อ

- **Host**: 192.168.50.18
- **Port**: 5432
- **Database**: buddhachin
- **Username**: buddhachin
- **Password**: Bud@hos20

### ตัวอย่างตาราง (ถ้ายังไม่มี)

```sql
-- สร้างตาราง patient
CREATE TABLE IF NOT EXISTS patient (
    hn VARCHAR(20) PRIMARY KEY,
    cid VARCHAR(13) UNIQUE NOT NULL,
    pname VARCHAR(50),
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    birthdate DATE,
    sex CHAR(1) DEFAULT 'U',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patient_cid ON patient(cid);
CREATE INDEX idx_patient_name ON patient(fname, lname);
```

---

## 🧪 การทดสอบ

### ทดสอบการเชื่อมต่อ Database

```bash
curl http://localhost:3000/health
```

### ทดสอบดึงข้อมูลผู้ป่วย

```bash
curl http://localhost:3000/api/patients?limit=10
```

### ทดสอบเพิ่มข้อมูล

```bash
curl -X POST http://localhost:3000/api/patient \
  -H "Content-Type: application/json" \
  -d '{
    "hn": "123456",
    "cid": "1234567890123",
    "pname": "นาย",
    "fname": "ทดสอบ",
    "lname": "ระบบ",
    "birthdate": "1990-01-01",
    "sex": "M"
  }'
```

---

## ⚠️ หมายเหตุสำคัญ

### 1. ตรวจสอบ Firewall
ต้องแน่ใจว่า PostgreSQL Server (192.168.50.18:5432) เปิดรับ connection จากเครื่องที่รัน Backend

### 2. ตรวจสอบ pg_hba.conf
ไฟล์ `/etc/postgresql/14/main/pg_hba.conf` ต้องอนุญาตการเชื่อมต่อจาก IP ของคุณ:

```
host    all    all    0.0.0.0/0    md5
```

### 3. ตรวจสอบ postgresql.conf
```
listen_addresses = '*'
```

### 4. Restart PostgreSQL
```bash
sudo systemctl restart postgresql
```

---

## 🛠️ Troubleshooting

### ปัญหา: เชื่อมต่อ Database ไม่ได้

**วิธีแก้:**
1. ตรวจสอบว่า PostgreSQL Server ทำงานอยู่
2. ตรวจสอบ Firewall/Network
3. ตรวจสอบ username/password ใน `.env`
4. ตรวจสอบ logs ใน console

### ปัญหา: Port 3000 ถูกใช้งานแล้ว

**วิธีแก้:**
แก้ไข `PORT` ใน `.env`:
```env
PORT=3001
```

---

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อทีม IT โรงพยาบาลพุทธชินราช

---

**สร้างโดย:** Claude AI Assistant
**วันที่:** 2026-01-22
**Version:** 1.0.0
