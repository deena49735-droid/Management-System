const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Rate limiting for login route: max 10 requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public (Rate limited)
router.post('/login', loginLimiter, authController.login);

// @route   GET /api/auth/me
// @desc    Get currently logged in user
// @access  Private
router.get('/me', auth, authController.getMe);

// @route   GET /api/auth/admin-only
// @desc    Test route to verify admin role authorization
// @access  Private (Admin only)
router.get('/admin-only', auth, roleCheck('admin'), authController.adminOnlyTest);

module.exports = router;

