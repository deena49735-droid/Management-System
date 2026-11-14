const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Team = require('../models/Team');

/**
 * @desc    Create a new user (admin only)
 * @route   POST /api/users
 * @access  Private (Admin)
 */
exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { name, username, phone, password, role, team } = req.body;
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const trimmedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';

    // Check if username is already registered
    const existingUsername = await User.findOne({ username: trimmedUsername });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'A user with this username already exists.',
      });
    }

    // Check if phone number is already registered
    const existingUser = await User.findOne({ phone: trimmedPhone });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this phone number already exists.',
      });
    }

    let teamDoc = null;
    if (team) {
      if (!mongoose.Types.ObjectId.isValid(team)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid team ID format.',
        });
      }
      teamDoc = await Team.findById(team);
      if (!teamDoc) {
        return res.status(404).json({
          success: false,
          message: 'Team not found.',
        });
      }
      if (!teamDoc.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign a user to an inactive team.',
        });
      }
    }

    // Create the user
    const userRole = role || 'member';
    const user = await User.create({
      name: typeof name === 'string' ? name.trim() : '',
      username: trimmedUsername,
      phone: trimmedPhone,
      password,
      role: userRole,
      team: teamDoc ? teamDoc._id : null,
      isActive: true,
    });

    // Synchronize team associations if a team was specified
    if (teamDoc) {
      if (userRole === 'teamHead') {
        if (teamDoc.head && teamDoc.head.toString() !== user._id.toString()) {
          await User.findByIdAndUpdate(teamDoc.head, { role: 'member' });
        }
        teamDoc.head = user._id;
      } else if (userRole === 'teamAssistant') {
        if (teamDoc.assistant && teamDoc.assistant.toString() !== user._id.toString()) {
          await User.findByIdAndUpdate(teamDoc.assistant, { role: 'member' });
        }
        teamDoc.assistant = user._id;
      }

      if (!teamDoc.members.map((m) => m.toString()).includes(user._id.toString())) {
        teamDoc.members.push(user._id);
      }
      await teamDoc.save();
    }

    const populatedUser = await User.findById(user._id).populate('team', 'name');

    res.status(201).json({
      success: true,
      data: populatedUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
      if (field === 'username') {
        return res.status(409).json({
          success: false,
          message: 'A user with this username already exists.',
        });
      }
      if (field === 'phone') {
        return res.status(409).json({
          success: false,
          message: 'A user with this phone number already exists.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'A user with this detail already exists.',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get all users with search, filtering and pagination
 * @route   GET /api/users
 * @access  Private (Admin)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const filter = {};

    // Search by name, username or phone
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by role
    if (req.query.role) {
      filter.role = req.query.role;
    }

    // Filter by team
    if (req.query.team) {
      if (req.query.team === 'none' || req.query.team === 'null') {
        filter.team = null;
      } else if (mongoose.Types.ObjectId.isValid(req.query.team)) {
        filter.team = req.query.team;
      }
    }

    // Filter by isActive status
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .populate('team', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private (Admin)
 */
exports.getUserById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = await User.findById(req.params.id).populate('team', 'name');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user details (name, phone, role, team, isActive)
 * @route   PUT /api/users/:id
 * @access  Private (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const isSelf = user._id.toString() === req.user._id.toString();

    // Prevent admin from deactivating their own account
    if (isSelf && req.body.isActive !== undefined) {
      const targetIsActive = req.body.isActive === true || req.body.isActive === 'true';
      if (!targetIsActive) {
        return res.status(400).json({
          success: false,
          message: 'Admins cannot deactivate their own account.',
        });
      }
    }

    // Prevent admin from changing their own role
    if (isSelf && req.body.role && req.body.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admins cannot change their own role.',
      });
    }

    // Update username if provided and check uniqueness
    if (typeof req.body.username === 'string') {
      const trimmedUsername = req.body.username.trim().toLowerCase();
      if (!/^[a-z0-9._]{3,30}$/.test(trimmedUsername)) {
        return res.status(400).json({
          success: false,
          message:
            'Username must be between 3 and 30 characters and contain only lowercase letters, numbers, dot, and underscore.',
        });
      }

      if (trimmedUsername !== user.username) {
        const usernameExists = await User.findOne({
          username: trimmedUsername,
          _id: { $ne: user._id },
        });
        if (usernameExists) {
          return res.status(409).json({
            success: false,
            message: 'A user with this username already exists.',
          });
        }
        user.username = trimmedUsername;
      }
    }

    // Update phone if provided and check uniqueness
    if (typeof req.body.phone === 'string') {
      const trimmedPhone = req.body.phone.trim();
      if (!/^[0-9]{10}$/.test(trimmedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Phone must be a valid 10-digit number.',
        });
      }

      if (trimmedPhone !== user.phone) {
        const phoneExists = await User.findOne({
          phone: trimmedPhone,
          _id: { $ne: user._id },
        });
        if (phoneExists) {
          return res.status(409).json({
            success: false,
            message: 'A user with this phone number already exists.',
          });
        }
        user.phone = trimmedPhone;
      }
    }

    // Update name
    if (typeof req.body.name === 'string') {
      user.name = req.body.name.trim();
    }

    // Update isActive
    if (req.body.isActive !== undefined) {
      user.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }

    const oldRole = user.role;
    const oldTeamId = user.team ? user.team.toString() : null;

    if (req.body.role) {
      user.role = req.body.role;
    }

    // Handle team reassignment
    if (req.body.team !== undefined) {
      const newTeamId = req.body.team ? req.body.team.toString() : null;

      if (newTeamId) {
        if (!mongoose.Types.ObjectId.isValid(newTeamId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid team ID format.',
          });
        }

        const newTeam = await Team.findById(newTeamId);
        if (!newTeam) {
          return res.status(404).json({
            success: false,
            message: 'Target team not found.',
          });
        }
      }

      // If removing or changing team, cleanup old team relations
      if (oldTeamId && oldTeamId !== newTeamId) {
        const oldTeam = await Team.findById(oldTeamId);
        if (oldTeam) {
          if (oldTeam.head && oldTeam.head.toString() === user._id.toString()) {
            oldTeam.head = null;
          }
          if (oldTeam.assistant && oldTeam.assistant.toString() === user._id.toString()) {
            oldTeam.assistant = null;
          }
          oldTeam.members = oldTeam.members.filter(
            (m) => m.toString() !== user._id.toString()
          );
          await oldTeam.save();
        }
      }

      // Add to new team
      if (newTeamId) {
        const targetTeam = await Team.findById(newTeamId);
        if (!targetTeam.members.map((m) => m.toString()).includes(user._id.toString())) {
          targetTeam.members.push(user._id);
        }

        if (user.role === 'teamHead') {
          if (targetTeam.head && targetTeam.head.toString() !== user._id.toString()) {
            await User.findByIdAndUpdate(targetTeam.head, { role: 'member' });
          }
          targetTeam.head = user._id;
        } else if (user.role === 'teamAssistant') {
          if (targetTeam.assistant && targetTeam.assistant.toString() !== user._id.toString()) {
            await User.findByIdAndUpdate(targetTeam.assistant, { role: 'member' });
          }
          targetTeam.assistant = user._id;
        }

        await targetTeam.save();
        user.team = targetTeam._id;
      } else {
        user.team = null;
      }
    } else if (req.body.role && user.team) {
      // Role changed while remaining in the same team
      const currentTeam = await Team.findById(user.team);
      if (currentTeam) {
        if (user.role === 'teamHead') {
          if (currentTeam.head && currentTeam.head.toString() !== user._id.toString()) {
            await User.findByIdAndUpdate(currentTeam.head, { role: 'member' });
          }
          currentTeam.head = user._id;
          if (currentTeam.assistant && currentTeam.assistant.toString() === user._id.toString()) {
            currentTeam.assistant = null;
          }
        } else if (user.role === 'teamAssistant') {
          if (currentTeam.assistant && currentTeam.assistant.toString() !== user._id.toString()) {
            await User.findByIdAndUpdate(currentTeam.assistant, { role: 'member' });
          }
          currentTeam.assistant = user._id;
          if (currentTeam.head && currentTeam.head.toString() === user._id.toString()) {
            currentTeam.head = null;
          }
        } else {
          // Changed to member or admin
          if (currentTeam.head && currentTeam.head.toString() === user._id.toString()) {
            currentTeam.head = null;
          }
          if (currentTeam.assistant && currentTeam.assistant.toString() === user._id.toString()) {
            currentTeam.assistant = null;
          }
        }
        await currentTeam.save();
      }
    }

    await user.save();

    const updatedUser = await User.findById(user._id).populate('team', 'name');

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
      if (field === 'username') {
        return res.status(409).json({
          success: false,
          message: 'A user with this username already exists.',
        });
      }
      if (field === 'phone') {
        return res.status(409).json({
          success: false,
          message: 'A user with this phone number already exists.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'A user with this detail already exists.',
      });
    }
    next(error);
  }
};

/**
 * @desc    Reset user password (admin only)
 * @route   PATCH /api/users/:id/reset-password
 * @access  Private (Admin)
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.password = password;
    await user.save(); // Pre-save hook hashes password with bcrypt

    res.status(200).json({
      success: true,
      message: 'Password reset successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate user (soft delete)
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
exports.deactivateUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Admins cannot deactivate their own account.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

