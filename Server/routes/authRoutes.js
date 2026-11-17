const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const loginRateLimiter = require('../middleware/loginRateLimiter');

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public (Failed-attempt rate limited)
router.post('/login', loginRateLimiter.middleware, authController.login);

// @route   GET /api/auth/me
// @desc    Get currently logged in user
// @access  Private
router.get('/me', auth, authController.getMe);

// @route   GET /api/auth/admin-only
// @desc    Test route to verify admin role authorization
// @access  Private (Admin only)
router.get('/admin-only', auth, roleCheck('admin'), authController.adminOnlyTest);

module.exports = router;

