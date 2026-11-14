const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');

/**
 * Helper to generate JWT token
 * @param {Object} user - User document
 * @param {string} [expiresIn] - Token expiration duration
 * @returns {string} JWT token
 */
const generateToken = (user, expiresIn) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '12h',
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
    const { username, password, remember = false } = req.body;

    // Validate credentials types before any trim or database lookup
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials format.',
      });
    }

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
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact your admin.',
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

    // Token lifetime: JWT_REMEMBER_EXPIRES_IN only when remember is true AND role is not admin
    const isRemember = Boolean(remember) && user.role !== 'admin';
    const tokenLifetime = isRemember
      ? (process.env.JWT_REMEMBER_EXPIRES_IN || '30d')
      : (process.env.JWT_EXPIRES_IN || '12h');

    // Generate JWT token with resolved lifetime
    const token = generateToken(user, tokenLifetime);

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
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('team', 'name');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is not active. Please contact your admin.',
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

