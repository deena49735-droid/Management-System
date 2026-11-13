const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const PointEntry = require('../models/PointEntry');
const Criteria = require('../models/Criteria');
const User = require('../models/User');

/**
 * Helper to calculate ISO week number from date
 */
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

/**
 * @desc    Submit a member point entry
 * @route   POST /api/entries
 * @access  Private (teamAssistant for own team, member for self with proof, admin)
 */
exports.createEntry = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { member, criteria, quantity, date, note, proofImage } = req.body;

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

    if (criteriaDoc.level !== 'member') {
      return res.status(400).json({
        success: false,
        message: 'Only member-level criteria can be submitted as a member point entry.',
      });
    }

    // Validate Member
    if (!mongoose.Types.ObjectId.isValid(member)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format.',
      });
    }

    const memberDoc = await User.findById(member);
    if (!memberDoc || !memberDoc.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Active member not found.',
      });
    }

    if (!memberDoc.team) {
      return res.status(400).json({
        success: false,
        message: 'Member does not belong to any team. Assign member to a team first.',
      });
    }

    // Role-based submission validation
    const userRole = req.user.role;
    const isSelf = memberDoc._id.toString() === req.user._id.toString();

    if (userRole === 'member') {
      // Members can only submit their own entries
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Members can only submit entries for themselves.',
        });
      }
      // Members can only submit entries for criteria that require proof
      if (!criteriaDoc.needsProof) {
        return res.status(403).json({
          success: false,
          message: 'Members can only submit entries for activities that require proof.',
        });
      }
    } else if (userRole === 'teamAssistant') {
      // Team Assistant can only submit for members of their own team
      if (!req.user.team || req.user.team.toString() !== memberDoc.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team assistants can only submit entries for members of their own team.',
        });
      }
    } else if (userRole === 'teamHead') {
      return res.status(403).json({
        success: false,
        message: 'Team heads cannot submit member entries directly. Data entry is handled by team assistants.',
      });
    }

    // Parse and derive dates
    const entryDate = date ? new Date(date) : new Date();
    if (isNaN(entryDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date provided.',
      });
    }

    const weekNumber = getWeekNumber(entryDate);
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();

    // Check for duplicate entry on the same date with pending or approved status
    const startOfDay = new Date(entryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingEntry = await PointEntry.findOne({
      member: memberDoc._id,
      criteria: criteriaDoc._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'approved'] },
    });

    if (existingEntry) {
      return res.status(409).json({
        success: false,
        message: 'An entry for this member, criteria, and date already exists with pending or approved status.',
      });
    }

    // Calculate points on server (never trust client)
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const calculatedPoints = criteriaDoc.points * qty;

    const entry = await PointEntry.create({
      member: memberDoc._id,
      team: memberDoc.team,
      criteria: criteriaDoc._id,
      quantity: qty,
      points: calculatedPoints,
      date: entryDate,
      weekNumber,
      month,
      year,
      proofImage: proofImage || null,
      note: note ? note.trim() : '',
      status: 'pending',
      enteredBy: req.user._id,
    });

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name phone role');

    res.status(201).json({
      success: true,
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get member point entries (role-scoped)
 * @route   GET /api/entries
 * @access  Private
 */
exports.getEntries = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const filter = {};

    // Role-based scoping
    if (userRole === 'admin') {
      // Admin sees all, can filter by team
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
      // Member sees only their own entries
      filter.member = req.user._id;
    }

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Member filter
    if (req.query.member && mongoose.Types.ObjectId.isValid(req.query.member)) {
      filter.member = req.query.member;
    }

    // Criteria filter
    if (req.query.criteria && mongoose.Types.ObjectId.isValid(req.query.criteria)) {
      filter.criteria = req.query.criteria;
    }

    // Week, month, year filters
    if (req.query.week) {
      filter.weekNumber = parseInt(req.query.week, 10);
    }
    if (req.query.month) {
      filter.month = parseInt(req.query.month, 10);
    }
    if (req.query.year) {
      filter.year = parseInt(req.query.year, 10);
    }

    const entries = await PointEntry.find(filter)
      .populate('member', 'name phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name phone role')
      .populate('approvedBy', 'name phone role')
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: entries,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a member point entry
 * @route   PATCH /api/entries/:id/approve
 * @access  Private (teamHead of same team, or admin)
 */
exports.approveEntry = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
      });
    }

    const entry = await PointEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
      });
    }

    const userRole = req.user.role;

    // Check authorization: admin or teamHead of the same team
    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can approve entries.',
        });
      }

      // Must be teamHead of the SAME team
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads can only approve entries for their own team.',
        });
      }

      // Self-approval is blocked for teamHead
      if (entry.member.toString() === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads cannot approve their own point entries.',
        });
      }

      // If entry is already approved, non-admin cannot modify it
      if (entry.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This entry is already approved.',
        });
      }
    }

    entry.status = 'approved';
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    entry.rejectionReason = null;
    await entry.save();

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name phone role')
      .populate('approvedBy', 'name phone role');

    res.status(200).json({
      success: true,
      message: 'Entry approved successfully.',
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a member point entry
 * @route   PATCH /api/entries/:id/reject
 * @access  Private (teamHead of same team, or admin)
 */
exports.rejectEntry = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
      });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      });
    }

    const entry = await PointEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
      });
    }

    const userRole = req.user.role;

    // Check authorization: admin or teamHead of the same team
    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can reject entries.',
        });
      }

      // Must be teamHead of the SAME team
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads can only reject entries for their own team.',
        });
      }

      // Self-rejection is also blocked for teamHead
      if (entry.member.toString() === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Team heads cannot reject their own point entries.',
        });
      }

      // If entry is already approved, non-admin cannot override it
      if (entry.status === 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Only an admin can override and reject an already approved entry.',
        });
      }
    }

    entry.status = 'rejected';
    entry.rejectionReason = reason.trim();
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    await entry.save();

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name phone role')
      .populate('approvedBy', 'name phone role');

    res.status(200).json({
      success: true,
      message: 'Entry rejected.',
      data: populatedEntry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get point entries summary for logged-in user
 * @route   GET /api/entries/my-summary
 * @access  Private
 */
exports.getMySummary = async (req, res, next) => {
  try {
    const currentWeek = getWeekNumber(new Date());
    const currentYear = new Date().getFullYear();
    const memberId = new mongoose.Types.ObjectId(req.user._id);

    const summary = await PointEntry.aggregate([
      {
        $match: { member: memberId },
      },
      {
        $group: {
          _id: null,
          approvedTotal: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$points', 0],
            },
          },
          weekTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'approved'] },
                    { $eq: ['$weekNumber', currentWeek] },
                    { $eq: ['$year', currentYear] },
                  ],
                },
                '$points',
                0,
              ],
            },
          },
          penaltyTotal: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'approved'] },
                    { $lt: ['$points', 0] },
                  ],
                },
                '$points',
                0,
              ],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
            },
          },
          rejectedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const data = summary[0] || {
      approvedTotal: 0,
      weekTotal: 0,
      penaltyTotal: 0,
      pendingCount: 0,
      rejectedCount: 0,
    };
    delete data._id;

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

