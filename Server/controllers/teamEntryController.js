const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const TeamPointEntry = require('../models/TeamPointEntry');
const PointEntry = require('../models/PointEntry');
const User = require('../models/User');
const Criteria = require('../models/Criteria');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');

/**
 * Helper to validate that a proof image URL originates from Cloudinary in the proofs folder
 */
const validateProofUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const expectedPrefix = cloudName
    ? `https://res.cloudinary.com/${cloudName}/`
    : 'https://res.cloudinary.com/';
  return url.startsWith(expectedPrefix) && url.includes('/kadambas/proofs/');
};

/**
 * @desc    Submit a team point entry (monthly or one-time)
 * @route   POST /api/team-entries
 * @access  Private (teamAssistant of that team only, or admin)
 */
exports.createTeamEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { criteria, month, year, note, proofImage, proofPublicId, team } = req.body;
    const userRole = req.user.role;

    if (!['admin', 'teamHead', 'teamAssistant'].includes(userRole)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Members cannot submit team entries.',
      });
    }

    // Determine and enforce target team
    let targetTeamId;
    if (userRole === 'teamHead') {
      if (!req.user.team) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'You are not assigned to any team.',
        });
      }
      if (team && team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Team heads can only submit team entries for their own team.',
        });
      }
      targetTeamId = req.user.team;
    } else if (userRole === 'teamAssistant') {
      if (!req.user.team) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'You are not assigned to any team.',
        });
      }
      if (team && team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Team assistants can only submit team entries for their own team.',
        });
      }
      targetTeamId = req.user.team;
    } else if (userRole === 'admin') {
      targetTeamId = team || req.user.team;
      if (!targetTeamId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Team ID is required when admin submits team points.',
        });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(targetTeamId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid team ID format.',
      });
    }

    const teamDoc = await Team.findById(targetTeamId).session(session);
    if (!teamDoc || !teamDoc.isActive) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Active team not found.',
      });
    }

    // Validate Criteria
    if (!mongoose.Types.ObjectId.isValid(criteria)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid criteria ID format.',
      });
    }

    const criteriaDoc = await Criteria.findById(criteria).session(session);
    if (!criteriaDoc || !criteriaDoc.isActive) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Active criteria not found.',
      });
    }

    if (criteriaDoc.level !== 'team') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only team-level criteria can be submitted as a team entry.',
      });
    }

    // Validate proof image URL if provided (proof is optional)
    if (proofImage && !validateProofUrl(proofImage)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid proof image URL. Proof must be uploaded to the official Cloudinary proofs storage.',
      });
    }

    // Standardized frequency: 'monthly' or 'one_time'
    const frequency = criteriaDoc.frequency === 'one_time' || criteriaDoc.category === 'one_time' ? 'one_time' : 'monthly';

    // Team Head is authorized specifically for monthly team points
    if (userRole === 'teamHead' && frequency !== 'monthly') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Team heads can only submit monthly team points. One-time bonus achievements are submitted by team assistants or awarded by administrators.',
      });
    }

    const currentDate = new Date();
    const entryMonth = month !== undefined ? parseInt(month, 10) : currentDate.getMonth() + 1;
    const entryYear = year !== undefined ? parseInt(year, 10) : currentDate.getFullYear();

    if (isNaN(entryMonth) || entryMonth < 1 || entryMonth > 12) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Month must be an integer between 1 and 12.',
      });
    }

    if (isNaN(entryYear) || entryYear < 2000 || entryYear > 2100) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Year must be a valid 4-digit year.',
      });
    }

    // Pre-check for duplicate active entries
    const duplicateQuery = {
      team: teamDoc._id,
      criteria: criteriaDoc._id,
      status: { $in: ['pending', 'approved'] },
      isReversal: false,
      isAdminAdjustment: false,
    };

    if (frequency === 'monthly') {
      duplicateQuery.month = entryMonth;
      duplicateQuery.year = entryYear;
    }

    const existingEntry = await TeamPointEntry.findOne(duplicateQuery).session(session);
    if (existingEntry) {
      await session.abortTransaction();
      const msg =
        frequency === 'one_time'
          ? 'This one-time bonus criterion has already been awarded or submitted for this team.'
          : `A pending or approved team entry for this monthly criterion already exists for ${entryMonth}/${entryYear}.`;
      return res.status(409).json({
        success: false,
        message: msg,
      });
    }

    // Auto-approval logic: Admin and Team Head submissions are automatically approved
    const isAutoApproved = userRole === 'admin' || userRole === 'teamHead';
    const entryStatus = isAutoApproved ? 'approved' : 'pending';
    const approvedBy = isAutoApproved ? req.user._id : null;
    const approvedAt = isAutoApproved ? new Date() : null;

    const [newEntry] = await TeamPointEntry.create(
      [
        {
          team: teamDoc._id,
          criteria: criteriaDoc._id,
          points: criteriaDoc.points,
          month: entryMonth,
          year: entryYear,
          frequency,
          proofImage: proofImage || null,
          proofPublicId: proofPublicId || null,
          note: typeof note === 'string' && note.trim() ? note.trim() : '',
          status: entryStatus,
          submittedBy: req.user._id,
          approvedBy,
          approvedAt,
          isAdminAdjustment: false,
          isReversal: false,
          reversalOf: null,
        },
      ],
      { session }
    );

    const auditLogsToCreate = [
      {
        action: 'ENTRY_CREATE',
        targetType: 'TeamPointEntry',
        targetId: newEntry._id,
        performedBy: req.user._id,
        previousStatus: null,
        newStatus: entryStatus,
        points: criteriaDoc.points,
        reason: typeof note === 'string' && note.trim() ? note.trim() : '',
        metadata: {
          criteriaKey: criteriaDoc.key,
          frequency,
          autoApproved: isAutoApproved,
          ...(isAutoApproved ? { approvedAt } : {}),
        },
      },
    ];

    if (isAutoApproved) {
      auditLogsToCreate.push({
        action: 'ENTRY_APPROVE',
        targetType: 'TeamPointEntry',
        targetId: newEntry._id,
        performedBy: req.user._id,
        previousStatus: 'pending',
        newStatus: 'approved',
        points: criteriaDoc.points,
        reason: 'Auto-approved upon submission by leadership.',
        metadata: { approvedAt },
      });
    }

    await AuditLog.create(auditLogsToCreate, { session, ordered: true });

    await session.commitTransaction();

    const populatedEntry = await TeamPointEntry.findById(newEntry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(201).json({
      success: true,
      data: populatedEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get team point entries (role-scoped with pagination)
 * @route   GET /api/team-entries
 * @access  Private (admin: all, teamHead & teamAssistant: their own team)
 */
exports.getTeamEntries = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const filter = {};

    if (userRole === 'admin') {
      if (req.query.team && mongoose.Types.ObjectId.isValid(req.query.team)) {
        filter.team = req.query.team;
      }
    } else if (userRole === 'teamHead' || userRole === 'teamAssistant') {
      if (!req.user.team) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        });
      }
      filter.team = req.user.team;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Team entries are only accessible to team heads, assistants, and admins.',
      });
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.criteria && mongoose.Types.ObjectId.isValid(req.query.criteria)) {
      filter.criteria = req.query.criteria;
    }
    if (req.query.month) {
      filter.month = parseInt(req.query.month, 10);
    }
    if (req.query.year) {
      filter.year = parseInt(req.query.year, 10);
    }
    if (req.query.submittedBy && mongoose.Types.ObjectId.isValid(req.query.submittedBy)) {
      filter.submittedBy = req.query.submittedBy;
    }

    // Search query support (searches criteria name/key, team name, submitter name, and note)
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escaped = escapeRegex(search);
      const regex = new RegExp(escaped, 'i');

      const matchingCriteria = await Criteria.find({
        $or: [{ name: regex }, { key: regex }, { category: regex }],
      }).select('_id').lean();
      const criteriaIds = matchingCriteria.map((c) => c._id);

      let teamIds = [];
      if (userRole === 'admin') {
        const matchingTeams = await Team.find({ name: regex }).select('_id').lean();
        teamIds = matchingTeams.map((t) => t._id);
      }

      const matchingSubmitters = await User.find({
        $or: [{ name: regex }, { username: regex }, { phone: regex }],
      }).select('_id').lean();
      const submitterIds = matchingSubmitters.map((u) => u._id);

      const searchOr = [{ note: regex }];
      if (criteriaIds.length > 0) {
        searchOr.push({ criteria: { $in: criteriaIds } });
      }
      if (teamIds.length > 0) {
        searchOr.push({ team: { $in: teamIds } });
      }
      if (submitterIds.length > 0) {
        searchOr.push({ submittedBy: { $in: submitterIds } });
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: searchOr });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit !== undefined
      ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
      : (req.query.status === 'pending' ? 100 : 20);
    const skip = (page - 1) * limit;

    const total = await TeamPointEntry.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const entries = await TeamPointEntry.find(filter)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .populate('reversedBy', 'name username phone role')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const entry = await TeamPointEntry.findById(req.params.id).session(session);
    if (!entry) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    if (entry.isReversal) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Reversal transactions cannot be approved or modified.',
      });
    }

    const userRole = req.user.role;

    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can approve team entries.',
        });
      }

      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Team heads can only approve entries for their own team.',
        });
      }

      // STRICT SELF-APPROVAL CHECK:
      // The user who submitted the entry cannot approve it.
      if (entry.submittedBy.toString() === req.user._id.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Self-approval is strictly prohibited. An admin must approve this entry.',
        });
      }

      if (entry.status === 'approved') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'This team entry is already approved.',
        });
      }
    }

    const previousStatus = entry.status;
    entry.status = 'approved';
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    entry.rejectionReason = null;
    await entry.save({ session });

    await AuditLog.create(
      [
        {
          action: 'ENTRY_APPROVE',
          targetType: 'TeamPointEntry',
          targetId: entry._id,
          performedBy: req.user._id,
          previousStatus,
          newStatus: 'approved',
          points: entry.points,
          reason: '',
          metadata: { approvedAt: entry.approvedAt },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(200).json({
      success: true,
      message: 'Team entry approved successfully.',
      data: populatedEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Reject a team point entry
 * @route   PATCH /api/team-entries/:id/reject
 * @access  Private (teamHead of the same team, or admin)
 */
exports.rejectTeamEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'A rejection reason is required.',
      });
    }

    const entry = await TeamPointEntry.findById(req.params.id).session(session);
    if (!entry) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Team point entry not found.',
      });
    }

    if (entry.isReversal) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Reversal transactions cannot be rejected.',
      });
    }

    const userRole = req.user.role;

    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only team heads or admins can reject team entries.',
        });
      }

      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Team heads can only reject entries for their own team.',
        });
      }

      if (entry.status === 'approved') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only an admin can override and reject an already approved team entry.',
        });
      }
    }

    const previousStatus = entry.status;
    entry.status = 'rejected';
    entry.rejectionReason = reason.trim();
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    await entry.save({ session });

    await AuditLog.create(
      [
        {
          action: 'ENTRY_REJECT',
          targetType: 'TeamPointEntry',
          targetId: entry._id,
          performedBy: req.user._id,
          previousStatus,
          newStatus: 'rejected',
          points: entry.points,
          reason: reason.trim(),
          metadata: { rejectedAt: entry.approvedAt },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(200).json({
      success: true,
      message: 'Team entry rejected.',
      data: populatedEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Admin Direct Team Point Award (Official Criteria-based, immediately approved)
 * @route   POST /api/team-entries/admin/award
 * @access  Private (admin only)
 */
exports.adminDirectTeamAward = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { team, criteria, month, year, note, proofImage, proofPublicId } = req.body;

    if (proofImage && !validateProofUrl(proofImage)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid proof image URL. Proof must be uploaded to the official Cloudinary proofs storage.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(team)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid team ID format is required.' });
    }

    const teamDoc = await Team.findById(team).session(session);
    if (!teamDoc || !teamDoc.isActive) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active team not found.' });
    }

    if (!mongoose.Types.ObjectId.isValid(criteria)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid criteria ID format is required.' });
    }

    const criteriaDoc = await Criteria.findById(criteria).session(session);
    if (!criteriaDoc || !criteriaDoc.isActive || criteriaDoc.level !== 'team') {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active team-level criteria not found.' });
    }

    const frequency = criteriaDoc.frequency === 'one_time' || criteriaDoc.category === 'one_time' ? 'one_time' : 'monthly';

    const currentDate = new Date();
    const entryMonth = month !== undefined ? parseInt(month, 10) : currentDate.getMonth() + 1;
    const entryYear = year !== undefined ? parseInt(year, 10) : currentDate.getFullYear();

    // Check duplicate
    const duplicateQuery = {
      team: teamDoc._id,
      criteria: criteriaDoc._id,
      status: { $in: ['pending', 'approved'] },
      isReversal: false,
      isAdminAdjustment: false,
    };

    if (frequency === 'monthly') {
      duplicateQuery.month = entryMonth;
      duplicateQuery.year = entryYear;
    }

    const existingEntry = await TeamPointEntry.findOne(duplicateQuery).session(session);
    if (existingEntry) {
      await session.abortTransaction();
      const msg =
        frequency === 'one_time'
          ? 'This one-time bonus criterion has already been awarded or submitted for this team.'
          : `A pending or approved team entry for this monthly criterion already exists for ${entryMonth}/${entryYear}.`;
      return res.status(409).json({
        success: false,
        message: msg,
      });
    }

    const [entry] = await TeamPointEntry.create(
      [
        {
          team: teamDoc._id,
          criteria: criteriaDoc._id,
          points: criteriaDoc.points,
          month: entryMonth,
          year: entryYear,
          frequency,
          proofImage: proofImage || null,
          proofPublicId: proofPublicId || null,
          note: typeof note === 'string' && note.trim() ? note.trim() : 'Admin Direct Team Award',
          status: 'approved',
          submittedBy: req.user._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
          isAdminAdjustment: false,
          isReversal: false,
          reversalOf: null,
        },
      ],
      { session }
    );

    await AuditLog.create(
      [
        {
          action: 'ADMIN_AWARD',
          targetType: 'TeamPointEntry',
          targetId: entry._id,
          performedBy: req.user._id,
          previousStatus: null,
          newStatus: 'approved',
          points: criteriaDoc.points,
          reason: typeof note === 'string' && note.trim() ? note.trim() : 'Admin Direct Team Award',
          metadata: {
            criteriaKey: criteriaDoc.key,
            frequency,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(201).json({
      success: true,
      message: 'Admin team point award created and approved successfully.',
      data: populatedEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Admin Exceptional Manual Team Adjustment (Signed points, mandatory reason, immediately approved)
 * @route   POST /api/team-entries/admin/adjust
 * @access  Private (admin only)
 */
exports.adminManualTeamAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { team, points, reason, month, year, note } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'A mandatory reason is required for manual adjustments.' });
    }

    const numPoints = parseInt(points, 10);
    if (isNaN(numPoints) || numPoints === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Points must be a non-zero signed integer.' });
    }

    if (!mongoose.Types.ObjectId.isValid(team)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid team ID format is required.' });
    }

    const teamDoc = await Team.findById(team).session(session);
    if (!teamDoc || !teamDoc.isActive) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active team not found.' });
    }

    const currentDate = new Date();
    const entryMonth = month !== undefined ? parseInt(month, 10) : currentDate.getMonth() + 1;
    const entryYear = year !== undefined ? parseInt(year, 10) : currentDate.getFullYear();

    const [entry] = await TeamPointEntry.create(
      [
        {
          team: teamDoc._id,
          criteria: null,
          points: numPoints,
          month: entryMonth,
          year: entryYear,
          frequency: 'monthly',
          proofImage: null,
          note: typeof note === 'string' && note.trim() ? note.trim() : (typeof reason === 'string' ? reason.trim() : ''),
          status: 'approved',
          submittedBy: req.user._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
          isAdminAdjustment: true,
          isReversal: false,
          reversalOf: null,
        },
      ],
      { session }
    );

    await AuditLog.create(
      [
        {
          action: 'ADMIN_ADJUSTMENT',
          targetType: 'TeamPointEntry',
          targetId: entry._id,
          performedBy: req.user._id,
          previousStatus: null,
          newStatus: 'approved',
          points: numPoints,
          reason: reason.trim(),
          metadata: {
            isManualAdjustment: true,
            note: note || '',
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await TeamPointEntry.findById(entry._id)
      .populate('team', 'name')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(201).json({
      success: true,
      message: 'Admin manual team adjustment applied successfully.',
      data: populatedEntry,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Reverse an approved team point entry
 * @route   POST /api/team-entries/:id/reverse
 * @access  Private (admin only)
 */
exports.reverseTeamEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Team point entry not found.' });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'A reason is required to reverse an entry.' });
    }

    const original = await TeamPointEntry.findById(id).session(session);
    if (!original) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Team point entry not found.' });
    }

    if (original.status !== 'approved') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only approved team entries can be reversed.',
      });
    }

    if (original.isReversal || original.reversalOf) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot reverse a reversal transaction.',
      });
    }

    const existingReversal = await TeamPointEntry.findOne({ reversalOf: original._id }).session(session);
    if (existingReversal) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'This transaction has already been reversed.',
      });
    }

    const reversalPoints = -original.points;

    const [reversalEntry] = await TeamPointEntry.create(
      [
        {
          team: original.team,
          criteria: original.criteria,
          points: reversalPoints,
          month: original.month,
          year: original.year,
          frequency: original.frequency,
          proofImage: original.proofImage,
          proofPublicId: original.proofPublicId,
          note: `Reversal of team entry ${original._id}: ${reason.trim()}`,
          status: 'approved',
          submittedBy: req.user._id,
          approvedBy: req.user._id,
          approvedAt: new Date(),
          isAdminAdjustment: false,
          isReversal: true,
          reversalOf: original._id,
          reversalReason: reason.trim(),
          reversedBy: req.user._id,
          reversedAt: new Date(),
        },
      ],
      { session }
    );

    await AuditLog.create(
      [
        {
          action: 'ENTRY_REVERSAL',
          targetType: 'TeamPointEntry',
          targetId: original._id,
          performedBy: req.user._id,
          previousStatus: 'approved',
          newStatus: 'approved',
          points: reversalPoints,
          reason: reason.trim(),
          metadata: {
            reversalEntryId: reversalEntry._id,
            originalPoints: original.points,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedReversal = await TeamPointEntry.findById(reversalEntry._id)
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('submittedBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .populate('reversalOf');

    res.status(200).json({
      success: true,
      message: 'Team entry reversed successfully.',
      data: populatedReversal,
    });
  } catch (error) {
    await session.abortTransaction();
    if (
      error.code === 11000 ||
      error.code === 112 ||
      (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) ||
      (error.message && (error.message.includes('WriteConflict') || error.message.includes('duplicate key') || error.message.includes('reversalOf') || error.message.includes('uniq_teampoint_reversal')))
    ) {
      return res.status(409).json({
        success: false,
        message: 'This transaction has already been reversed.',
      });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Get team scorecard with monthly points and one-time bonus status
 * @route   GET /api/team-scorecard
 * @access  Private (teamHead and teamAssistant for own team, admin with teamId or own team)
 */
exports.getTeamScorecard = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    let targetTeamId;

    if (userRole === 'admin') {
      const qTeam = req.query.teamId || req.query.team;
      if (qTeam && mongoose.Types.ObjectId.isValid(qTeam)) {
        targetTeamId = qTeam;
      } else if (req.user.team) {
        targetTeamId = req.user.team;
      } else {
        const firstTeam = await Team.findOne({ isActive: true });
        if (firstTeam) targetTeamId = firstTeam._id;
      }
    } else if (userRole === 'teamHead' || userRole === 'teamAssistant') {
      if (!req.user.team) {
        return res.status(400).json({ success: false, message: 'You are not assigned to any team.' });
      }
      targetTeamId = req.user.team;
    } else {
      return res.status(403).json({ success: false, message: 'Access denied. Team scorecard is for chapter teams.' });
    }

    if (!targetTeamId) {
      return res.status(404).json({ success: false, message: 'No team specified or found.' });
    }

    const teamDoc = await Team.findById(targetTeamId).select('name code head assistant');
    if (!teamDoc) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const now = new Date();
    const targetMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
    const targetYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();

    if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month (1-12).' });
    }
    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      return res.status(400).json({ success: false, message: 'Invalid year.' });
    }

    // Fetch active criteria for monthly and one_time
    const [monthlyCriteria, oneTimeCriteria] = await Promise.all([
      Criteria.find({ category: 'monthly', level: 'team', isActive: true }).sort({ displayOrder: 1 }),
      Criteria.find({ category: 'one_time', level: 'team', isActive: true }).sort({ displayOrder: 1 }),
    ]);

    const monthlyCriteriaIds = monthlyCriteria.map((c) => c._id);
    const oneTimeCriteriaIds = oneTimeCriteria.map((c) => c._id);

    // Fetch team entries
    const [monthlyEntries, oneTimeEntries] = await Promise.all([
      TeamPointEntry.find({
        team: targetTeamId,
        criteria: { $in: monthlyCriteriaIds },
        month: targetMonth,
        year: targetYear,
        isReversal: false,
        isAdminAdjustment: false,
      }).sort({ createdAt: -1 }),
      TeamPointEntry.find({
        team: targetTeamId,
        criteria: { $in: oneTimeCriteriaIds },
        isReversal: false,
        isAdminAdjustment: false,
      }).sort({ createdAt: -1 }),
    ]);

    // Build Monthly Items
    let earnedMonthly = 0;
    const monthlyItems = monthlyCriteria.map((crit) => {
      const matched = monthlyEntries.filter((e) => e.criteria.toString() === crit._id.toString());
      const approvedEntry = matched.find((e) => e.status === 'approved');
      const pendingEntry = matched.find((e) => e.status === 'pending');
      const rejectedEntry = matched.find((e) => e.status === 'rejected');

      let status = 'not_submitted';
      let entry = null;

      if (approvedEntry) {
        status = 'approved';
        entry = approvedEntry;
        earnedMonthly += crit.points;
      } else if (pendingEntry) {
        status = 'pending';
        entry = pendingEntry;
      } else if (rejectedEntry) {
        status = 'rejected';
        entry = rejectedEntry;
      }

      return {
        criterion: {
          id: crit._id,
          _id: crit._id,
          key: crit.key,
          name: crit.name,
          points: crit.points,
          basisLabel: crit.basisLabel,
          displayOrder: crit.displayOrder,
          needsProof: Boolean(crit.needsProof),
        },
        status,
        entry,
      };
    });

    const totalMonthly = monthlyCriteria.reduce((sum, c) => sum + (c.points || 0), 0);

    // Build One-Time Items
    let earnedOneTime = 0;
    const oneTimeItems = oneTimeCriteria.map((crit) => {
      const matched = oneTimeEntries.filter((e) => e.criteria.toString() === crit._id.toString());
      const approvedEntry = matched.find((e) => e.status === 'approved');
      const pendingEntry = matched.find((e) => e.status === 'pending');
      const rejectedEntry = matched.find((e) => e.status === 'rejected');

      let status = 'not_submitted';
      let entry = null;

      if (approvedEntry) {
        status = 'approved';
        entry = approvedEntry;
        earnedOneTime += crit.points;
      } else if (pendingEntry) {
        status = 'pending';
        entry = pendingEntry;
      } else if (rejectedEntry) {
        status = 'rejected';
        entry = rejectedEntry;
      }

      return {
        criterion: {
          id: crit._id,
          _id: crit._id,
          key: crit.key,
          name: crit.name,
          points: crit.points,
          basisLabel: crit.basisLabel,
          displayOrder: crit.displayOrder,
          needsProof: Boolean(crit.needsProof),
        },
        status,
        entry,
      };
    });

    const totalOneTime = oneTimeCriteria.reduce((sum, c) => sum + (c.points || 0), 0);

    // Calculate eligible member count for this team in this month
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth - 1, lastDay, 23, 59, 59, 999));

    const currentMembers = await User.find({
      team: targetTeamId,
      isActive: true,
      role: { $ne: 'admin' },
      createdAt: { $lte: monthEnd },
    }).select('_id');

    const pointMemberIds = await PointEntry.distinct('member', {
      team: targetTeamId,
      month: targetMonth,
      year: targetYear,
      status: 'approved',
    });

    const allEligibleMemberIds = new Set([
      ...currentMembers.map((m) => m._id.toString()),
      ...pointMemberIds.map((id) => id.toString()),
    ]);
    const eligibleMemberCount = allEligibleMemberIds.size;

    // Calculate member point total for this month to provide full team points total
    const memberPointAgg = await PointEntry.aggregate([
      {
        $match: {
          team: new mongoose.Types.ObjectId(targetTeamId),
          month: targetMonth,
          year: targetYear,
          status: 'approved',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$points' },
        },
      },
    ]);
    const memberPointsTotal = memberPointAgg[0]?.total || 0;
    const totalTeamPoints = memberPointsTotal + earnedMonthly + earnedOneTime;
    const unroundedAverage = eligibleMemberCount > 0 ? totalTeamPoints / eligibleMemberCount : 0;
    const averagePointsPerMember = Number(unroundedAverage.toFixed(2));

    res.status(200).json({
      success: true,
      data: {
        team: teamDoc,
        month: targetMonth,
        year: targetYear,
        eligibleMemberCount,
        memberPointsTotal,
        totalTeamPoints,
        averagePointsPerMember,
        unroundedAverage,
        monthly: {
          items: monthlyItems,
          earned: earnedMonthly,
          total: totalMonthly,
        },
        oneTime: {
          items: oneTimeItems,
          earned: earnedOneTime,
          total: totalOneTime,
        },
        earnedMonthly,
        earnedOneTime,
        totalMonthly,
        totalOneTime,
      },
    });
  } catch (error) {
    next(error);
  }
};
