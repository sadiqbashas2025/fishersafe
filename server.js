/**
 * FisherSafe — Maritime Safety & Offline Boundary Alert System
 * Main Express Application Server
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./server/db');

const authRoutes = require('./server/routes/authRoutes');
const adminRoutes = require('./server/routes/adminRoutes');
const fishermanRoutes = require('./server/routes/fishermanRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const dbReady = db.initDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    next(err);
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'FisherSafe Maritime Safety Backend',
    timestamp: Date.now(),
    version: '2.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fisherman', fishermanRoutes);

// Fallback route for SPA navigation
app.use((req, res) => {
  // If request is for an API that doesn't exist, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await dbReady;
    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`⚓ FisherSafe Maritime Safety Server is running!`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🔒 Authentication: Secure Bcrypt + JWT (24h)`);
      console.log(`🛡️ Admin Access: Enforced by server RBAC`);
      console.log(`----------------------------------------------------`);
      console.log(`Default Test Credentials:`);
      console.log(`👑 Admin:     ADMIN001    | Password: Admin@FisherSafe2026!`);
      console.log(`🚢 Fisherman: IND-TN-9821 | Password: Fisherman@123`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Failed to start FisherSafe server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
