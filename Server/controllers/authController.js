const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');

/**
 * Helper to generate JWT token
 * @param {Object} user - User document
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

/**
 * @desc    Login user and return JWT
 * @route   POST /api/auth/login
 * @access  Public (Rate limited)
 */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate request inputs
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username and password.',
      });
    }

    // Find user by lowercase trimmed username and explicitly select password
    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername }).select('+password');

    // Return the same generic error for non-existent user or invalid password
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact an administrator.',
      });
    }

    // Compare candidate password with stored hashed password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return response without password
    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        role: user.role,
        team: user.team,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Authenticated users)
 */
exports.getMe = async (req, res, next) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user._id).populate('team', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Test endpoint to verify admin role restriction
 * @route   GET /api/auth/admin-only
 * @access  Private (Admin only)
 */
exports.adminOnlyTest = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin access verified. Welcome to the admin-only route!',
    user: {
      _id: req.user._id,
      name: req.user.name,
      username: req.user.username,
      role: req.user.role,
    },
  });
};

