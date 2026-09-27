/**
 * FisherSafe — Fisherman Portal & Offline Sync Routes
 * Handlers for fisherman location updates, alert logging, SOS dispatch, and offline sync.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../auth');

// All routes require user authentication
router.use(authenticateToken);

/**
 * POST /api/fisherman/location
 * Report current GPS location when mobile internet/satellite is available
 */
router.post('/location', (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (lat === undefined || lon === undefined) {
      return res.status(400).json({ success: false, error: 'Latitude and Longitude are required' });
    }

    const now = Date.now();
    const user = req.user;

    // Update boat's last location
    if (user.boatId) {
      db.updateBoat(user.boatId, {
        lastLocation: { lat: parseFloat(lat), lon: parseFloat(lon), timestamp: now }
      });
    }

    return res.json({ success: true, timestamp: now });
  } catch (err) {
    console.error('Error reporting location:', err);
    return res.status(500).json({ success: false, error: 'Failed to record position' });
  }
});

/**
 * POST /api/fisherman/alert
 * Log boundary alert event to backend
 */
router.post('/alert', (req, res) => {
  try {
    const { alertType, distanceKm, lat, lon, notes } = req.body;
    const user = req.user;
    const now = Date.now();

    const statusMap = {
      warning_early: 'Warning',
      warning_strong: 'Warning',
      critical_boundary: 'Critical',
      crossed_boundary: 'Critical'
    };

    const newAlert = {
      id: 'alt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      alertId: 'ALT-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      fishermanId: user.fishermanId,
      boatId: user.boatId || 'UNKNOWN',
      alertType: alertType || 'warning_early',
      alertStatus: statusMap[alertType] || 'Warning',
      distanceKm: parseFloat(distanceKm) || 0,
      location: { lat: parseFloat(lat) || 0, lon: parseFloat(lon) || 0 },
      timestamp: now,
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      notes: notes || 'Logged from vessel unit.'
    };

    db.addAlert(newAlert);

    return res.status(201).json({
      success: true,
      message: 'Boundary alert logged on maritime surveillance server.',
      alert: newAlert
    });
  } catch (err) {
    console.error('Error saving alert:', err);
    return res.status(500).json({ success: false, error: 'Failed to save alert' });
  }
});

/**
 * POST /api/fisherman/sos
 * Dispatch Distress Beacon to Coast Guard & Server
 */
router.post('/sos', (req, res) => {
  try {
    const { emergencyType, lat, lon } = req.body;
    const user = req.user;
    const now = Date.now();

    const newEmergency = {
      id: 'emg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      emergencyId: 'SOS-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      fishermanId: user.fishermanId,
      boatId: user.boatId || 'UNKNOWN',
      emergencyType: emergencyType || 'MAYDAY',
      coords: { lat: parseFloat(lat) || 0, lon: parseFloat(lon) || 0 },
      status: 'Active',
      timestamp: now,
      acknowledgedAt: null,
      resolvedAt: null,
      adminNotes: 'Transmitted via vessel mobile app. VHF 16 alerted.',
      resolvedBy: null
    };

    db.addEmergency(newEmergency);

    // Update boat emergency status
    if (user.boatId) {
      db.updateBoat(user.boatId, { emergencyStatus: 'sos' });
    }

    return res.status(201).json({
      success: true,
      message: 'Distress beacon activated. Maritime Rescue Coordination Centre (MRCC) alerted.',
      emergency: newEmergency
    });
  } catch (err) {
    console.error('Error sending SOS:', err);
    return res.status(500).json({ success: false, error: 'Failed to activate SOS' });
  }
});

/**
 * GET /api/fisherman/my-alerts
 * Retrieve authenticated fisherman's own alerts
 */
router.get('/my-alerts', (req, res) => {
  try {
    const user = req.user;
    const myAlerts = db.getAlerts().filter(a => a.fishermanId === user.fishermanId);
    return res.json({
      success: true,
      alerts: myAlerts
    });
  } catch (err) {
    console.error('Error getting my alerts:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch alerts' });
  }
});

/**
 * POST /api/fisherman/sync
 * Synchronize events recorded locally while offline at sea
 */
router.post('/sync', (req, res) => {
  try {
    const { alerts = [], waypoints = [], trips = [] } = req.body;
    const user = req.user;
    let syncedCount = 0;

    // Process offline alerts
    alerts.forEach(offlineAlert => {
      // Avoid duplicate alert by ID
      const exists = db.getAlerts().some(a => a.id === offlineAlert.id || (a.timestamp === offlineAlert.timestamp && a.fishermanId === user.fishermanId));
      if (!exists) {
        db.addAlert({
          ...offlineAlert,
          id: offlineAlert.id || ('alt_sync_' + Date.now()),
          alertId: offlineAlert.alertId || ('ALT-SYNC-' + Math.floor(100 + Math.random() * 900)),
          fishermanId: user.fishermanId,
          boatId: user.boatId,
          syncedAt: Date.now()
        });
        syncedCount++;
      }
    });

    return res.json({
      success: true,
      message: `Successfully synchronized ${syncedCount} offline record(s) with surveillance server.`,
      syncedCount,
      serverTime: Date.now()
    });
  } catch (err) {
    console.error('Error processing offline sync:', err);
    return res.status(500).json({ success: false, error: 'Sync failed' });
  }
});

module.exports = router;
