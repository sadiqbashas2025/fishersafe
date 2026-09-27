/**
 * FisherSafe — Authentication & Authorization Middleware
 * Secure JWT verification, Bcrypt password hashing, and Role-Based Access Control (RBAC).
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

// In production, configure via environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'FisherSafe_Maritime_Secured_Key_2026_ProdSecret!';
const JWT_EXPIRY = '24h';

/**
 * Hash password securely using bcrypt
 */
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, 10);
}

/**
 * Verify password against stored bcrypt hash
 */
async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  return await bcrypt.compare(plainPassword, hash);
}

/**
 * Generate signed JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    fishermanId: user.fishermanId,
    role: user.role,
    fullName: user.fullName
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Sanitize user object to never expose password hashes or internal sensitive fields
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...cleanUser } = user;
  return cleanUser;
}

/**
 * Express middleware to authenticate JWT token from Authorization header
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No authorization token provided.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Session expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid or corrupted authentication token.',
        code: 'TOKEN_INVALID'
      });
    }

    // Fetch verified user from database to ensure account is still active and role hasn't changed
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Account not found or has been removed.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'This account has been deactivated. Please contact maritime administration.'
      });
    }

    // Attach authenticated user to request
    req.user = sanitizeUser(user);
    next();
  });
}

/**
 * Express middleware to enforce Role-Based Access Control on the backend
 * @param  {...string} allowedRoles Roles permitted to access route (e.g. 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Audit unauthorized access attempts
      db.addAuditLog({
        adminId: req.user.fishermanId,
        adminName: req.user.fullName,
        action: 'UNAUTHORIZED_ACCESS_BLOCKED',
        targetType: 'ENDPOINT',
        targetId: req.originalUrl,
        details: `User with role '${req.user.role}' attempted to access restricted endpoint requiring [${allowedRoles.join(', ')}].`,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied: You do not have administrator permissions to access this feature.',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  sanitizeUser,
  authenticateToken,
  requireRole,
  JWT_SECRET
};
