/**
 * FisherSafe — Database Engine
 * Persistent file-backed JSON database with atomic writes and transaction safety.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory state
let db = {
  users: [],
  boats: [],
  alerts: [],
  emergencies: [],
  auditLogs: [],
  systemConfig: {
    systemStatus: 'OPERATIONAL',
    maintenanceMode: false,
    boundaryDataSource: 'UNCLOS 1974 & 1976 Bilateral Maritime Boundary Agreements (Authoritative Public Coordinates)',
    safetyZoneBufferKm: {
      early: 50,
      strong: 20,
      critical: 5
    }
  }
};

/**
 * Atomic save to disk
 */
function saveDB() {
  const tmpFile = DB_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Database write error:', err);
  }
}

/**
 * Load database from disk or seed default data
 */
async function initDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(raw);
      console.log('Loaded database with', db.users.length, 'users');
      return;
    } catch (err) {
      console.error('Error reading database file, reseeding...', err);
    }
  }

  // Pre-seed default data
  console.log('Seeding initial database with secure credentials...');
  
  // Hash passwords
  const adminPasswordHash = await bcrypt.hash('Admin@FisherSafe2026!', 10);
  const fisherPasswordHash = await bcrypt.hash('Fisherman@123', 10);

  const now = Date.now();

  db = {
    users: [
      {
        id: 'usr_admin_001',
        fishermanId: 'ADMIN001',
        fullName: 'Maritime Safety Officer Raman',
        phone: '9840123456',
        email: 'admin@fishersafe.gov.in',
        passwordHash: adminPasswordHash,
        role: 'admin',
        status: 'active',
        boatId: 'GOI-CG-OFFICIAL',
        homePort: 'Chennai Fishing Harbor',
        emergencyContact: 'HQ Maritime Surveillance',
        emergencyPhone: '1554',
        createdAt: now - 30 * 86400000,
        lastLoginAt: now - 3600000
      },
      {
        id: 'usr_fish_001',
        fishermanId: 'IND-TN-9821',
        fullName: 'Murugan Selvam',
        phone: '9876543210',
        email: 'murugan.selvam@tamilfisher.in',
        passwordHash: fisherPasswordHash,
        role: 'fisherman',
        status: 'active',
        boatId: 'TN-04-MM-1234',
        homePort: 'Rameswaram',
        emergencyContact: 'Anjali Murugan',
        emergencyPhone: '9841023456',
        createdAt: now - 15 * 86400000,
        lastLoginAt: now - 7200000
      },
      {
        id: 'usr_fish_002',
        fishermanId: 'IND-TN-4512',
        fullName: 'Anthony Xavier',
        phone: '9443219876',
        email: 'anthony.xavier@kanniyakumari.in',
        passwordHash: fisherPasswordHash,
        role: 'fisherman',
        status: 'active',
        boatId: 'TN-06-KK-5678',
        homePort: 'Kanyakumari Harbor',
        emergencyContact: 'Mary Xavier',
        emergencyPhone: '9443219870',
        createdAt: now - 10 * 86400000,
        lastLoginAt: now - 18000000
      },
      {
        id: 'usr_fish_003',
        fishermanId: 'IND-TN-7733',
        fullName: 'Ramesh Perumal',
        phone: '9789012345',
        email: 'ramesh.p@mandapam.in',
        passwordHash: fisherPasswordHash,
        role: 'fisherman',
        status: 'disabled', // Disabled account for testing disabled account login scenario
        boatId: 'TN-05-MD-9012',
        homePort: 'Mandapam Harbor',
        emergencyContact: 'Lakshmi Perumal',
        emergencyPhone: '9789012340',
        createdAt: now - 20 * 86400000,
        lastLoginAt: now - 86400000
      }
    ],

    boats: [
      {
        id: 'boat_001',
        boatId: 'TN-04-MM-1234',
        ownerFishermanId: 'IND-TN-9821',
        ownerName: 'Murugan Selvam',
        boatName: 'Kadalarasan 1',
        boatType: 'Motorized Trawler',
        homePort: 'Rameswaram',
        registrationStatus: 'verified',
        lastLocation: { lat: 9.3200, lon: 79.5100, timestamp: now - 900000 },
        emergencyStatus: 'safe',
        createdAt: now - 15 * 86400000
      },
      {
        id: 'boat_002',
        boatId: 'TN-06-KK-5678',
        ownerFishermanId: 'IND-TN-4512',
        ownerName: 'Anthony Xavier',
        boatName: 'St. Mary Deep Sea',
        boatType: 'Gillnetter',
        homePort: 'Kanyakumari Harbor',
        registrationStatus: 'verified',
        lastLocation: { lat: 8.4500, lon: 78.1200, timestamp: now - 1800000 },
        emergencyStatus: 'safe',
        createdAt: now - 10 * 86400000
      },
      {
        id: 'boat_003',
        boatId: 'TN-05-MD-9012',
        ownerFishermanId: 'IND-TN-7733',
        ownerName: 'Ramesh Perumal',
        boatName: 'Meenatchi',
        boatType: 'Traditional Country Craft',
        homePort: 'Mandapam Harbor',
        registrationStatus: 'suspended',
        lastLocation: { lat: 9.2800, lon: 79.1200, timestamp: now - 86400000 },
        emergencyStatus: 'safe',
        createdAt: now - 20 * 86400000
      }
    ],

    alerts: [
      {
        id: 'alt_001',
        alertId: 'ALT-2026-001',
        fishermanId: 'IND-TN-9821',
        boatId: 'TN-04-MM-1234',
        alertType: 'warning_early',
        alertStatus: 'Resolved',
        distanceKm: 42.5,
        location: { lat: 9.3512, lon: 79.4891 },
        timestamp: now - 3600000 * 5,
        acknowledged: true,
        acknowledgedBy: 'ADMIN001',
        acknowledgedAt: now - 3600000 * 4,
        notes: 'Vessel turned back southwest towards Rameswaram.'
      },
      {
        id: 'alt_002',
        alertId: 'ALT-2026-002',
        fishermanId: 'IND-TN-4512',
        boatId: 'TN-06-KK-5678',
        alertType: 'warning_strong',
        alertStatus: 'Warning',
        distanceKm: 18.2,
        location: { lat: 9.1820, lon: 79.5210 },
        timestamp: now - 1800000,
        acknowledged: true,
        acknowledgedBy: 'ADMIN001',
        acknowledgedAt: now - 900000,
        notes: 'Warning beacon broadcast on VHF Channel 16.'
      },
      {
        id: 'alt_003',
        alertId: 'ALT-2026-003',
        fishermanId: 'IND-TN-9821',
        boatId: 'TN-04-MM-1234',
        alertType: 'critical_boundary',
        alertStatus: 'Critical',
        distanceKm: 4.8,
        location: { lat: 9.3100, lon: 79.7900 },
        timestamp: now - 600000,
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        notes: 'Active proximity alarm triggered in Palk Strait sector.'
      }
    ],

    emergencies: [
      {
        id: 'emg_001',
        emergencyId: 'SOS-2026-089',
        fishermanId: 'IND-TN-9821',
        boatId: 'TN-04-MM-1234',
        emergencyType: 'MAYDAY',
        coords: { lat: 9.3210, lon: 79.5200 },
        status: 'Acknowledged',
        timestamp: now - 2400000,
        acknowledgedAt: now - 1800000,
        resolvedAt: null,
        adminNotes: 'Coast Guard Mandapam station alerted. Interceptor vessel dispatched.',
        resolvedBy: null
      },
      {
        id: 'emg_002',
        emergencyId: 'SOS-2026-088',
        fishermanId: 'IND-TN-4512',
        boatId: 'TN-06-KK-5678',
        emergencyType: 'PAN-PAN',
        coords: { lat: 8.5200, lon: 78.3100 },
        status: 'Resolved',
        timestamp: now - 86400000 * 2,
        acknowledgedAt: now - 86400000 * 2 + 600000,
        resolvedAt: now - 86400000 * 2 + 7200000,
        adminNotes: 'Engine failure resolved by nearby fishing vessel towing back to harbor.',
        resolvedBy: 'ADMIN001'
      }
    ],

    auditLogs: [
      {
        id: 'aud_001',
        adminId: 'ADMIN001',
        adminName: 'Maritime Safety Officer Raman',
        action: 'SYSTEM_INITIALIZATION',
        targetType: 'SYSTEM',
        targetId: 'CONFIG',
        details: 'System initialized with UNCLOS authoritative maritime boundary data.',
        timestamp: now - 30 * 86400000,
        ipAddress: '127.0.0.1'
      },
      {
        id: 'aud_002',
        adminId: 'ADMIN001',
        adminName: 'Maritime Safety Officer Raman',
        action: 'ACCOUNT_DEACTIVATED',
        targetType: 'USER',
        targetId: 'IND-TN-7733',
        details: 'Account deactivated pending boat fitness certificate renewal.',
        timestamp: now - 86400000,
        ipAddress: '127.0.0.1'
      }
    ],

    systemConfig: {
      systemStatus: 'OPERATIONAL',
      maintenanceMode: false,
      boundaryDataSource: 'UNCLOS 1974 & 1976 Bilateral Maritime Boundary Agreements (Authoritative Public Coordinates)',
      safetyZoneBufferKm: {
        early: 50,
        strong: 20,
        critical: 5
      }
    }
  };

  saveDB();
  console.log('Default database seeded successfully.');
}

// Helper query functions
const dbService = {
  initDB,
  saveDB,
  getUsers: () => db.users,
  findUserById: (id) => db.users.find(u => u.id === id),
  findUserByIdentifier: (identifier) => {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return db.users.find(u => 
      u.fishermanId.toLowerCase() === clean ||
      (u.email && u.email.toLowerCase() === clean) ||
      u.phone === clean
    );
  },
  addUser: (userData) => {
    db.users.push(userData);
    saveDB();
    return userData;
  },
  updateUser: (id, updates) => {
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...updates, updatedAt: Date.now() };
    saveDB();
    return db.users[idx];
  },
  deleteUser: (id) => {
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    const deleted = db.users.splice(idx, 1)[0];
    saveDB();
    return deleted;
  },

  // Boats
  getBoats: () => db.boats,
  findBoatById: (boatId) => db.boats.find(b => b.boatId.toUpperCase() === boatId.toUpperCase()),
  addBoat: (boatData) => {
    db.boats.push(boatData);
    saveDB();
    return boatData;
  },
  updateBoat: (id, updates) => {
    const idx = db.boats.findIndex(b => b.id === id || b.boatId === id);
    if (idx === -1) return null;
    db.boats[idx] = { ...db.boats[idx], ...updates, updatedAt: Date.now() };
    saveDB();
    return db.boats[idx];
  },

  // Alerts
  getAlerts: () => db.alerts,
  addAlert: (alertData) => {
    db.alerts.unshift(alertData);
    saveDB();
    return alertData;
  },
  updateAlert: (id, updates) => {
    const idx = db.alerts.findIndex(a => a.id === id || a.alertId === id);
    if (idx === -1) return null;
    db.alerts[idx] = { ...db.alerts[idx], ...updates };
    saveDB();
    return db.alerts[idx];
  },

  // Emergencies
  getEmergencies: () => db.emergencies,
  addEmergency: (emgData) => {
    db.emergencies.unshift(emgData);
    saveDB();
    return emgData;
  },
  updateEmergency: (id, updates) => {
    const idx = db.emergencies.findIndex(e => e.id === id || e.emergencyId === id);
    if (idx === -1) return null;
    db.emergencies[idx] = { ...db.emergencies[idx], ...updates };
    saveDB();
    return db.emergencies[idx];
  },

  // Audit Logs
  getAuditLogs: () => db.auditLogs,
  addAuditLog: (entry) => {
    const log = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: Date.now(),
      ...entry
    };
    db.auditLogs.unshift(log);
    // keep max 500 logs
    if (db.auditLogs.length > 500) db.auditLogs.pop();
    saveDB();
    return log;
  },

  // System config
  getConfig: () => db.systemConfig,
  updateConfig: (updates) => {
    db.systemConfig = { ...db.systemConfig, ...updates };
    saveDB();
    return db.systemConfig;
  }
};

module.exports = dbService;
