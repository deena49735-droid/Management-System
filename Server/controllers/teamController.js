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
        $or: [{ lead: req.user._id }, { assistant: req.user._id }, { members: req.user._id }],
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
      .populate('lead', 'name phone role')
      .populate('assistant', 'name phone role')
      .populate('members', 'name phone role');

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

    const { name } = req.body;
    const trimmedName = name.trim();

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
      lead: null,
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
 * @desc    Get all teams with populated lead, assistant, and member count
 * @route   GET /api/teams
 * @access  Private (Admin)
 */
exports.getTeams = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.search) {
      filter.name = { $regex: req.query.search.trim(), $options: 'i' };
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    const teams = await Team.find(filter)
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
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
 * @desc    Get single team by ID with populated lead, assistant and members
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
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
      .populate('members', 'name phone role isActive');

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

    if (req.body.name) {
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
 * @desc    Assign user as team lead
 * @route   PATCH /api/teams/:id/lead
 * @access  Private (Admin)
 */
exports.assignLead = async (req, res, next) => {
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
        message: 'Cannot assign an inactive user as team lead.',
      });
    }

    // A user can belong to only one team at a time
    if (user.team && user.team.toString() !== team._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User already belongs to another team. Remove them from their current team first.',
      });
    }

    // If team already had a lead, revert old lead back to role member
    if (team.lead && team.lead.toString() !== user._id.toString()) {
      await User.findByIdAndUpdate(team.lead, { role: 'member' });
    }

    // If this user was the team's assistant, clear assistant slot
    if (team.assistant && team.assistant.toString() === user._id.toString()) {
      team.assistant = null;
    }

    // Set new lead's role and team
    user.role = 'teamLead';
    user.team = team._id;
    await user.save();

    // Update team
    team.lead = user._id;
    if (!team.members.map((m) => m.toString()).includes(user._id.toString())) {
      team.members.push(user._id);
    }
    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
      .populate('members', 'name phone role isActive');

    res.status(200).json({
      success: true,
      message: 'Team lead assigned successfully.',
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

    // A user can belong to only one team at a time
    if (user.team && user.team.toString() !== team._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User already belongs to another team. Remove them from their current team first.',
      });
    }

    // If team already had an assistant, revert old assistant back to role member
    if (team.assistant && team.assistant.toString() !== user._id.toString()) {
      await User.findByIdAndUpdate(team.assistant, { role: 'member' });
    }

    // If this user was the team's lead, clear lead slot
    if (team.lead && team.lead.toString() === user._id.toString()) {
      team.lead = null;
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
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
      .populate('members', 'name phone role isActive');

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

    // Synchronize both sides
    team.members.push(user._id);
    await team.save();

    user.team = team._id;
    await user.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
      .populate('members', 'name phone role isActive');

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

    // If removed member was the lead or assistant, clear the position
    if (team.lead && team.lead.toString() === userId.toString()) {
      team.lead = null;
    }
    if (team.assistant && team.assistant.toString() === userId.toString()) {
      team.assistant = null;
    }

    // Remove from team members array
    team.members = team.members.filter((m) => m.toString() !== userId.toString());
    await team.save();

    // Update user record: unassign team and reset lead/assistant role to member
    const user = await User.findById(userId);
    if (user) {
      user.team = null;
      if (user.role === 'teamLead' || user.role === 'teamAssistant') {
        user.role = 'member';
      }
      await user.save();
    }

    const updatedTeam = await Team.findById(team._id)
      .populate('lead', 'name phone role isActive')
      .populate('assistant', 'name phone role isActive')
      .populate('members', 'name phone role isActive');

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

