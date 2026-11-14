const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const PointEntry = require('../models/PointEntry');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');
const {
  normalizeMeetingDate,
  getWeekNumber,
  loadMeetingCriteria,
  validateMeetingRow,
  deriveMeetingSummary,
} = require('../services/meetingPointsHelper');

/**
 * @desc    Get allowed meeting day activities for custom activity picker
 * @route   GET /api/meetings/allowed-activities
 * @access  Private (All authenticated users)
 */
exports.getAllowedActivities = async (req, res, next) => {
  try {
    const { allowedActivities } = await loadMeetingCriteria();
    res.status(200).json({
      success: true,
      data: allowedActivities,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a draft meeting sheet for a team and date
 * @route   POST /api/meetings
 * @access  Private (teamAssistant for own team, or admin)
 */
exports.createMeeting = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    let teamId;

    if (userRole === 'admin') {
      teamId = req.body.team;
      if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid team ID is required.',
        });
      }
    } else if (userRole === 'teamAssistant') {
      if (!req.user.team) {
        return res.status(400).json({
          success: false,
          message: 'Your account is not assigned to any team.',
        });
      }
      teamId = req.user.team.toString();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only team assistants and admins can create meeting sheets.',
      });
    }

    const { date } = req.body;
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Meeting date is required.',
      });
    }

    const normalizedDate = normalizeMeetingDate(date);
    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid meeting date format.',
      });
    }

    // Check if meeting already exists for team + date
    const existing = await Meeting.findOne({
      team: teamId,
      date: normalizedDate,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A meeting sheet already exists for this team on the selected date.',
        data: existing,
      });
    }

    // Verify team exists
    const teamDoc = await Team.findById(teamId);
    if (!teamDoc) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    // Fetch active members of the team
    const members = await User.find({
      team: teamId,
      isActive: true,
    })
      .select('_id name username role phone')
      .sort({ name: 1 });

    const weekNumber = getWeekNumber(normalizedDate);
    const month = normalizedDate.getUTCMonth() + 1;
    const year = normalizedDate.getUTCFullYear();

    const rows = members.map((m) => ({
      member: m._id,
      arrivalTime: '',
      attendance: 'present',
      walkedOut: false,
      attire: 'none',
      activities: [],
    }));

    const meeting = new Meeting({
      team: teamId,
      date: normalizedDate,
      weekNumber,
      month,
      year,
      status: 'draft',
      rows,
      createdBy: req.user._id,
    });

    await meeting.save();

    const criteriaHelper = await loadMeetingCriteria();
    const populated = await Meeting.findById(meeting._id)
      .populate('team', 'name')
      .populate('createdBy', 'name username role')
      .populate('rows.member', 'name username role phone');

    const summary = deriveMeetingSummary(populated.rows, criteriaHelper);

    res.status(201).json({
      success: true,
      message: 'Draft meeting sheet created successfully.',
      data: {
        ...populated.toObject(),
        summary,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A meeting sheet already exists for this team on the selected date.',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get meetings list with counts and derived total points
 * @route   GET /api/meetings
 * @access  Private (teamAssistant, teamHead for own team, or admin)
 */
exports.getMeetings = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const filter = {};

    if (userRole === 'admin') {
      if (req.query.team && mongoose.Types.ObjectId.isValid(req.query.team)) {
        filter.team = req.query.team;
      }
    } else if (userRole === 'teamAssistant' || userRole === 'teamHead') {
      if (!req.user.team) {
        return res.status(400).json({
          success: false,
          message: 'Your account is not assigned to any team.',
        });
      }
      filter.team = req.user.team;
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view meeting sheets.',
      });
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.month) {
      filter.month = parseInt(req.query.month, 10);
    }
    if (req.query.year) {
      filter.year = parseInt(req.query.year, 10);
    }

    const criteriaHelper = await loadMeetingCriteria();

    const meetings = await Meeting.find(filter)
      .populate('team', 'name')
      .populate('createdBy', 'name username role')
      .populate('submittedBy', 'name username role')
      .populate('approvedBy', 'name username role')
      .sort({ date: -1 })
      .lean();

    const meetingsWithSummary = meetings.map((m) => {
      const summary = deriveMeetingSummary(m.rows, criteriaHelper);
      return {
        _id: m._id,
        team: m.team,
        date: m.date,
        weekNumber: m.weekNumber,
        month: m.month,
        year: m.year,
        status: m.status,
        sendBackReason: m.sendBackReason,
        createdBy: m.createdBy,
        submittedBy: m.submittedBy,
        submittedAt: m.submittedAt,
        approvedBy: m.approvedBy,
        approvedAt: m.approvedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        presentCount: summary.presentCount,
        lateCount: summary.lateCount,
        absentCount: summary.absentCount,
        totalPoints: summary.totalPoints,
        totalMembers: (m.rows || []).length,
      };
    });

    res.status(200).json({
      success: true,
      data: meetingsWithSummary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single meeting sheet with full row derivations
 * @route   GET /api/meetings/:id
 * @access  Private (teamAssistant, teamHead of same team, or admin)
 */
exports.getMeetingById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id)
      .populate('team', 'name')
      .populate('createdBy', 'name username role')
      .populate('submittedBy', 'name username role')
      .populate('approvedBy', 'name username role')
      .populate('rows.member', 'name username role phone')
      .populate('rows.activities.criteria', 'key name points category basisLabel needsProof');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    // Role scoping
    if (req.user.role !== 'admin') {
      if (!req.user.team || meeting.team._id.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only view meeting sheets for your own team.',
        });
      }
    }

    const criteriaHelper = await loadMeetingCriteria();
    const summary = deriveMeetingSummary(meeting.rows, criteriaHelper);

    // Fetch related PointEntry records if meeting is submitted or approved
    let pendingCount = 0;
    let approvedCount = 0;
    let headPendingCount = 0;

    if (meeting.status !== 'draft') {
      const entries = await PointEntry.find({ meeting: meeting._id })
        .select('member status points')
        .lean();

      entries.forEach((e) => {
        if (e.status === 'pending') {
          pendingCount += 1;
          if (
            req.user.role === 'teamHead' &&
            e.member.toString() === req.user._id.toString()
          ) {
            headPendingCount += 1;
          }
        } else if (e.status === 'approved') {
          approvedCount += 1;
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...meeting.toObject(),
        summary,
        ledgerStatus: {
          pendingCount,
          approvedCount,
          headPendingCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update meeting sheet rows (draft only)
 * @route   PUT /api/meetings/:id
 * @access  Private (teamAssistant for own team, or admin)
 */
exports.updateMeeting = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    // Only draft meetings can be edited
    if (meeting.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft meeting sheets can be edited. Submitted or approved sheets cannot be modified.',
      });
    }

    // Role check
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'teamAssistant') {
        return res.status(403).json({
          success: false,
          message: 'Only team assistants and admins can update meeting sheets.',
        });
      }
      if (!req.user.team || meeting.team.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only update meeting sheets for your own team.',
        });
      }
    }

    const criteriaHelper = await loadMeetingCriteria();
    const { rows, date } = req.body;

    // Handle date update if provided
    if (date) {
      const normalizedDate = normalizeMeetingDate(date);
      if (!normalizedDate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid meeting date format.',
        });
      }
      if (normalizedDate.getTime() !== meeting.date.getTime()) {
        const conflict = await Meeting.findOne({
          team: meeting.team,
          date: normalizedDate,
          _id: { $ne: meeting._id },
        });
        if (conflict) {
          return res.status(409).json({
            success: false,
            message: 'Another meeting sheet already exists for this team on the new date.',
          });
        }
        meeting.date = normalizedDate;
        meeting.weekNumber = getWeekNumber(normalizedDate);
        meeting.month = normalizedDate.getUTCMonth() + 1;
        meeting.year = normalizedDate.getUTCFullYear();
      }
    }

    if (rows && Array.isArray(rows)) {
      // Validate every row
      for (let i = 0; i < rows.length; i++) {
        const rowErrors = validateMeetingRow(rows[i], criteriaHelper);
        if (rowErrors.length > 0) {
          return res.status(400).json({
            success: false,
            message: `Validation error at row ${i + 1}: ${rowErrors.join(', ')}`,
          });
        }
      }

      meeting.rows = rows.map((r) => ({
        member: r.member,
        arrivalTime: typeof r.arrivalTime === 'string' ? r.arrivalTime.trim() : '',
        attendance: r.attendance || 'present',
        walkedOut: Boolean(r.walkedOut),
        attire: r.attire || 'none',
        activities: (r.activities || []).map((a) => ({
          criteria: a.criteria?._id || a.criteria,
          quantity: Number(a.quantity) || 1,
        })),
      }));
    }

    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('team', 'name')
      .populate('createdBy', 'name username role')
      .populate('submittedBy', 'name username role')
      .populate('approvedBy', 'name username role')
      .populate('rows.member', 'name username role phone')
      .populate('rows.activities.criteria', 'key name points category basisLabel needsProof');

    const summary = deriveMeetingSummary(populated.rows, criteriaHelper);

    res.status(200).json({
      success: true,
      message: 'Meeting sheet updated successfully.',
      data: {
        ...populated.toObject(),
        summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit meeting sheet: derive and insert pending PointEntries
 * @route   POST /api/meetings/:id/submit
 * @access  Private (teamAssistant for own team, or admin)
 */
exports.submitMeeting = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id).session(session);
    if (!meeting) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    if (meeting.status !== 'draft') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Meeting sheet cannot be submitted because it is currently "${meeting.status}".`,
      });
    }

    // Role check
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'teamAssistant') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only team assistants and admins can submit meeting sheets.',
        });
      }
      if (!req.user.team || meeting.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You can only submit meeting sheets for your own team.',
        });
      }
    }

    const criteriaHelper = await loadMeetingCriteria();

    // Validate all rows
    for (let i = 0; i < meeting.rows.length; i++) {
      const rowErrors = validateMeetingRow(meeting.rows[i], criteriaHelper);
      if (rowErrors.length > 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Validation error at row ${i + 1}: ${rowErrors.join(', ')}`,
        });
      }
    }

    // 1. Delete any existing pending PointEntries for this meeting (e.g. from prior submission)
    // Never delete approved entries!
    await PointEntry.deleteMany(
      { meeting: meeting._id, status: 'pending' },
      { session }
    );

    // 2. Derive items for each row
    const summary = deriveMeetingSummary(meeting.rows, criteriaHelper);
    const createdEntries = [];
    const auditLogs = [];

    const dateStr = meeting.date.toISOString().split('T')[0];

    for (const derivedRow of summary.rows) {
      for (const item of derivedRow.items) {
        const critDoc = item.criteria;
        const memberId = derivedRow.member?._id || derivedRow.member;

        // Check if member already has an approved entry for this criteria in the same week
        const frequency = critDoc.frequency || 'weekly';
        const duplicateQuery = {
          member: memberId,
          criteria: critDoc._id,
          year: meeting.year,
          isReversal: false,
          isAdminAdjustment: false,
          status: 'approved',
          meeting: { $ne: meeting._id },
        };
        if (frequency === 'monthly') {
          duplicateQuery.month = meeting.month;
        } else {
          duplicateQuery.weekNumber = meeting.weekNumber;
        }

        const existingApproved = await PointEntry.findOne(duplicateQuery).session(session);
        if (existingApproved) {
          await session.abortTransaction();
          return res.status(409).json({
            success: false,
            message: `Duplicate conflict: Member already has an approved entry for "${critDoc.name}" in this ${frequency}.`,
          });
        }

        const pointEntry = new PointEntry({
          member: memberId,
          team: meeting.team,
          criteria: critDoc._id,
          quantity: item.quantity || 1,
          points: item.points,
          date: meeting.date,
          weekNumber: meeting.weekNumber,
          month: meeting.month,
          year: meeting.year,
          frequency,
          status: 'pending',
          enteredBy: req.user._id,
          source: 'meeting_sheet',
          meeting: meeting._id,
          note: `Meeting attendance sheet for ${dateStr} (${item.name})`,
        });

        await pointEntry.save({ session });
        createdEntries.push(pointEntry);

        auditLogs.push({
          action: 'ENTRY_CREATE',
          targetType: 'PointEntry',
          targetId: pointEntry._id,
          performedBy: req.user._id,
          previousStatus: null,
          newStatus: 'pending',
          points: pointEntry.points,
          reason: 'Meeting attendance sheet submission',
          metadata: {
            meetingId: meeting._id,
            criteriaKey: critDoc.key,
            member: memberId,
          },
        });
      }
    }

    if (auditLogs.length > 0) {
      await AuditLog.insertMany(auditLogs, { session });
    }

    // 3. Update meeting status to submitted
    meeting.status = 'submitted';
    meeting.submittedBy = req.user._id;
    meeting.submittedAt = new Date();
    meeting.sendBackReason = null;
    await meeting.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Meeting sheet submitted successfully with ${createdEntries.length} point entries generated for review.`,
      data: meeting,
      entriesCount: createdEntries.length,
    });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key error: An active entry already exists for one or more members with this criteria in this period.',
      });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Approve meeting sheet and pending PointEntries
 * @route   POST /api/meetings/:id/approve
 * @access  Private (teamHead for own team, or admin)
 */
exports.approveMeeting = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id).session(session);
    if (!meeting) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    if (meeting.status !== 'submitted') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Meeting sheet cannot be approved because it is currently "${meeting.status}". Only submitted sheets can be approved.`,
      });
    }

    const userRole = req.user.role;
    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only team heads and admins can approve meeting sheets.',
        });
      }
      if (!req.user.team || meeting.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You can only approve meeting sheets for your own team.',
        });
      }
    }

    // Find all pending entries for this meeting
    const pendingEntries = await PointEntry.find({
      meeting: meeting._id,
      status: 'pending',
    }).session(session);

    let approvedCount = 0;
    let skippedSelfCount = 0;
    const now = new Date();
    const auditLogs = [];

    for (const entry of pendingEntries) {
      // Check self-approval: teamHead cannot approve their own entry or an entry they entered
      if (userRole === 'teamHead') {
        const isSelfMember = entry.member.toString() === req.user._id.toString();
        const isSelfSubmitter = entry.enteredBy.toString() === req.user._id.toString();

        if (isSelfMember || isSelfSubmitter) {
          skippedSelfCount += 1;
          continue; // Leave pending for Admin approval
        }
      }

      entry.status = 'approved';
      entry.approvedBy = req.user._id;
      entry.approvedAt = now;
      await entry.save({ session });
      approvedCount += 1;

      auditLogs.push({
        action: 'ENTRY_APPROVE',
        targetType: 'PointEntry',
        targetId: entry._id,
        performedBy: req.user._id,
        previousStatus: 'pending',
        newStatus: 'approved',
        points: entry.points,
        reason: 'Meeting sheet approval',
        metadata: {
          meetingId: meeting._id,
          approvedAt: now,
        },
      });
    }

    if (auditLogs.length > 0) {
      await AuditLog.insertMany(auditLogs, { session });
    }

    // Check remaining pending entries for this meeting
    const remainingPendingCount = await PointEntry.countDocuments({
      meeting: meeting._id,
      status: 'pending',
    }).session(session);

    let needsAdmin = false;
    let responseMessage = 'Meeting attendance sheet approved successfully.';

    if (remainingPendingCount === 0) {
      meeting.status = 'approved';
      meeting.approvedBy = req.user._id;
      meeting.approvedAt = now;
      await meeting.save({ session });
    } else {
      needsAdmin = true;
      responseMessage = `Approved ${approvedCount} entries. ${remainingPendingCount} entry requires admin approval due to self-approval rules.`;
      // Meeting stays 'submitted' until admin approves remaining
      await meeting.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: responseMessage,
      needsAdmin,
      approvedCount,
      remainingPendingCount,
      data: meeting,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Send back meeting sheet with reason
 * @route   POST /api/meetings/:id/send-back
 * @access  Private (teamHead for own team, or admin)
 */
exports.sendBackMeeting = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id).session(session);
    if (!meeting) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    if (meeting.status !== 'submitted') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Meeting sheet cannot be sent back because it is currently "${meeting.status}". Only submitted sheets can be sent back.`,
      });
    }

    const userRole = req.user.role;
    if (userRole !== 'admin') {
      if (userRole !== 'teamHead') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Only team heads and admins can send back meeting sheets.',
        });
      }
      if (!req.user.team || meeting.team.toString() !== req.user.team.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'You can only send back meeting sheets for your own team.',
        });
      }
    }

    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'A send-back reason is mandatory.',
      });
    }

    // Delete pending PointEntries for this meeting
    await PointEntry.deleteMany(
      { meeting: meeting._id, status: 'pending' },
      { session }
    );

    meeting.status = 'draft';
    meeting.sendBackReason = reason.trim();
    await meeting.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Meeting sheet sent back to draft.',
      data: meeting,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Preview calculated points breakdown without saving
 * @route   GET /api/meetings/:id/preview
 * @access  Private (teamAssistant, teamHead of own team, or admin)
 */
exports.previewMeeting = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    const meeting = await Meeting.findById(req.params.id)
      .populate('team', 'name')
      .populate('rows.member', 'name username role phone')
      .populate('rows.activities.criteria', 'key name points category basisLabel needsProof');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting sheet not found.',
      });
    }

    if (req.user.role !== 'admin') {
      if (!req.user.team || meeting.team._id.toString() !== req.user.team.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only preview meeting sheets for your own team.',
        });
      }
    }

    const criteriaHelper = await loadMeetingCriteria();
    const summary = deriveMeetingSummary(meeting.rows, criteriaHelper);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

