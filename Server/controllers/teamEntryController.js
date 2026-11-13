const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');
const Team = require('../models/Team');

/**
 * @desc    Submit a team point entry (monthly or one-time)
 * @route   POST /api/team-entries
 * @access  Private (teamAssistant of that team only, or admin)
 */
exports.createTeamEntry = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { criteria, month, year, note, proofImage, team } = req.body;
    const userRole = req.user.role;

    // Authorization: teamAssistant of that team only (the head cannot submit)
    if (userRole === 'teamHead') {
      return res.status(403).json({
        success: false,
        message: 'Team heads cannot submit team entries. Data entry is handled by team assistants.',
      });
    }

    if (userRole === 'member') {
      return res.status(403).json({
        success: false,
        message: 'Members cannot submit team entries.',
      });
    }

    // Determine target team
    let targetTeamId;
    if (userRole === 'teamAssistant') {
      if (!req.user.team) {
        return res.status(400).json({
          success: false,
          message: 'You are not assigned to any team.',
        });
      }
      targetTeamId = req.user.team;
    } else if (userRole === 'admin') {
      targetTeamId = team || req.user.team;
      if (!targetTeamId) {
        return res.status(400).json({
          success: false,
          message: 'Team ID is required when admin submits team points.',
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(targetTeamId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID format.',
      });
    }

    // Verify team exists and is active
    const teamDoc = await Team.findById(targetTeamId);
    if (!teamDoc || !teamDoc.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Active team not found.',
      });
    }

    // Validate Criteria
    if (!mongoose.Types.ObjectId.isValid(criteria)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid criteria ID format.',
      });
    }

    const criteriaDoc = await Criteria.findById(criteria);
    if (!criteriaDoc || !criteriaDoc.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Active criteria not found.',
      });
    }

    if (criteriaDoc.level !== 'team') {
      return res.status(400).json({
        success: false,
        message: 'Only team-level criteria can be submitted as a team entry.',
      });
    }

    // Determine month and year
    const currentDate = new Date();
    const entryMonth = month !== undefined ? parseInt(month, 10) : currentDate.getMonth() + 1;
    const entryYear = year !== undefined ? parseInt(year, 10) : currentDate.getFullYear();

    if (isNaN(entryMonth) || entryMonth < 1 || entryMonth > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be an integer between 1 and 12.',
      });
    }

    if (isNaN(entryYear) || entryYear < 2000 || entryYear > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Year must be a valid 4-digit year.',
      });
    }

    // Uniqueness rule:
    // For one_time criteria: one per team + criteria ever (unless previous was rejected)
    // For monthly criteria: one per team + criteria + month + year (unless previous was rejected)
    const isOneTime = criteriaDoc.category === 'one_time' || criteriaDoc.frequency === 'one_time';

    const duplicateQuery = {
      team: teamDoc._id,
      criteria: criteriaDoc._id,
      status: { $in: ['pending', 'approved'] },
    };

    if (!isOneTime) {
      duplicateQuery.month = entryMonth;
      duplicateQuery.year = entryYear;
    }

    const existingEntry = await TeamPointEntry.findOne(duplicateQuery);
    if (existingEntry) {
      const msg = isOneTime
        ? 'A one-time bonus entry for this team and criteria already exists with pending or approved status.'
        : `An entry for this team and criteria for ${entryMonth}/${entryYear} already exists with pending or approved status.`;
      return res.status(409).json({
        success: false,
        message: msg,
      });
    }

    // Points are always copied from criteria doc
    const newEntry = await TeamPointEntry.create({
      team: teamDoc._id,
      criteria: criteriaDoc._id,
      points: criteriaDoc.points,
      month: entryMonth,
      year: entryYear,
      proofImage: proofImage || null,
      note: note ? note.trim() : '',
      status: 'pending',
      submittedBy: req.user._id,
    });

    const populatedEntry = await TeamPointEntry.findById(newEntry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name phone role');

    res.status(201).json({
      success: true,
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get team point entries (role-scoped)
 * @route   GET /api/team-entries
 * @access  Private (admin: all, teamHead & teamAssistant: their own team)
 */
exports.getTeamEntries = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const filter = {};

    if (userRole === 'admin') {
      // Admin sees all, optional filter by team
      if (req.query.team && mongoose.Types.ObjectId.isValid(req.query.team)) {
        filter.team = req.query.team;
      }
    } else if (userRole === 'teamHead' || userRole === 'teamAssistant') {
      // Head and assistant only see their own team's entries
      if (!req.user.team) {
        return res.status(200).json({ success: true, data: [] });
      }
      filter.team = req.user.team;
    } else {
      // Members do not have access to team-entry approval list
      return res.status(403).json({
        success: false,
        message: 'Access denied. Team entries are only accessible to team heads, assistants, and admins.',
      });
    }

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Filter by criteria
    if (req.query.criteria && mongoose.Types.ObjectId.isValid(req.query.criteria)) {
      filter.criteria = req.query.criteria;
    }

    // Filter by month & year
    if (req.query.month) {
      filter.month = parseInt(req.query.month, 10);
    }
    if (req.query.year) {
      filter.year = parseInt(req.query.year, 10);
    }

    const entries = await TeamPointEntry.find(filter)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name phone role')
      .populate('approvedBy', 'name phone role')
      .sort({ year: -1, month: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: entries,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a team point entry
 * @route   PATCH /api/team-entries/:id/approve
 * @access  Private (teamHead of the same team, or admin)
 */
exports.approveTeamEntry = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const entry = await TeamPointEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const userRole = req.user.role;

    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can approve team entries.',
        });
      }

      // Team head must belong to the same team
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads can only approve entries for their own team.',
        });
      }

      // Non-admin cannot modify already approved entry
      if (entry.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This team entry is already approved.',
        });
      }
    }

    entry.status = 'approved';
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    entry.rejectionReason = null;
    await entry.save();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name phone role')
      .populate('approvedBy', 'name phone role');

    res.status(200).json({
      success: true,
      message: 'Team entry approved successfully.',
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a team point entry
 * @route   PATCH /api/team-entries/:id/reject
 * @access  Private (teamHead of the same team, or admin)
 */
exports.rejectTeamEntry = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      });
    }

    const entry = await TeamPointEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const userRole = req.user.role;

    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can reject team entries.',
        });
      }

      // Team head must belong to the same team
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads can only reject entries for their own team.',
        });
      }

      // Non-admin cannot override already approved entry
      if (entry.status === 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Only an admin can override and reject an already approved team entry.',
        });
      }
    }

    entry.status = 'rejected';
    entry.rejectionReason = reason.trim();
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    await entry.save();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name phone role')
      .populate('approvedBy', 'name phone role');

    res.status(200).json({
      success: true,
      message: 'Team entry rejected.',
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

