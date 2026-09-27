/**
 * FisherSafe — Authentication Routes
 * Real registration validation and credential authentication.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, verifyPassword, generateToken, sanitizeUser, authenticateToken } = require('../auth');

/**
 * Helper: Validate Mobile Number (Indian standard: 10 digits starting 6, 7, 8, 9)
 */
function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(String(phone).trim());
}

/**
 * Helper: Validate Email Format (optional)
 */
function isValidEmail(email) {
  if (!email || email.trim() === '') return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Helper: Validate Password Complexity (minimum 6 characters, at least 1 letter and 1 number)
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

/**
 * POST /api/auth/register
 * Public registration for Indian fishermen.
 * Strictly assigns role='fisherman' on the server.
 */
router.post('/register', async (req, res) => {
  try {
    const {
      fullName,
      fishermanId,
      phone,
      email,
      password,
      confirmPassword,
      boatId,
      homePort,
      emergencyContact,
      emergencyPhone
    } = req.body;

    const errors = [];

    // 1. Required field checks
    if (!fullName || !fullName.trim()) errors.push('Full Name is required.');
    if (!fishermanId || !fishermanId.trim()) errors.push('Fisherman ID / User ID is required.');
    if (!phone || !phone.trim()) errors.push('Mobile Number is required.');
    if (!password) errors.push('Password is required.');
    if (!confirmPassword) errors.push('Confirm Password is required.');
    if (!boatId || !boatId.trim()) errors.push('Boat Registration Number is required.');
    if (!homePort || !homePort.trim()) errors.push('Home Port is required.');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
        allErrors: errors
      });
    }

    // 2. Format validation
    const cleanFullName = fullName.trim();
    if (!/^[A-Za-z\s.]{2,60}$/.test(cleanFullName)) {
      return res.status(400).json({
        success: false,
        error: 'Full Name must contain alphabetic characters only (min 2 letters).'
      });
    }

    const cleanFishermanId = fishermanId.trim().toUpperCase();
    if (!/^[A-Z0-9\-_]{4,25}$/.test(cleanFishermanId)) {
      return res.status(400).json({
        success: false,
        error: 'Fisherman ID must be alphanumeric (e.g., IND-TN-9821, min 4 characters).'
      });
    }

    const cleanPhone = phone.trim();
    if (!isValidPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit mobile number (starting with 6, 7, 8, or 9).'
      });
    }

    const cleanEmail = email ? email.trim() : null;
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format.'
      });
    }

    // 3. Password match & complexity
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match. Please re-enter identical passwords.'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long and contain both letters and numbers.'
      });
    }

    // 4. Duplicate Account Checks
    const users = db.getUsers();

    const existingId = users.find(u => u.fishermanId.toUpperCase() === cleanFishermanId);
    if (existingId) {
      return res.status(409).json({
        success: false,
        error: 'This Fisherman ID is already registered. Please login or choose a unique ID.'
      });
    }

    const existingPhone = users.find(u => u.phone === cleanPhone);
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        error: 'An account with this mobile number already exists.'
      });
    }

    if (cleanEmail) {
      const existingEmail = users.find(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists.'
        });
      }
    }

    // 5. Clean boat ID and register boat if not exists
    const cleanBoatId = boatId.trim().toUpperCase();
    if (cleanBoatId.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid Boat Registration Number (min 4 characters).'
      });
    }

    // 6. Security rule: NEVER allow public registration to choose 'admin'
    // Public registration ALWAYS assigns role='fisherman'
    const role = 'fisherman';

    // 7. Secure password hashing
    const passwordHash = await hashPassword(password);

    const now = Date.now();
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      fishermanId: cleanFishermanId,
      fullName: cleanFullName,
      phone: cleanPhone,
      email: cleanEmail || '',
      passwordHash,
      role,
      status: 'active',
      boatId: cleanBoatId,
      homePort: homePort.trim(),
      emergencyContact: (emergencyContact || '').trim(),
      emergencyPhone: (emergencyPhone || '').trim(),
      createdAt: now,
      lastLoginAt: now
    };

    db.addUser(newUser);

    // Also register or update vessel in boats collection
    const existingBoat = db.findBoatById(cleanBoatId);
    if (!existingBoat) {
      db.addBoat({
        id: 'boat_' + Date.now(),
        boatId: cleanBoatId,
        ownerFishermanId: cleanFishermanId,
        ownerName: cleanFullName,
        boatName: cleanFullName + ' Vessel',
        boatType: 'Mechanized Fishing Craft',
        homePort: homePort.trim(),
        registrationStatus: 'verified',
        lastLocation: { lat: 9.2800, lon: 79.3000, timestamp: now },
        emergencyStatus: 'safe',
        createdAt: now
      });
    }

    // Generate JWT token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to the FisherSafe Maritime Safety System.',
      token,
      user: sanitizeUser(newUser)
    });

  } catch (err) {
    console.error('Registration server error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during registration. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Real credential verification against database with bcrypt hash comparison.
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Check empty fields
    if (!identifier || !identifier.trim() || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter all required fields: User ID / Mobile and Password.'
      });
    }

    const cleanIdentifier = identifier.trim();

    // Find account by Fisherman ID, mobile number, or email
    const user = db.findUserByIdentifier(cleanIdentifier);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Account not found or invalid credentials.'
      });
    }

    // Check account status
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'This account has been disabled or suspended. Please contact maritime administration.'
      });
    }

    // Verify password hash
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password or invalid credentials.'
      });
    }

    // Update last login timestamp
    const now = Date.now();
    db.updateUser(user.id, { lastLoginAt: now });

    // Generate authenticated JWT
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful. Welcome to the Maritime Safety System.',
      token,
      user: sanitizeUser(user)
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during authentication.'
    });
  }
});

/**
 * GET /api/auth/me
 * Returns currently authenticated user
 */
router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Secure logout endpoint
 */
router.post('/logout', authenticateToken, (req, res) => {
  // If needed, log the logout action
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
