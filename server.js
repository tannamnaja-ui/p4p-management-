const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./config/db');
const dataRoutes = require('./routes/data');
const p4pRoutes = require('./routes/p4p');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3009;

// =====================================
// Middleware Configuration
// =====================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// =====================================
// API Routes
// =====================================
app.use('/api', dataRoutes);
app.use('/api/p4p', p4pRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);

// =====================================
// Health Check
// =====================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'P4P Backend API',
    database: db.isConnected() ? 'Connected' : 'Disconnected',
    db_type: db.currentType() || '-',
    timestamp: new Date().toISOString()
  });
});

// =====================================
// 404 Handler
// =====================================
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', path: req.path });
});

// =====================================
// Global Error Handler
// =====================================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

// =====================================
// Start Server
// =====================================
const startServer = async () => {
  console.log('🚀 Starting P4P Backend Server...');

  // พยายามเชื่อมต่อ DB จาก settings ที่บันทึกไว้
  const saved = db.loadSettings();
  if (saved.db_host && saved.db_type) {
    console.log(`🔌 Trying saved connection: ${saved.db_type} @ ${saved.db_host}...`);
    const result = await db.connect(saved);
    if (result.success) {
      console.log('✅ Auto-connected to database from saved settings');
    } else {
      console.warn('⚠️  Auto-connect failed:', result.error);
      console.warn('   กรุณาตั้งค่าการเชื่อมต่อผ่านหน้าเว็บ');
    }
  } else {
    console.warn('⚠️  ยังไม่มี settings การเชื่อมต่อ กรุณาตั้งค่าผ่านหน้าเว็บ');
  }

  app.listen(PORT, () => {
    console.log('');
    console.log('✅ Server is running!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });
};

// =====================================
// Graceful Shutdown
// =====================================
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} - shutting down...`);
  try {
    await db.closePool();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch {
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason));
process.on('uncaughtException', (error) => { console.error('❌ Uncaught Exception:', error); shutdown('UNCAUGHT_EXCEPTION'); });

startServer();
module.exports = app;
