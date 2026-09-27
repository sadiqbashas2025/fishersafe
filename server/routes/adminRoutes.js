/**
 * FisherSafe — Admin Dashboard Routes
 * Protected endpoints for maritime authority surveillance and management.
 * Strictly requires JWT authentication AND role='admin'.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole, sanitizeUser, hashPassword } = require('../auth');

// Apply authentication and role check to ALL admin routes
router.use(authenticateToken);
router.use(requireRole('admin'));

/**
 * GET /api/admin/stats
 * Overview dashboard summary cards
 */
router.get('/stats', (req, res) => {
  try {
    const users = db.getUsers();
    const boats = db.getBoats();
    const alerts = db.getAlerts();
    const emergencies = db.getEmergencies();
    const config = db.getConfig();

    const fishermen = users.filter(u => u.role === 'fisherman');
    const totalFishermen = fishermen.length;
    const activeFishermen = fishermen.filter(u => u.status === 'active').length;
    const disabledFishermen = fishermen.filter(u => u.status === 'disabled').length;

    const totalBoats = boats.length;
    const verifiedBoats = boats.filter(b => b.registrationStatus === 'verified').length;
    const pendingBoats = boats.filter(b => b.registrationStatus === 'pending').length;

    const totalAlerts = alerts.length;
    const activeAlerts = alerts.filter(a => a.alertStatus === 'Warning' || a.alertStatus === 'Critical').length;
    const criticalAlerts = alerts.filter(a => a.alertStatus === 'Critical').length;

    const totalEmergencies = emergencies.length;
    const activeEmergencies = emergencies.filter(e => e.status === 'Active' || e.status === 'Acknowledged').length;

    return res.json({
      success: true,
      stats: {
        totalFishermen,
        activeFishermen,
        disabledFishermen,
        totalBoats,
        verifiedBoats,
        pendingBoats,
        totalAlerts,
        activeAlerts,
        criticalAlerts,
        totalEmergencies,
        activeEmergencies,
        systemStatus: config.systemStatus,
        boundaryDataSource: config.boundaryDataSource,
        serverTime: Date.now()
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving statistics' });
  }
});

/**
 * GET /api/admin/fishermen
 * List all fishermen with search, filter, and pagination
 */
router.get('/fishermen', (req, res) => {
  try {
    const { query, status, port, page = 1, limit = 20 } = req.query;
    let list = db.getUsers().filter(u => u.role === 'fisherman');

    // Filter by status
    if (status && status !== 'all') {
      list = list.filter(u => u.status === status);
    }

    // Filter by port
    if (port && port !== 'all') {
      list = list.filter(u => u.homePort === port);
    }

    // Search query: name, ID, phone, boat
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(u =>
        u.fullName.toLowerCase().includes(q) ||
        u.fishermanId.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.boatId && u.boatId.toLowerCase().includes(q))
      );
    }

    const totalCount = list.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum).map(sanitizeUser);

    return res.json({
      success: true,
      fishermen: paginated,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error('Error listing fishermen:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving fishermen list' });
  }
});

/**
 * GET /api/admin/fishermen/:id
 * Retrieve details of a specific fisherman
 */
router.get('/fishermen/:id', (req, res) => {
  const user = db.findUserById(req.params.id);
  if (!user || user.role !== 'fisherman') {
    return res.status(404).json({ success: false, error: 'Fisherman account not found' });
  }
  const boat = db.findBoatById(user.boatId);
  return res.json({
    success: true,
    fisherman: sanitizeUser(user),
    boat: boat || null
  });
});

/**
 * PUT /api/admin/fishermen/:id
 * Update permitted profile fields or status
 */
router.put('/fishermen/:id', (req, res) => {
  try {
    const user = db.findUserById(req.params.id);
    if (!user || user.role !== 'fisherman') {
      return res.status(404).json({ success: false, error: 'Fisherman account not found' });
    }

    const { fullName, phone, homePort, emergencyContact, emergencyPhone, status } = req.body;
    const updates = {};

    if (fullName) updates.fullName = fullName.trim();
    if (phone) updates.phone = phone.trim();
    if (homePort) updates.homePort = homePort.trim();
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact.trim();
    if (emergencyPhone !== undefined) updates.emergencyPhone = emergencyPhone.trim();
    if (status && ['active', 'disabled'].includes(status)) {
      updates.status = status;
      // Log account status change
      db.addAuditLog({
        adminId: req.user.fishermanId,
        adminName: req.user.fullName,
        action: status === 'active' ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DISABLED',
        targetType: 'USER',
        targetId: user.fishermanId,
        details: `Account status changed to '${status}' by administrator.`,
        ipAddress: req.ip
      });
    }

    const updatedUser = db.updateUser(user.id, updates);

    return res.json({
      success: true,
      message: 'Fisherman profile updated successfully.',
      fisherman: sanitizeUser(updatedUser)
    });
  } catch (err) {
    console.error('Error updating fisherman:', err);
    return res.status(500).json({ success: false, error: 'Failed to update fisherman profile' });
  }
});

/**
 * DELETE /api/admin/fishermen/:id
 * Delete account with required authorization and audit trail
 */
router.delete('/fishermen/:id', (req, res) => {
  try {
    const user = db.findUserById(req.params.id);
    if (!user || user.role !== 'fisherman') {
      return res.status(404).json({ success: false, error: 'Fisherman account not found' });
    }

    const deleted = db.deleteUser(user.id);
    if (!deleted) {
      return res.status(500).json({ success: false, error: 'Could not delete fisherman account' });
    }

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: 'ACCOUNT_DELETED',
      targetType: 'USER',
      targetId: user.fishermanId,
      details: `Fisherman account '${user.fullName}' (${user.fishermanId}) deleted with authorization.`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Account ${user.fishermanId} deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting fisherman:', err);
    return res.status(500).json({ success: false, error: 'Server error deleting account' });
  }
});

/**
 * GET /api/admin/boats
 * List registered boats
 */
router.get('/boats', (req, res) => {
  try {
    const { query, status } = req.query;
    let list = db.getBoats();

    if (status && status !== 'all') {
      list = list.filter(b => b.registrationStatus === status);
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(b =>
        b.boatId.toLowerCase().includes(q) ||
        (b.boatName && b.boatName.toLowerCase().includes(q)) ||
        (b.ownerName && b.ownerName.toLowerCase().includes(q)) ||
        (b.ownerFishermanId && b.ownerFishermanId.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      boats: list
    });
  } catch (err) {
    console.error('Error listing boats:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching boats' });
  }
});

/**
 * PUT /api/admin/boats/:id
 * Update boat details or registration status
 */
router.put('/boats/:id', (req, res) => {
  try {
    const boat = db.findBoatById(req.params.id);
    if (!boat) {
      return res.status(404).json({ success: false, error: 'Boat record not found' });
    }

    const { boatName, boatType, registrationStatus, emergencyStatus } = req.body;
    const updates = {};
    if (boatName) updates.boatName = boatName.trim();
    if (boatType) updates.boatType = boatType.trim();
    if (registrationStatus) updates.registrationStatus = registrationStatus;
    if (emergencyStatus) updates.emergencyStatus = emergencyStatus;

    const updated = db.updateBoat(boat.id, updates);

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: 'BOAT_RECORD_UPDATED',
      targetType: 'BOAT',
      targetId: boat.boatId,
      details: `Boat details updated: ${JSON.stringify(updates)}`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Boat record updated successfully.',
      boat: updated
    });
  } catch (err) {
    console.error('Error updating boat:', err);
    return res.status(500).json({ success: false, error: 'Failed to update boat record' });
  }
});

/**
 * GET /api/admin/alerts
 * View and filter safety boundary alerts
 */
router.get('/alerts', (req, res) => {
  try {
    const { status, type } = req.query;
    let list = db.getAlerts();

    if (status && status !== 'all') {
      list = list.filter(a => a.alertStatus.toLowerCase() === status.toLowerCase());
    }

    if (type && type !== 'all') {
      list = list.filter(a => a.alertType === type);
    }

    return res.json({
      success: true,
      alerts: list,
      configInfo: {
        legalNotice: 'Official legal border points are governed by UNCLOS 1974 & 1976 bilateral treaties. Concentric zones (50km, 20km, 5km) represent configurable administrative safety warning buffers.'
      }
    });
  } catch (err) {
    console.error('Error listing alerts:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving alerts' });
  }
});

/**
 * PUT /api/admin/alerts/:id/acknowledge
 * Acknowledge or resolve an alert
 */
router.put('/alerts/:id/status', (req, res) => {
  try {
    const { status, notes } = req.body;
    const updates = {
      alertStatus: status || 'Acknowledged',
      acknowledged: true,
      acknowledgedBy: req.user.fishermanId,
      acknowledgedAt: Date.now()
    };
    if (notes) updates.notes = notes;

    const updated = db.updateAlert(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: 'ALERT_STATUS_UPDATE',
      targetType: 'ALERT',
      targetId: req.params.id,
      details: `Alert marked as '${updates.alertStatus}'. Notes: ${notes || 'None'}`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Alert status updated.',
      alert: updated
    });
  } catch (err) {
    console.error('Error updating alert status:', err);
    return res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

/**
 * GET /api/admin/emergencies
 * View all emergency SOS beacons
 */
router.get('/emergencies', (req, res) => {
  try {
    const { status } = req.query;
    let list = db.getEmergencies();

    if (status && status !== 'all') {
      list = list.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }

    return res.json({
      success: true,
      emergencies: list
    });
  } catch (err) {
    console.error('Error listing emergencies:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving emergencies' });
  }
});

/**
 * PUT /api/admin/emergencies/:id
 * Acknowledge or resolve emergency distress alert
 */
router.put('/emergencies/:id', (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updates = {
      status: status || 'Acknowledged',
      adminNotes: adminNotes || ''
    };

    if (status === 'Acknowledged' && !updates.acknowledgedAt) {
      updates.acknowledgedAt = Date.now();
    }
    if (status === 'Resolved') {
      updates.resolvedAt = Date.now();
      updates.resolvedBy = req.user.fishermanId;
    }

    const updated = db.updateEmergency(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Emergency event not found' });
    }

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: `EMERGENCY_${status.toUpperCase()}`,
      targetType: 'EMERGENCY',
      targetId: req.params.id,
      details: `Distress beacon status updated to ${status}. Notes: ${adminNotes || 'None'}`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Emergency status updated to ${status}.`,
      emergency: updated
    });
  } catch (err) {
    console.error('Error updating emergency:', err);
    return res.status(500).json({ success: false, error: 'Failed to update emergency event' });
  }
});

/**
 * GET /api/admin/admins
 * List authorized administrators (never expose passwords)
 */
router.get('/admins', (req, res) => {
  try {
    const admins = db.getUsers().filter(u => u.role === 'admin').map(sanitizeUser);
    return res.json({
      success: true,
      admins
    });
  } catch (err) {
    console.error('Error listing admins:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve admin list' });
  }
});

/**
 * POST /api/admin/admins
 * Secure process to provision an administrator account.
 * Only existing authenticated administrators can provision a new administrator.
 */
router.post('/admins', async (req, res) => {
  try {
    const { fullName, adminId, email, phone, password, rolePermission } = req.body;

    if (!fullName || !adminId || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide Full Name, Admin ID, Phone, and Password for the new administrator.'
      });
    }

    const cleanAdminId = adminId.trim().toUpperCase();
    const existing = db.getUsers().find(u => u.fishermanId.toUpperCase() === cleanAdminId);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this Admin ID already exists.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Admin password must be at least 8 characters long for high security.'
      });
    }

    const passwordHash = await hashPassword(password);
    const now = Date.now();

    const newAdmin = {
      id: 'usr_admin_' + Date.now(),
      fishermanId: cleanAdminId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      passwordHash,
      role: 'admin',
      permissions: rolePermission || 'FULL_MARITIME_ADMIN',
      status: 'active',
      boatId: 'HQ-SURVEILLANCE',
      homePort: 'Coast Guard Command',
      emergencyContact: 'Command Center',
      emergencyPhone: '1554',
      createdAt: now,
      createdBy: req.user.fishermanId,
      lastLoginAt: null
    };

    db.addUser(newAdmin);

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: 'ADMIN_ACCOUNT_CREATED',
      targetType: 'USER',
      targetId: cleanAdminId,
      details: `New administrator '${fullName}' (${cleanAdminId}) created by ${req.user.fullName}.`,
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `Admin account ${cleanAdminId} created successfully.`,
      admin: sanitizeUser(newAdmin)
    });
  } catch (err) {
    console.error('Error creating admin account:', err);
    return res.status(500).json({ success: false, error: 'Server error provisioning admin account' });
  }
});

/**
 * PUT /api/admin/admins/:id/status
 * Toggle admin active/disabled status
 */
router.put('/admins/:id/status', (req, res) => {
  try {
    const admin = db.findUserById(req.params.id);
    if (!admin || admin.role !== 'admin') {
      return res.status(404).json({ success: false, error: 'Admin account not found' });
    }

    // Prevent admin from disabling their own account
    if (admin.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Security restriction: You cannot deactivate your own administrative account.'
      });
    }

    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be active or disabled' });
    }

    const updated = db.updateUser(admin.id, { status });

    db.addAuditLog({
      adminId: req.user.fishermanId,
      adminName: req.user.fullName,
      action: status === 'active' ? 'ADMIN_REACTIVATED' : 'ADMIN_DEACTIVATED',
      targetType: 'ADMIN',
      targetId: admin.fishermanId,
      details: `Admin account '${admin.fullName}' status changed to '${status}'.`,
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Admin status changed to ${status}.`,
      admin: sanitizeUser(updated)
    });
  } catch (err) {
    console.error('Error updating admin status:', err);
    return res.status(500).json({ success: false, error: 'Failed to update admin status' });
  }
});

/**
 * GET /api/admin/audit-logs
 * View administrative audit trail
 */
router.get('/audit-logs', (req, res) => {
  try {
    const logs = db.getAuditLogs();
    return res.json({
      success: true,
      logs
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching audit trail' });
  }
});

/**
 * GET /api/admin/analytics
 * Aggregated reports and trends for maritime safety surveillance
 */
router.get('/analytics', (req, res) => {
  try {
    const users = db.getUsers().filter(u => u.role === 'fisherman');
    const boats = db.getBoats();
    const alerts = db.getAlerts();
    const emergencies = db.getEmergencies();

    // Port distribution
    const portDistribution = {};
    users.forEach(u => {
      const p = u.homePort || 'Unspecified';
      portDistribution[p] = (portDistribution[p] || 0) + 1;
    });

    // Alert type distribution
    const alertTypeCounts = {
      warning_early: 0,
      warning_strong: 0,
      critical_boundary: 0,
      crossed_boundary: 0
    };
    alerts.forEach(a => {
      if (alertTypeCounts[a.alertType] !== undefined) {
        alertTypeCounts[a.alertType]++;
      }
    });

    // Alert status counts
    const alertStatusCounts = {
      Safe: 0,
      Warning: 0,
      Critical: 0,
      Resolved: 0
    };
    alerts.forEach(a => {
      if (alertStatusCounts[a.alertStatus] !== undefined) {
        alertStatusCounts[a.alertStatus]++;
      } else {
        alertStatusCounts[a.alertStatus] = 1;
      }
    });

    // Boat types
    const boatTypeCounts = {};
    boats.forEach(b => {
      const t = b.boatType || 'Motorized Craft';
      boatTypeCounts[t] = (boatTypeCounts[t] || 0) + 1;
    });

    return res.json({
      success: true,
      analytics: {
        totalFishermen: users.length,
        totalBoats: boats.length,
        totalAlerts: alerts.length,
        totalEmergencies: emergencies.length,
        portDistribution,
        alertTypeCounts,
        alertStatusCounts,
        boatTypeCounts,
        emergencyTypes: {
          MAYDAY: emergencies.filter(e => e.emergencyType === 'MAYDAY').length,
          PANPAN: emergencies.filter(e => e.emergencyType === 'PAN-PAN').length,
          OTHER: emergencies.filter(e => e.emergencyType !== 'MAYDAY' && e.emergencyType !== 'PAN-PAN').length
        }
      }
    });
  } catch (err) {
    console.error('Error generating analytics:', err);
    return res.status(500).json({ success: false, error: 'Server error generating reports' });
  }
});

module.exports = router;
