const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Team = require('../models/Team');
const User = require('../models/User');

/**
 * @desc    Get the logged-in user's team
 * @route   GET /api/teams/my
 * @access  Private (any authenticated user belonging to a team)
 */
exports.getMyTeam = async (req, res, next) => {
  try {
    let teamId = req.user.team;
    if (!teamId) {
      const foundTeam = await Team.findOne({
        $or: [{ head: req.user._id }, { assistant: req.user._id }, { members: req.user._id }],
      });
      if (foundTeam) {
        teamId = foundTeam._id;
      }
    }

    if (!teamId) {
      return res.status(404).json({
        success: false,
        message: 'You do not belong to any team.',
      });
    }

    const team = await Team.findById(teamId)
      .populate('head', 'name username phone role')
      .populate('assistant', 'name username phone role')
      .populate('members', 'name username phone role');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get minimal active team options for dropdowns/filters
 * @route   GET /api/teams/options
 * @access  Private (any authenticated user)
 */
exports.getTeamOptions = async (req, res, next) => {
  try {
    const teams = await Team.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new team (admin only)
 * @route   POST /api/teams
 * @access  Private (Admin)
 */
exports.createTeam = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { name, head, assistant, members } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    // Enforce Admin isolation on team creation
    if (head) {
      const headUser = await User.findById(head);
      if (headUser && headUser.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }
    if (assistant) {
      const assistantUser = await User.findById(assistant);
      if (assistantUser && assistantUser.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }
    if (Array.isArray(members) && members.length > 0) {
      const adminCount = await User.countDocuments({ _id: { $in: members }, role: 'admin' });
      if (adminCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }

    // Check if team name already exists (case-insensitive)
    const existingTeam = await Team.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });
    if (existingTeam) {
      return res.status(409).json({
        success: false,
        message: 'A team with this name already exists.',
      });
    }

    const team = await Team.create({
      name: trimmedName,
      head: null,
      assistant: null,
      members: [],
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all teams with populated head, assistant, and member count
 * @route   GET /api/teams
 * @access  Private (Admin)
 */
exports.getTeams = async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      filter.name = { $regex: req.query.search.trim(), $options: 'i' };
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    const teams = await Team.find(filter)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .sort({ name: 1 });

    const formattedTeams = teams.map((team) => {
      const doc = team.toObject();
      return {
        ...doc,
        memberCount: Array.isArray(team.members) ? team.members.length : 0,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedTeams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single team by ID with populated head, assistant and members
 * @route   GET /api/teams/:id
 * @access  Private (Admin)
 */
exports.getTeamById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const team = await Team.findById(req.params.id)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .populate('members', 'name username phone role isActive');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const doc = team.toObject();
    doc.memberCount = Array.isArray(team.members) ? team.members.length : 0;

    res.status(200).json({
      success: true,
      data: doc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update team details (name, isActive)
 * @route   PUT /api/teams/:id
 * @access  Private (Admin)
 */
exports.updateTeam = async (req, res, next) => {
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
        message: 'Team not found.',
      });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (typeof req.body.name === 'string') {
      const trimmedName = req.body.name.trim();
      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: 'Team name cannot be empty.',
        });
      }

      if (trimmedName.toLowerCase() !== team.name.toLowerCase()) {
        const existing = await Team.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
          _id: { $ne: team._id },
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'A team with this name already exists.',
          });
        }
      }
      team.name = trimmedName;
    }

    if (req.body.isActive !== undefined) {
      team.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }

    // Enforce Admin isolation on team update
    if (req.body.head) {
      const headUser = await User.findById(req.body.head);
      if (headUser && headUser.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }
    if (req.body.assistant) {
      const assistantUser = await User.findById(req.body.assistant);
      if (assistantUser && assistantUser.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }
    if (Array.isArray(req.body.members) && req.body.members.length > 0) {
      const adminCount = await User.countDocuments({ _id: { $in: req.body.members }, role: 'admin' });
      if (adminCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Admin accounts cannot be assigned to a team.',
        });
      }
    }

    await team.save();

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign user as team head
 * @route   PATCH /api/teams/:id/head
 * @access  Private (Admin)
 */
exports.assignHead = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid userId is required.',
      });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign an inactive user as team head.',
      });
    }

    // Admin accounts cannot be assigned to any chapter team
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be assigned to a team.',
      });
    }

    // Role eligibility: only chapter users can be assigned as team head
    if (!['member', 'teamHead', 'teamAssistant'].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Only chapter users can be assigned as team head.',
      });
    }

    // A user can belong to only one team at a time
    if (user.team && user.team.toString() !== team._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User already belongs to another team. Remove them from their current team first.',
      });
    }

    // If team already had a head, revert old head back to role member (protecting admin accounts)
    if (team.head && team.head.toString() !== user._id.toString()) {
      const oldHead = await User.findById(team.head);
      if (oldHead && oldHead.role !== 'admin') {
        oldHead.role = 'member';
        await oldHead.save();
      }
    }

    // If this user was the team's assistant, clear assistant slot
    if (team.assistant && team.assistant.toString() === user._id.toString()) {
      team.assistant = null;
    }

    // Set new head's role and team
    user.role = 'teamHead';
    user.team = team._id;
    await user.save();

    // Update team
    team.head = user._id;
    if (!team.members.map((m) => m.toString()).includes(user._id.toString())) {
      team.members.push(user._id);
    }
    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .populate('members', 'name username phone role isActive');

    res.status(200).json({
      success: true,
      message: 'Team head assigned successfully.',
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign user as team assistant
 * @route   PATCH /api/teams/:id/assistant
 * @access  Private (Admin)
 */
exports.assignAssistant = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid userId is required.',
      });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign an inactive user as team assistant.',
      });
    }

    // Admin accounts cannot be assigned to any chapter team
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be assigned to a team.',
      });
    }

    // Role eligibility: only chapter users can be assigned as team assistant
    if (!['member', 'teamHead', 'teamAssistant'].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Only chapter users can be assigned as team assistant.',
      });
    }

    // A user can belong to only one team at a time
    if (user.team && user.team.toString() !== team._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User already belongs to another team. Remove them from their current team first.',
      });
    }

    // If team already had an assistant, revert old assistant back to role member (protecting admin accounts)
    if (team.assistant && team.assistant.toString() !== user._id.toString()) {
      const oldAssistant = await User.findById(team.assistant);
      if (oldAssistant && oldAssistant.role !== 'admin') {
        oldAssistant.role = 'member';
        await oldAssistant.save();
      }
    }

    // If this user was the team's head, clear head slot
    if (team.head && team.head.toString() === user._id.toString()) {
      team.head = null;
    }

    // Set new assistant's role and team
    user.role = 'teamAssistant';
    user.team = team._id;
    await user.save();

    // Update team
    team.assistant = user._id;
    if (!team.members.map((m) => m.toString()).includes(user._id.toString())) {
      team.members.push(user._id);
    }
    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .populate('members', 'name username phone role isActive');

    res.status(200).json({
      success: true,
      message: 'Team assistant assigned successfully.',
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Shared helper to synchronize User.team and Team.members
 */
const syncAddMemberToTeam = async (teamId, userId) => {
  const candidate = await User.findById(userId);
  if (candidate && candidate.role === 'admin') {
    throw new Error('Admin accounts cannot be assigned to a team.');
  }
  await Team.findByIdAndUpdate(teamId, { $addToSet: { members: userId } });
  await User.findByIdAndUpdate(userId, { team: teamId });
};

/**
 * @desc    Create a new member for caller's own team (teamHead / teamAssistant only)
 * @route   POST /api/teams/my/members
 * @access  Private (teamHead, teamAssistant)
 */
exports.createMyTeamMember = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    if (!req.user.team) {
      return res.status(403).json({
        success: false,
        message: 'You do not belong to a team.',
      });
    }

    const team = await Team.findById(req.user.team);
    if (!team) {
      return res.status(403).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (!team.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cannot add members to an inactive team.',
      });
    }

    const { name, username, phone, password } = req.body;
    const trimmedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';

    // Check duplicate username
    const existingUsername = await User.findOne({ username: trimmedUsername });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'A user with this username already exists.',
      });
    }

    // Check duplicate phone
    const existingPhone = await User.findOne({ phone: trimmedPhone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'A user with this phone number already exists.',
      });
    }

    // Create user: role is always "member", team is caller's team, isActive true
    const newUser = await User.create({
      name: typeof name === 'string' ? name.trim() : '',
      username: trimmedUsername,
      phone: trimmedPhone,
      password,
      role: 'member',
      team: team._id,
      isActive: true,
      createdBy: req.user._id,
    });

    // Synchronize Team.members and User.team
    await syncAddMemberToTeam(team._id, newUser._id);

    const populatedUser = await User.findById(newUser._id).populate('team', 'name');

    return res.status(201).json({
      success: true,
      message: 'Member created successfully.',
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
    }
    next(error);
  }
};

/**
 * @desc    Get available unassigned active members
 * @route   GET /api/teams/my/available-members
 * @access  Private (teamHead, teamAssistant)
 */
exports.getAvailableMembers = async (req, res, next) => {
  try {
    if (!req.user.team) {
      return res.status(403).json({
        success: false,
        message: 'You do not belong to a team.',
      });
    }

    const filter = {
      role: 'member',
      isActive: true,
      team: null,
    };

    if (req.query.search && typeof req.query.search === 'string') {
      const term = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (term) {
        filter.$or = [
          { name: { $regex: term, $options: 'i' } },
          { username: { $regex: term, $options: 'i' } },
        ];
      }
    }

    const available = await User.find(filter)
      .select('_id name username')
      .sort({ name: 1 })
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      data: available,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add existing unassigned active member to caller's team
 * @route   POST /api/teams/my/members/add
 * @access  Private (teamHead, teamAssistant)
 */
exports.addExistingMemberToMyTeam = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    if (!req.user.team) {
      return res.status(403).json({
        success: false,
        message: 'You do not belong to a team.',
      });
    }

    const team = await Team.findById(req.user.team);
    if (!team) {
      return res.status(403).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (!team.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Cannot add members to an inactive team.',
      });
    }

    const { userId } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid userId is required.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add an inactive user to a team.',
      });
    }

    // Admin accounts cannot be assigned to any chapter team
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be assigned to a team.',
      });
    }

    // Only active chapter users can be assigned to teams
    if (!['member', 'teamHead', 'teamAssistant'].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Only chapter users can be assigned to a team.',
      });
    }

    if (user.role !== 'member') {
      return res.status(400).json({
        success: false,
        message: 'Only users with the member role can be added to the team.',
      });
    }

    if (user.team || team.members.map((m) => m.toString()).includes(user._id.toString())) {
      return res.status(409).json({
        success: false,
        message: 'This user already belongs to a team.',
      });
    }

    await syncAddMemberToTeam(team._id, user._id);

    return res.status(200).json({
      success: true,
      message: 'Member added to team successfully.',
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        team: team._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member to team
 * @route   POST /api/teams/:id/members
 * @access  Private (Admin)
 */
exports.addMember = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid userId is required.',
      });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add an inactive user to a team.',
      });
    }

    // Admin accounts cannot be assigned to any chapter team
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be assigned to a team.',
      });
    }

    // Only active chapter users can be assigned to teams
    if (!['member', 'teamHead', 'teamAssistant'].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: 'Only chapter users can be assigned to a team.',
      });
    }

    // A user can belong to only one team at a time
    if (user.team && user.team.toString() !== team._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User already belongs to another team. Remove them from their current team first.',
      });
    }

    if (team.members.map((m) => m.toString()).includes(user._id.toString())) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this team.',
      });
    }

    // Synchronize both sides with shared helper
    await syncAddMemberToTeam(team._id, user._id);

    const updatedTeam = await Team.findById(team._id)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .populate('members', 'name username phone role isActive');

    res.status(200).json({
      success: true,
      message: 'Member added to team successfully.',
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove member from team
 * @route   DELETE /api/teams/:id/members/:userId
 * @access  Private (Admin)
 */
exports.removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: 'Team or User not found.',
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const isMember = team.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this team.',
      });
    }

    // If removed member was the head or assistant, clear the position
    if (team.head && team.head.toString() === userId.toString()) {
      team.head = null;
    }
    if (team.assistant && team.assistant.toString() === userId.toString()) {
      team.assistant = null;
    }

    // Remove from team members array
    team.members = team.members.filter((m) => m.toString() !== userId.toString());
    await team.save();

    // Update user record: unassign team and reset head/assistant role to member (protecting admin accounts)
    const user = await User.findById(userId);
    if (user) {
      user.team = null;
      if (user.role !== 'admin' && (user.role === 'teamHead' || user.role === 'teamAssistant')) {
        user.role = 'member';
      }
      await user.save();
    }

    const updatedTeam = await Team.findById(team._id)
      .populate('head', 'name username phone role isActive')
      .populate('assistant', 'name username phone role isActive')
      .populate('members', 'name username phone role isActive');

    res.status(200).json({
      success: true,
      message: 'Member removed from team successfully.',
      data: updatedTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate team (soft delete)
 * @route   DELETE /api/teams/:id
 * @access  Private (Admin)
 */
exports.deactivateTeam = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    team.isActive = false;
    await team.save();

    res.status(200).json({
      success: true,
      message: 'Team deactivated successfully.',
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

