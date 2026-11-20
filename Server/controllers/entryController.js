const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');
const { allowsMultipleQuantity } = require('../constants/criteriaConstants');

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
 * @desc    Submit a member point entry
 * @route   POST /api/entries
 * @access  Private (teamAssistant for own team, or admin)
 */
exports.createEntry = async (req, res, next) => {
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

    const userRole = req.user.role;

    if (!['admin', 'teamHead', 'teamAssistant', 'member'].includes(userRole)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit activities.',
      });
    }

    if (userRole === 'member') {
      // Members can only submit for themselves
      if (!req.body.member || req.body.member.toString() !== req.user._id.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Members can only submit entries for themselves.',
        });
      }
    }

    const { member, criteria, quantity, date, note, proofImage, proofPublicId } = req.body;

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

    if (criteriaDoc.level !== 'member') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only member-level criteria can be submitted as a member point entry.',
      });
    }

    if (userRole === 'member' && (criteriaDoc.category === 'penalty' || (criteriaDoc.points || 0) < 0)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Members cannot submit penalty or negative point entries.',
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

    // Validate Member
    if (!mongoose.Types.ObjectId.isValid(member)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid member ID format.',
      });
    }

    const memberDoc = await User.findById(member).session(session);
    if (!memberDoc || !memberDoc.isActive) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Active member not found.',
      });
    }

    if (!memberDoc.team) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Member does not belong to any team. Assign member to a team first.',
      });
    }

    // Role-based submission validation: Team Assistant and Team Head can only submit for members of their own team
    if (userRole === 'teamAssistant' || userRole === 'teamHead') {
      if (!req.user.team || req.user.team.toString() !== memberDoc.team.toString()) {
        await session.abortTransaction();
        const roleLabel = userRole === 'teamHead' ? 'Team heads' : 'Team assistants';
        return res.status(403).json({
          success: false,
          message: `${roleLabel} can only submit entries for members of their own team.`,
        });
      }
    }

    // Parse and derive dates
    const entryDate = date ? new Date(date) : new Date();
    if (isNaN(entryDate.getTime())) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid date provided.',
      });
    }

    const weekNumber = getWeekNumber(entryDate);
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();
    const frequency = criteriaDoc.frequency === 'monthly' ? 'monthly' : 'weekly';

    // Application-level pre-check for active duplicates
    const duplicateQuery = {
      member: memberDoc._id,
      criteria: criteriaDoc._id,
      status: { $in: ['pending', 'approved'] },
      isReversal: false,
      isAdminAdjustment: false,
    };

    if (frequency === 'monthly') {
      duplicateQuery.month = month;
      duplicateQuery.year = year;
    } else {
      duplicateQuery.weekNumber = weekNumber;
      duplicateQuery.year = year;
    }

    const existingEntry = await PointEntry.findOne(duplicateQuery).session(session);
    if (existingEntry) {
      await session.abortTransaction();
      const timeframeMsg = frequency === 'monthly' ? `month ${month}, ${year}` : `week ${weekNumber}, ${year}`;
      return res.status(409).json({
        success: false,
        message: `A pending or approved entry for this ${frequency} criterion already exists for ${timeframeMsg}.`,
      });
    }

    // Quantity rules: quantity is allowed above 1 only when basisLabel contains
    // "Per Visitor", "Per Testimonial", "Per Specific Ask" or "Per Week".
    // For all other criteria, quantity is always 1.
    const allowsMulti = allowsMultipleQuantity(criteriaDoc.basisLabel);
    const qty = allowsMulti ? Math.max(1, parseInt(quantity, 10) || 1) : 1;
    const calculatedPoints = criteriaDoc.points * qty;

    const isAutoApproved = userRole === 'admin' || userRole === 'teamHead';
    const entryStatus = isAutoApproved ? 'approved' : 'pending';
    const approvedBy = isAutoApproved ? req.user._id : null;
    const approvedAt = isAutoApproved ? new Date() : null;

    const [entry] = await PointEntry.create(
      [
        {
          member: memberDoc._id,
          team: memberDoc.team,
          criteria: criteriaDoc._id,
          quantity: qty,
          points: calculatedPoints,
          date: entryDate,
          weekNumber,
          month,
          year,
          frequency,
          proofImage: proofImage || null,
          proofPublicId: proofPublicId || null,
          note: typeof note === 'string' && note.trim() ? note.trim() : '',
          status: entryStatus,
          approvedBy,
          approvedAt,
          enteredBy: req.user._id,
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
        targetType: 'PointEntry',
        targetId: entry._id,
        performedBy: req.user._id,
        previousStatus: null,
        newStatus: entryStatus,
        points: calculatedPoints,
        reason: typeof note === 'string' && note.trim() ? note.trim() : '',
        metadata: {
          criteriaKey: criteriaDoc.key,
          quantity: qty,
          frequency,
          autoApproved: isAutoApproved,
          ...(isAutoApproved ? { approvedAt } : {}),
        },
      },
    ];

    if (isAutoApproved) {
      auditLogsToCreate.push({
        action: 'ENTRY_APPROVE',
        targetType: 'PointEntry',
        targetId: entry._id,
        performedBy: req.user._id,
        previousStatus: 'pending',
        newStatus: 'approved',
        points: calculatedPoints,
        reason: 'Auto-approved upon submission by leadership.',
        metadata: { approvedAt },
      });
    }

    await AuditLog.create(auditLogsToCreate, { session, ordered: true });

    await session.commitTransaction();

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
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
 * @desc    Get member point entries (role-scoped with pagination)
 * @route   GET /api/entries
 * @access  Private
 */
exports.getEntries = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const filter = {};

    // Scoping
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
      filter.member = req.user._id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.member && mongoose.Types.ObjectId.isValid(req.query.member)) {
      filter.member = req.query.member;
    }
    if (req.query.criteria && mongoose.Types.ObjectId.isValid(req.query.criteria)) {
      filter.criteria = req.query.criteria;
    }
    if (req.query.week) {
      filter.weekNumber = parseInt(req.query.week, 10);
    }
    if (req.query.month) {
      filter.month = parseInt(req.query.month, 10);
    }
    if (req.query.year) {
      filter.year = parseInt(req.query.year, 10);
    }
    if (req.query.enteredBy && mongoose.Types.ObjectId.isValid(req.query.enteredBy)) {
      filter.enteredBy = req.query.enteredBy;
    }

    // Search query support (searches member name/username/phone, criteria name/key, team name, and note)
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escaped = escapeRegex(search);
      const regex = new RegExp(escaped, 'i');

      const memberQuery = {
        $or: [
          { name: regex },
          { username: regex },
          { phone: regex },
        ],
      };
      if (userRole === 'teamHead' || userRole === 'teamAssistant') {
        memberQuery.team = req.user.team;
      }
      const matchingUsers = await User.find(memberQuery).select('_id').lean();
      const userIds = matchingUsers.map((u) => u._id);

      const matchingCriteria = await Criteria.find({
        $or: [{ name: regex }, { key: regex }, { category: regex }],
      }).select('_id').lean();
      const criteriaIds = matchingCriteria.map((c) => c._id);

      let teamIds = [];
      if (userRole === 'admin') {
        const matchingTeams = await Team.find({ name: regex }).select('_id').lean();
        teamIds = matchingTeams.map((t) => t._id);
      }

      const searchOr = [{ note: regex }];
      if (userIds.length > 0) {
        searchOr.push({ member: { $in: userIds } });
      }
      if (criteriaIds.length > 0) {
        searchOr.push({ criteria: { $in: criteriaIds } });
      }
      if (teamIds.length > 0) {
        searchOr.push({ team: { $in: teamIds } });
      }

      filter.$and = filter.$and || [];
      filter.$and.push({ $or: searchOr });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = req.query.limit !== undefined
      ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
      : (req.query.status === 'pending' ? 100 : 20);
    const skip = (page - 1) * limit;

    const total = await PointEntry.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    const entries = await PointEntry.find(filter)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .populate('reversedBy', 'name username phone role')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let dataToSend = entries;
    if (['admin', 'teamHead', 'teamAssistant'].includes(userRole)) {
      dataToSend = entries.map((entry) => {
        const obj = entry.toObject ? entry.toObject() : { ...entry };
        if (entry.status !== 'pending') {
          obj.canActOnMine = false;
        } else if (userRole === 'admin') {
          obj.canActOnMine = true;
        } else {
          const sameTeam =
            req.user.team &&
            entry.team &&
            (entry.team._id || entry.team).toString() === req.user.team.toString();
          const notEnteredByMe =
            entry.enteredBy &&
            (entry.enteredBy._id || entry.enteredBy).toString() !== req.user._id.toString();
          const notAboutMe =
            entry.member &&
            (entry.member._id || entry.member).toString() !== req.user._id.toString();

          if (!sameTeam || !notEnteredByMe || !notAboutMe) {
            obj.canActOnMine = false;
          } else if (userRole === 'teamHead') {
            obj.canActOnMine = true;
          } else if (userRole === 'teamAssistant') {
            const isNegative = (entry.points || 0) < 0;
            const submitterRole = entry.enteredBy?.role || 'member';
            // Team assistant can only approve positive entries submitted by members
            obj.canActOnMine = !isNegative && submitterRole === 'member';
          } else {
            obj.canActOnMine = false;
          }
        }
        return obj;
      });
    }

    res.status(200).json({
      success: true,
      data: dataToSend,
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
 * @desc    Approve a member point entry
 * @route   PATCH /api/entries/:id/approve
 * @access  Private (teamHead / teamAssistant of same team, or admin)
 */
exports.approveEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
      });
    }

    const entry = await PointEntry.findById(req.params.id).session(session);
    if (!entry) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
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
    const isNegative = (entry.points || 0) < 0;

    if (userRole !== 'admin' && userRole !== 'teamHead' && userRole !== 'teamAssistant') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Only team heads, team assistants, or admins can approve entries.',
      });
    }

    if (isNegative && userRole === 'teamAssistant') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Team assistants cannot approve negative point entries.',
      });
    }

    if (userRole !== 'admin') {
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You can only approve entries for your own team.',
        });
      }

      // STRICT APPROVAL RULE:
      // A user cannot approve an entry they entered or that is about them.
      const isRecipient = entry.member.toString() === req.user._id.toString();
      const isSubmitter = entry.enteredBy.toString() === req.user._id.toString();

      if (isRecipient || isSubmitter) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You cannot approve or reject entries that you entered or that are about you.',
        });
      }

      // Team Assistant can only approve submissions from members (role === 'member')
      if (userRole === 'teamAssistant') {
        const submitterUser = await User.findById(entry.enteredBy).session(session);
        if (submitterUser && submitterUser.role !== 'member') {
          await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: 'Team assistants can only approve submissions from members. Team assistant entries must be approved by a team head or admin.',
          });
        }
      }
    }

    // Atomic update conditioned on status 'pending'
    const updatedEntry = await PointEntry.findOneAndUpdate(
      { _id: entry._id, status: 'pending' },
      {
        $set: {
          status: 'approved',
          approvedBy: req.user._id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      },
      { new: true, session }
    );

    if (!updatedEntry) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'This entry was already processed.',
      });
    }

    await AuditLog.create(
      [
        {
          action: 'ENTRY_APPROVE',
          targetType: 'PointEntry',
          targetId: updatedEntry._id,
          performedBy: req.user._id,
          previousStatus: 'pending',
          newStatus: 'approved',
          points: updatedEntry.points,
          reason: '',
          metadata: { approvedAt: updatedEntry.approvedAt },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await PointEntry.findById(updatedEntry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(200).json({
      success: true,
      message: 'Entry approved successfully.',
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
 * @desc    Reject a member point entry
 * @route   PATCH /api/entries/:id/reject
 * @access  Private (teamHead / teamAssistant of same team, or admin)
 */
exports.rejectEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
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

    const entry = await PointEntry.findById(req.params.id).session(session);
    if (!entry) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Point entry not found.',
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
    const isNegative = (entry.points || 0) < 0;

    if (userRole !== 'admin' && userRole !== 'teamHead' && userRole !== 'teamAssistant') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Only team heads, team assistants, or admins can reject entries.',
      });
    }

    if (isNegative && userRole === 'teamAssistant') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Team assistants cannot reject negative point entries.',
      });
    }

    if (userRole !== 'admin') {
      if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You can only reject entries for your own team.',
        });
      }

      // STRICT REJECTION RULE:
      // A user cannot reject an entry they entered or that is about them.
      const isRecipient = entry.member.toString() === req.user._id.toString();
      const isSubmitter = entry.enteredBy.toString() === req.user._id.toString();

      if (isRecipient || isSubmitter) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You cannot approve or reject entries that you entered or that are about you.',
        });
      }

      // Team Assistant can only reject submissions from members (role === 'member')
      if (userRole === 'teamAssistant') {
        const submitterUser = await User.findById(entry.enteredBy).session(session);
        if (submitterUser && submitterUser.role !== 'member') {
          await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: 'Team assistants can only reject submissions from members. Team assistant entries must be rejected by a team head or admin.',
          });
        }
      }

      if (entry.status === 'approved') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only an admin can override and reject an already approved entry.',
        });
      }
    }

    // Atomic update condition:
    // Only admin can reject an approved entry (override); head and assistant can act only on pending ones.
    const filterCondition =
      userRole === 'admin'
        ? { _id: entry._id, status: { $in: ['pending', 'approved'] } }
        : { _id: entry._id, status: 'pending' };

    const updatedEntry = await PointEntry.findOneAndUpdate(
      filterCondition,
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason.trim(),
          approvedBy: req.user._id,
          approvedAt: new Date(),
        },
      },
      { new: true, session }
    );

    if (!updatedEntry) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'This entry was already processed.',
      });
    }

    await AuditLog.create(
      [
        {
          action: 'ENTRY_REJECT',
          targetType: 'PointEntry',
          targetId: updatedEntry._id,
          performedBy: req.user._id,
          previousStatus: entry.status,
          newStatus: 'rejected',
          points: updatedEntry.points,
          reason: reason.trim(),
          metadata: { rejectedAt: updatedEntry.approvedAt },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await PointEntry.findById(updatedEntry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(200).json({
      success: true,
      message: 'Entry rejected.',
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
 * @desc    Admin Direct Point Award (Official Criteria-based, immediately approved)
 * @route   POST /api/entries/admin/award
 * @access  Private (admin only)
 */
exports.adminDirectAward = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { member, criteria, quantity, date, note, proofImage, proofPublicId } = req.body;

    if (proofImage && !validateProofUrl(proofImage)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid proof image URL. Proof must be uploaded to the official Cloudinary proofs storage.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(member)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid member ID format is required.' });
    }

    const memberDoc = await User.findById(member).session(session);
    if (!memberDoc || !memberDoc.isActive || !memberDoc.team) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active member with an assigned team is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(criteria)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid criteria ID format is required.' });
    }

    const criteriaDoc = await Criteria.findById(criteria).session(session);
    if (!criteriaDoc || !criteriaDoc.isActive || criteriaDoc.level !== 'member') {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active member-level criteria not found.' });
    }

    const entryDate = date ? new Date(date) : new Date();
    if (isNaN(entryDate.getTime())) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid date provided.' });
    }

    const weekNumber = getWeekNumber(entryDate);
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();
    const frequency = criteriaDoc.frequency === 'monthly' ? 'monthly' : 'weekly';

    // Application check against active duplicates
    const duplicateQuery = {
      member: memberDoc._id,
      criteria: criteriaDoc._id,
      status: { $in: ['pending', 'approved'] },
      isReversal: false,
      isAdminAdjustment: false,
    };
    if (frequency === 'monthly') {
      duplicateQuery.month = month;
      duplicateQuery.year = year;
    } else {
      duplicateQuery.weekNumber = weekNumber;
      duplicateQuery.year = year;
    }

    const existingEntry = await PointEntry.findOne(duplicateQuery).session(session);
    if (existingEntry) {
      await session.abortTransaction();
      const timeframeMsg = frequency === 'monthly' ? `month ${month}, ${year}` : `week ${weekNumber}, ${year}`;
      return res.status(409).json({
        success: false,
        message: `A pending or approved entry for this ${frequency} criterion already exists for ${timeframeMsg}.`,
      });
    }

    const allowsMulti = allowsMultipleQuantity(criteriaDoc.basisLabel);
    const qty = allowsMulti ? Math.max(1, parseInt(quantity, 10) || 1) : 1;
    const calculatedPoints = criteriaDoc.points * qty;

    const [entry] = await PointEntry.create(
      [
        {
          member: memberDoc._id,
          team: memberDoc.team,
          criteria: criteriaDoc._id,
          quantity: qty,
          points: calculatedPoints,
          date: entryDate,
          weekNumber,
          month,
          year,
          frequency,
          proofImage: proofImage || null,
          proofPublicId: proofPublicId || null,
          note: typeof note === 'string' && note.trim() ? note.trim() : 'Admin Direct Award',
          status: 'approved',
          enteredBy: req.user._id,
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
          targetType: 'PointEntry',
          targetId: entry._id,
          performedBy: req.user._id,
          previousStatus: null,
          newStatus: 'approved',
          points: calculatedPoints,
          reason: typeof note === 'string' && note.trim() ? note.trim() : 'Admin Direct Award',
          metadata: {
            criteriaKey: criteriaDoc.key,
            quantity: qty,
            frequency,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(201).json({
      success: true,
      message: 'Admin point award created and approved successfully.',
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
 * @desc    Admin Exceptional Manual Adjustment (Signed points, mandatory reason, immediately approved)
 * @route   POST /api/entries/admin/adjust
 * @access  Private (admin only)
 */
exports.adminManualAdjustment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { member, points, reason, date, note } = req.body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'A mandatory reason is required for manual adjustments.' });
    }

    const numPoints = parseInt(points, 10);
    if (isNaN(numPoints) || numPoints === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Points must be a non-zero signed integer.' });
    }

    if (!mongoose.Types.ObjectId.isValid(member)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid member ID format is required.' });
    }

    const memberDoc = await User.findById(member).session(session);
    if (!memberDoc || !memberDoc.isActive || !memberDoc.team) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Active member with an assigned team is required.' });
    }

    const entryDate = date ? new Date(date) : new Date();
    if (isNaN(entryDate.getTime())) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid date provided.' });
    }

    const weekNumber = getWeekNumber(entryDate);
    const month = entryDate.getMonth() + 1;
    const year = entryDate.getFullYear();

    const [entry] = await PointEntry.create(
      [
        {
          member: memberDoc._id,
          team: memberDoc.team,
          criteria: null,
          quantity: 1,
          points: numPoints,
          date: entryDate,
          weekNumber,
          month,
          year,
          frequency: 'weekly',
          proofImage: null,
          note: typeof note === 'string' && note.trim() ? note.trim() : (typeof reason === 'string' ? reason.trim() : ''),
          status: 'approved',
          enteredBy: req.user._id,
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
          targetType: 'PointEntry',
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

    const populatedEntry = await PointEntry.findById(entry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role');

    res.status(201).json({
      success: true,
      message: 'Admin manual adjustment applied successfully.',
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
 * @desc    Reverse an approved member point entry
 * @route   POST /api/entries/:id/reverse
 * @access  Private (admin only)
 */
exports.reverseEntry = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Point entry not found.' });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'A reason is required to reverse an entry.' });
    }

    const original = await PointEntry.findById(id).session(session);
    if (!original) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Point entry not found.' });
    }

    if (original.status !== 'approved') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Only approved entries can be reversed.',
      });
    }

    if (original.isReversal || original.reversalOf) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Cannot reverse a reversal transaction.',
      });
    }

    // Pre-check for existing reversal
    const existingReversal = await PointEntry.findOne({ reversalOf: original._id }).session(session);
    if (existingReversal) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'This transaction has already been reversed.',
      });
    }

    // Create compensating negative entry
    const reversalPoints = -original.points;

    const [reversalEntry] = await PointEntry.create(
      [
        {
          member: original.member,
          team: original.team,
          criteria: original.criteria,
          quantity: original.quantity,
          points: reversalPoints,
          date: original.date,
          weekNumber: original.weekNumber,
          month: original.month,
          year: original.year,
          frequency: original.frequency,
          proofImage: original.proofImage,
          proofPublicId: original.proofPublicId,
          note: `Reversal of entry ${original._id}: ${reason.trim()}`,
          status: 'approved',
          enteredBy: req.user._id,
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
          targetType: 'PointEntry',
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

    const populatedReversal = await PointEntry.findById(reversalEntry._id)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .populate('reversalOf');

    res.status(200).json({
      success: true,
      message: 'Entry reversed successfully.',
      data: populatedReversal,
    });
  } catch (error) {
    await session.abortTransaction();
    if (
      error.code === 11000 ||
      error.code === 112 ||
      (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) ||
      (error.message && (error.message.includes('WriteConflict') || error.message.includes('duplicate key') || error.message.includes('reversalOf') || error.message.includes('uniq_point_reversal')))
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

/**
 * @desc    Get member approved points breakdown by category
 * @route   GET /api/entries/my-breakdown?period=week|month
 * @access  Private (own data only)
 */
exports.getMyBreakdown = async (req, res, next) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'month';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentWeek = getWeekNumber(now);

    const matchFilter = {
      member: new mongoose.Types.ObjectId(req.user._id),
      status: 'approved',
      year: currentYear,
    };

    if (period === 'week') {
      matchFilter.weekNumber = currentWeek;
    } else {
      matchFilter.month = currentMonth;
    }

    const approvedEntries = await PointEntry.find(matchFilter).populate('criteria', 'category points key name');

    let meetingDayEarned = 0;
    let nonMeetingDayEarned = 0;
    let penaltyEarned = 0;

    for (const entry of approvedEntries) {
      const cat = entry.criteria?.category;
      if (cat === 'meeting_day') {
        meetingDayEarned += entry.points;
      } else if (cat === 'non_meeting_day') {
        nonMeetingDayEarned += entry.points;
      } else if (cat === 'penalty') {
        penaltyEarned += entry.points;
      } else if (entry.isAdminAdjustment) {
        if (entry.points >= 0) meetingDayEarned += entry.points;
        else penaltyEarned += entry.points;
      }
    }

    // Category totals from active Criteria
    const [meetingCriteria, nonMeetingCriteria] = await Promise.all([
      Criteria.find({ category: 'meeting_day', isActive: true }),
      Criteria.find({ category: 'non_meeting_day', isActive: true }),
    ]);

    const meetingDayTotal = meetingCriteria.reduce((sum, c) => sum + (c.points || 0), 0);
    const nonMeetingDayTotal = nonMeetingCriteria.reduce((sum, c) => sum + (c.points || 0), 0);

    res.status(200).json({
      success: true,
      period,
      data: {
        categories: [
          {
            key: 'meeting_day',
            label: 'Meeting Day Activities',
            earned: meetingDayEarned,
            total: meetingDayTotal,
          },
          {
            key: 'non_meeting_day',
            label: 'Non-Meeting Day Activities',
            earned: nonMeetingDayEarned,
            total: nonMeetingDayTotal,
          },
        ],
        penalties: {
          key: 'penalty',
          label: 'Negative Points Criteria',
          earned: penaltyEarned,
        },
        totalNet: meetingDayEarned + nonMeetingDayEarned + penaltyEarned,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get entries by period (weekly and monthly) for a selected calendar date
 * @route   GET /api/entries/by-period?date=YYYY-MM-DD[&team=teamId]
 * @access  Private (admin, teamHead, teamAssistant)
 */
exports.getEntriesByPeriod = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    if (!['admin', 'teamHead', 'teamAssistant'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin, team head, and team assistant can view period points.',
      });
    }

    const { date: dateQuery, team: teamQuery, member: memberQuery } = req.query;

    // Resolve date (default to today if missing or invalid)
    let targetYear, targetMonth, targetDay;
    if (typeof dateQuery === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery.trim())) {
      const parts = dateQuery.trim().split('-').map(Number);
      targetYear = parts[0];
      targetMonth = parts[1]; // 1-12
      targetDay = parts[2];
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
      targetDay = now.getDate();
    }

    // Midday UTC reference safely avoids timezone or DST boundary shifts
    const refDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
    if (isNaN(refDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date provided. Format must be YYYY-MM-DD.',
      });
    }

    const weekNumber = getWeekNumber(refDate);
    const dayOfWeek = refDate.getUTCDay() || 7; // 1 = Monday ... 7 = Sunday

    const startOfWeek = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - (dayOfWeek - 1), 0, 0, 0, 0));
    const endOfWeek = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + (7 - dayOfWeek), 23, 59, 59, 999));

    const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
    const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const endOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, lastDayOfMonth, 23, 59, 59, 999));

    // Team & Member scoping
    let scopedTeamId = null;
    let scopedMemberId = null;

    if (memberQuery) {
      if (!mongoose.Types.ObjectId.isValid(memberQuery)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid member ID format.',
        });
      }
      scopedMemberId = new mongoose.Types.ObjectId(memberQuery);
      if (userRole !== 'admin') {
        const targetMember = await User.findById(scopedMemberId).select('team');
        const userTeamId = req.user.team?._id ? req.user.team._id.toString() : req.user.team?.toString();
        if (!targetMember || !targetMember.team || targetMember.team.toString() !== userTeamId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view member scores for your assigned team.',
          });
        }
      }
    }

    if (userRole === 'admin') {
      if (teamQuery && mongoose.Types.ObjectId.isValid(teamQuery)) {
        scopedTeamId = new mongoose.Types.ObjectId(teamQuery);
      }
    } else {
      if (!req.user.team) {
        return res.status(200).json({
          success: true,
          data: {
            selectedDate: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
            week: {
              weekNumber,
              year: targetYear,
              startDate: startOfWeek.toISOString().split('T')[0],
              endDate: endOfWeek.toISOString().split('T')[0],
              summary: {
                approvedPoints: 0,
                pendingPoints: 0,
                rejectedPoints: 0,
                totalEntries: 0,
                eligibleMemberCount: 0,
                averagePointsPerMember: 0,
                unroundedAverage: 0,
              },
              entries: [],
            },
            month: {
              month: targetMonth,
              year: targetYear,
              startDate: startOfMonth.toISOString().split('T')[0],
              endDate: endOfMonth.toISOString().split('T')[0],
              summary: {
                approvedPoints: 0,
                memberApprovedPoints: 0,
                teamApprovedPoints: 0,
                pendingPoints: 0,
                rejectedPoints: 0,
                totalEntries: 0,
                eligibleMemberCount: 0,
                averagePointsPerMember: 0,
                unroundedAverage: 0,
              },
              memberEntries: [],
              teamEntries: [],
            },
          },
        });
      }
      scopedTeamId = req.user.team;
    }

    const teamFilter = scopedTeamId ? { team: scopedTeamId } : {};
    const memberFilter = scopedMemberId ? { member: scopedMemberId } : {};

    // 1. Fetch Weekly Member Entries
    const weeklyFilter = {
      ...teamFilter,
      ...memberFilter,
      $or: [
        { date: { $gte: startOfWeek, $lte: endOfWeek } },
        { weekNumber, year: { $in: [startOfWeek.getUTCFullYear(), endOfWeek.getUTCFullYear()] } },
      ],
    };

    const weeklyEntries = await PointEntry.find(weeklyFilter)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .sort({ date: -1, createdAt: -1 });

    const uniqueWeeklyMap = new Map();
    for (const entry of weeklyEntries) {
      uniqueWeeklyMap.set(entry._id.toString(), entry);
    }
    const uniqueWeeklyEntries = Array.from(uniqueWeeklyMap.values());

    let weeklyApprovedPoints = 0;
    let weeklyPendingPoints = 0;
    let weeklyRejectedPoints = 0;

    for (const e of uniqueWeeklyEntries) {
      if (e.status === 'approved') {
        weeklyApprovedPoints += e.points || 0;
      } else if (e.status === 'pending') {
        weeklyPendingPoints += e.points || 0;
      } else if (e.status === 'rejected') {
        weeklyRejectedPoints += e.points || 0;
      }
    }

    // 2. Fetch Monthly Member Entries
    const monthlyMemberFilter = {
      ...teamFilter,
      ...memberFilter,
      $or: [
        { date: { $gte: startOfMonth, $lte: endOfMonth } },
        { month: targetMonth, year: targetYear },
      ],
    };

    const monthlyMemberEntries = await PointEntry.find(monthlyMemberFilter)
      .populate('member', 'name email username phone role')
      .populate('team', 'name')
      .populate('criteria', 'key name category points basis frequency needsProof')
      .populate('enteredBy', 'name username phone role')
      .populate('approvedBy', 'name username phone role')
      .sort({ date: -1, createdAt: -1 });

    const uniqueMonthlyMemberMap = new Map();
    for (const entry of monthlyMemberEntries) {
      uniqueMonthlyMemberMap.set(entry._id.toString(), entry);
    }
    const uniqueMonthlyMemberEntries = Array.from(uniqueMonthlyMemberMap.values());

    // 3. Fetch Monthly Team Point Entries (team awards do not apply when inspecting a single member)
    let monthlyTeamEntries = [];
    if (!scopedMemberId) {
      const monthlyTeamFilter = {
        ...teamFilter,
        month: targetMonth,
        year: targetYear,
      };

      monthlyTeamEntries = await TeamPointEntry.find(monthlyTeamFilter)
        .populate('team', 'name')
        .populate('criteria', 'key name category points basis frequency needsProof')
        .populate('submittedBy', 'name username phone role')
        .populate('approvedBy', 'name username phone role')
        .sort({ createdAt: -1 });
    }

    let monthlyMemberApprovedPoints = 0;
    let monthlyTeamApprovedPoints = 0;
    let monthlyPendingPoints = 0;
    let monthlyRejectedPoints = 0;

    for (const e of uniqueMonthlyMemberEntries) {
      if (e.status === 'approved') {
        monthlyMemberApprovedPoints += e.points || 0;
      } else if (e.status === 'pending') {
        monthlyPendingPoints += e.points || 0;
      } else if (e.status === 'rejected') {
        monthlyRejectedPoints += e.points || 0;
      }
    }

    for (const e of monthlyTeamEntries) {
      if (e.status === 'approved') {
        monthlyTeamApprovedPoints += e.points || 0;
      } else if (e.status === 'pending') {
        monthlyPendingPoints += e.points || 0;
      } else if (e.status === 'rejected') {
        monthlyRejectedPoints += e.points || 0;
      }
    }

    const totalMonthlyApprovedPoints = monthlyMemberApprovedPoints + monthlyTeamApprovedPoints;
    const totalMonthlyEntriesCount = uniqueMonthlyMemberEntries.length + monthlyTeamEntries.length;

    // Calculate eligible member counts and averages for week and month
    let weeklyEligibleMemberCount = 0;
    let monthlyEligibleMemberCount = 0;

    if (scopedMemberId) {
      weeklyEligibleMemberCount = 1;
      monthlyEligibleMemberCount = 1;
    } else if (scopedTeamId) {
      const teamWeeklyUsers = await User.find({
        team: scopedTeamId,
        isActive: true,
        role: { $ne: 'admin' },
        createdAt: { $lte: endOfWeek },
      }).select('_id');

      const weeklyPointMemberIds = await PointEntry.distinct('member', {
        team: scopedTeamId,
        status: 'approved',
        $or: [
          { date: { $gte: startOfWeek, $lte: endOfWeek } },
          { weekNumber, year: { $in: [startOfWeek.getUTCFullYear(), endOfWeek.getUTCFullYear()] } },
        ],
      });

      const weeklyMemberSet = new Set([
        ...teamWeeklyUsers.map((m) => m._id.toString()),
        ...weeklyPointMemberIds.map((id) => id.toString()),
      ]);
      weeklyEligibleMemberCount = weeklyMemberSet.size;

      const teamMonthlyUsers = await User.find({
        team: scopedTeamId,
        isActive: true,
        role: { $ne: 'admin' },
        createdAt: { $lte: endOfMonth },
      }).select('_id');

      const monthlyPointMemberIds = await PointEntry.distinct('member', {
        team: scopedTeamId,
        status: 'approved',
        $or: [
          { date: { $gte: startOfMonth, $lte: endOfMonth } },
          { month: targetMonth, year: targetYear },
        ],
      });

      const monthlyMemberSet = new Set([
        ...teamMonthlyUsers.map((m) => m._id.toString()),
        ...monthlyPointMemberIds.map((id) => id.toString()),
      ]);
      monthlyEligibleMemberCount = monthlyMemberSet.size;
    } else {
      const allWeeklyUsers = await User.find({
        team: { $ne: null },
        isActive: true,
        role: { $ne: 'admin' },
        createdAt: { $lte: endOfWeek },
      }).select('_id');
      weeklyEligibleMemberCount = allWeeklyUsers.length;

      const allMonthlyUsers = await User.find({
        team: { $ne: null },
        isActive: true,
        role: { $ne: 'admin' },
        createdAt: { $lte: endOfMonth },
      }).select('_id');
      monthlyEligibleMemberCount = allMonthlyUsers.length;
    }

    const unroundedWeeklyAvg = weeklyEligibleMemberCount > 0 ? weeklyApprovedPoints / weeklyEligibleMemberCount : 0;
    const weeklyAvgPointsPerMember = Number(unroundedWeeklyAvg.toFixed(2));

    const unroundedMonthlyAvg = monthlyEligibleMemberCount > 0 ? totalMonthlyApprovedPoints / monthlyEligibleMemberCount : 0;
    const monthlyAvgPointsPerMember = Number(unroundedMonthlyAvg.toFixed(2));

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.status(200).json({
      success: true,
      data: {
        selectedDate: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
        week: {
          weekNumber,
          year: targetYear,
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: endOfWeek.toISOString().split('T')[0],
          summary: {
            approvedPoints: weeklyApprovedPoints,
            pendingPoints: weeklyPendingPoints,
            rejectedPoints: weeklyRejectedPoints,
            totalEntries: uniqueWeeklyEntries.length,
            eligibleMemberCount: weeklyEligibleMemberCount,
            averagePointsPerMember: weeklyAvgPointsPerMember,
            unroundedAverage: unroundedWeeklyAvg,
          },
          entries: uniqueWeeklyEntries,
        },
        month: {
          month: targetMonth,
          monthName: monthNames[targetMonth - 1],
          year: targetYear,
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: endOfMonth.toISOString().split('T')[0],
          summary: {
            approvedPoints: totalMonthlyApprovedPoints,
            memberApprovedPoints: monthlyMemberApprovedPoints,
            teamApprovedPoints: monthlyTeamApprovedPoints,
            pendingPoints: monthlyPendingPoints,
            rejectedPoints: monthlyRejectedPoints,
            totalEntries: totalMonthlyEntriesCount,
            eligibleMemberCount: monthlyEligibleMemberCount,
            averagePointsPerMember: monthlyAvgPointsPerMember,
            unroundedAverage: unroundedMonthlyAvg,
          },
          memberEntries: uniqueMonthlyMemberEntries,
          teamEntries: monthlyTeamEntries,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

