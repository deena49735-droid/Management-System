const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');

/**
 * Helper to calculate ISO week number
 */
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
};

/**
 * Helper to resolve period dates, bounds, week number, month, and year from query parameters.
 * Supports date='YYYY-MM-DD' query as well as year, month, week queries.
 */
const resolvePeriodDates = (query, now = new Date()) => {
  let targetYear, targetMonth, targetDay, targetDate;

  if (typeof query.date === 'string' && query.date.trim().length > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date.trim())) {
      const err = new Error('Invalid date provided. Format must be YYYY-MM-DD.');
      err.statusCode = 400;
      throw err;
    }
    const parts = query.date.trim().split('-').map(Number);
    targetYear = parts[0];
    targetMonth = parts[1]; // 1-12
    targetDay = parts[2];
    targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
  } else {
    targetYear = query.year ? parseInt(query.year, 10) : now.getFullYear();
    targetMonth = query.month ? parseInt(query.month, 10) : now.getMonth() + 1;
    targetDay = query.day ? parseInt(query.day, 10) : now.getDate();
    targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
  }

  if (isNaN(targetDate.getTime()) || isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
    const err = new Error('Invalid date or year.');
    err.statusCode = 400;
    throw err;
  }

  let targetWeek = query.week ? parseInt(query.week, 10) : getWeekNumber(targetDate);
  if (query.date && !query.week) {
    targetWeek = getWeekNumber(targetDate);
  }

  if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    const err = new Error('Invalid month (1-12).');
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 53) {
    const err = new Error('Invalid week number (1-53).');
    err.statusCode = 400;
    throw err;
  }

  // Calculate Monday-to-Sunday week bounds
  let startOfWeek, endOfWeek;
  if (query.date && !query.week) {
    const dayOfWeek = targetDate.getUTCDay() || 7; // 1 = Monday ... 7 = Sunday
    startOfWeek = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - (dayOfWeek - 1), 0, 0, 0, 0));
    endOfWeek = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + (7 - dayOfWeek), 23, 59, 59, 999));
  } else {
    // Derive from targetYear and targetWeek (ISO week calculation)
    const jan4 = new Date(Date.UTC(targetYear, 0, 4));
    const dayNum = jan4.getUTCDay() || 7;
    startOfWeek = new Date(jan4.getTime() + ((targetWeek - 1) * 7 + (1 - dayNum)) * 86400000);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
    endOfWeek.setUTCHours(23, 59, 59, 999);
  }

  // Calculate Month bounds
  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const endOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, lastDayOfMonth, 23, 59, 59, 999));

  return {
    targetYear,
    targetMonth,
    targetDay,
    targetWeek,
    targetDate,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    selectedDateStr: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`,
  };
};

/**
 * Assign standard competition ranks based on unrounded average points per member,
 * with total points, member count, and team name as stable tie-breakers.
 */
const assignRanks = (items) => {
  items.sort((a, b) => {
    const aAvg = Number(a.average) || 0;
    const bAvg = Number(b.average) || 0;
    const diffAvg = bAvg - aAvg;
    if (Math.abs(diffAvg) > 1e-9) {
      return diffAvg;
    }
    const aTotal = Number(a.total) || 0;
    const bTotal = Number(b.total) || 0;
    const diffTotal = bTotal - aTotal;
    if (diffTotal !== 0) {
      return diffTotal;
    }
    const aMembers = Number(a.memberCount) || 0;
    const bMembers = Number(b.memberCount) || 0;
    const diffMembers = bMembers - aMembers;
    if (diffMembers !== 0) {
      return diffMembers;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  let currentRank = 1;
  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const prev = items[i - 1];
      const curr = items[i];
      const prevAvg = Number(prev.average) || 0;
      const currAvg = Number(curr.average) || 0;
      const avgDiff = Math.abs(currAvg - prevAvg);
      const sameTotal = (Number(curr.total) || 0) === (Number(prev.total) || 0);

      // If average differs or total differs, rank increments to standard competition rank
      if (avgDiff > 1e-9 || !sameTotal) {
        currentRank = i + 1;
      }
    }
    items[i].rank = currentRank;

    const rawAvg = items[i].memberCount > 0 ? (items[i].total / items[i].memberCount) : 0;
    items[i].average = rawAvg;
    items[i].averageRounded = Number(rawAvg.toFixed(2));
  }
  return items;
};

/**
 * @desc    Get team leaderboard
 * @route   GET /api/leaderboard/teams
 * @access  Private (all roles)
 */
exports.getTeamLeaderboard = async (req, res, next) => {
  try {
    const now = new Date();
    const period = req.query.period || 'month';

    if (!['week', 'month', 'all'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Period must be 'week', 'month', or 'all'.",
      });
    }

    let dates;
    try {
      dates = resolvePeriodDates(req.query, now);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }

    const {
      targetYear,
      targetMonth,
      targetWeek,
      startOfWeek,
      endOfWeek,
      startOfMonth,
      endOfMonth,
      selectedDateStr,
    } = dates;

    // Determine period end date for historical membership checks
    let periodEnd = null;
    if (period === 'week') {
      periodEnd = endOfWeek;
    } else if (period === 'month') {
      periodEnd = endOfMonth;
    }

    // Build PointEntry match conditions for $lookup
    const pointEntryMatchConditions = [
      { $eq: ['$team', '$$teamId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'week') {
      const weekYears = [startOfWeek.getUTCFullYear(), endOfWeek.getUTCFullYear()];
      pointEntryMatchConditions.push({
        $or: [
          { $and: [{ $gte: ['$date', startOfWeek] }, { $lte: ['$date', endOfWeek] }] },
          { $and: [{ $eq: ['$weekNumber', targetWeek] }, { $in: ['$year', weekYears] }] },
        ],
      });
    } else if (period === 'month') {
      pointEntryMatchConditions.push({
        $or: [
          { $and: [{ $gte: ['$date', startOfMonth] }, { $lte: ['$date', endOfMonth] }] },
          { $and: [{ $eq: ['$month', targetMonth] }, { $eq: ['$year', targetYear] }] },
        ],
      });
    }

    // TeamPointEntry match conditions (team-level bonus points not included in weekly period)
    const teamPointMatchConditions = [
      { $eq: ['$team', '$$teamId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'month') {
      teamPointMatchConditions.push({
        $or: [
          { $and: [{ $gte: ['$date', startOfMonth] }, { $lte: ['$date', endOfMonth] }] },
          { $and: [{ $eq: ['$month', targetMonth] }, { $eq: ['$year', targetYear] }] },
        ],
      });
    }

    const pipeline = [
      { $match: { isActive: true } },
      {
        $lookup: {
          from: PointEntry.collection.name,
          let: { teamId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: pointEntryMatchConditions,
                },
              },
            },
            {
              $group: {
                _id: null,
                memberPoints: {
                  $sum: { $cond: [{ $gt: ['$points', 0] }, '$points', 0] },
                },
                penalties: {
                  $sum: { $cond: [{ $lt: ['$points', 0] }, '$points', 0] },
                },
              },
            },
          ],
          as: 'pointData',
        },
      },
    ];

    if (period !== 'week') {
      pipeline.push({
        $lookup: {
          from: TeamPointEntry.collection.name,
          let: { teamId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: teamPointMatchConditions,
                },
              },
            },
            {
              $group: {
                _id: null,
                teamPoints: { $sum: '$points' },
              },
            },
          ],
          as: 'teamPointData',
        },
      });
    }

    // Lookup eligible team members (active chapter members created on or before periodEnd)
    pipeline.push(
      {
        $lookup: {
          from: User.collection.name,
          let: { teamId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$team', '$$teamId'] },
                    { $eq: ['$isActive', true] },
                    { $ne: ['$role', 'admin'] },
                    ...(periodEnd ? [{ $lte: ['$createdAt', periodEnd] }] : []),
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'activeMembers',
        },
      },
      // Lookup distinct members with approved point entries for this team in this period
      {
        $lookup: {
          from: PointEntry.collection.name,
          let: { teamId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: pointEntryMatchConditions,
                },
              },
            },
            { $group: { _id: '$member' } },
          ],
          as: 'periodPointMembers',
        },
      },
      {
        $project: {
          teamId: '$_id',
          name: 1,
          memberPoints: {
            $ifNull: [{ $arrayElemAt: ['$pointData.memberPoints', 0] }, 0],
          },
          penalties: {
            $ifNull: [{ $arrayElemAt: ['$pointData.penalties', 0] }, 0],
          },
          teamPoints:
            period !== 'week'
              ? { $ifNull: [{ $arrayElemAt: ['$teamPointData.teamPoints', 0] }, 0] }
              : { $literal: 0 },
          eligibleMemberIds: {
            $setUnion: [
              { $map: { input: '$activeMembers', as: 'm', in: '$$m._id' } },
              { $map: { input: '$periodPointMembers', as: 'p', in: '$$p._id' } },
            ],
          },
        },
      },
      {
        $addFields: {
          memberCount: { $size: { $ifNull: ['$eligibleMemberIds', []] } },
          total: { $add: ['$memberPoints', '$teamPoints', '$penalties'] },
        },
      },
      {
        $addFields: {
          average: {
            $cond: [
              { $gt: ['$memberCount', 0] },
              { $divide: ['$total', '$memberCount'] },
              0,
            ],
          },
          averageRounded: {
            $cond: [
              { $gt: ['$memberCount', 0] },
              { $round: [{ $divide: ['$total', '$memberCount'] }, 2] },
              0,
            ],
          },
        },
      }
    );

    const rawTeams = await Team.aggregate(pipeline);
    const rankedTeams = assignRanks(rawTeams);

    res.status(200).json({
      success: true,
      period,
      year: targetYear,
      month: targetMonth,
      week: targetWeek,
      date: selectedDateStr,
      startDate: period === 'week' ? startOfWeek.toISOString().split('T')[0] : (period === 'month' ? startOfMonth.toISOString().split('T')[0] : null),
      endDate: period === 'week' ? endOfWeek.toISOString().split('T')[0] : (period === 'month' ? endOfMonth.toISOString().split('T')[0] : null),
      data: rankedTeams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get member leaderboard
 * @route   GET /api/leaderboard/members
 * @access  Private (all roles)
 */
exports.getMemberLeaderboard = async (req, res, next) => {
  try {
    const now = new Date();
    const period = req.query.period || 'month';

    if (!['week', 'month', 'all'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Period must be 'week', 'month', or 'all'.",
      });
    }

    let dates;
    try {
      dates = resolvePeriodDates(req.query, now);
    } catch (err) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }

    const {
      targetYear,
      targetMonth,
      targetWeek,
      startOfWeek,
      endOfWeek,
      startOfMonth,
      endOfMonth,
      selectedDateStr,
    } = dates;

    // Filter active users, exclude admins
    const userMatch = {
      isActive: true,
      role: { $ne: 'admin' },
    };

    if (req.query.team) {
      if (!mongoose.Types.ObjectId.isValid(req.query.team)) {
        return res.status(400).json({ success: false, message: 'Invalid team ID format.' });
      }

      // Enforce team boundary for non-admin users:
      // Team Head, Team Assistant, and Member cannot query another team's member data
      if (req.user && req.user.role !== 'admin') {
        const userTeamId = req.user.team?._id ? req.user.team._id.toString() : req.user.team?.toString();
        if (!userTeamId || req.query.team.toString() !== userTeamId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view member scores for your assigned team.',
          });
        }
      }

      userMatch.team = new mongoose.Types.ObjectId(req.query.team);
    }

    // Match conditions for member PointEntries
    const pointMatchConditions = [
      { $eq: ['$member', '$$userId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'week') {
      const weekYears = [startOfWeek.getUTCFullYear(), endOfWeek.getUTCFullYear()];
      pointMatchConditions.push({
        $or: [
          { $and: [{ $gte: ['$date', startOfWeek] }, { $lte: ['$date', endOfWeek] }] },
          { $and: [{ $eq: ['$weekNumber', targetWeek] }, { $in: ['$year', weekYears] }] },
        ],
      });
    } else if (period === 'month') {
      pointMatchConditions.push({
        $or: [
          { $and: [{ $gte: ['$date', startOfMonth] }, { $lte: ['$date', endOfMonth] }] },
          { $and: [{ $eq: ['$month', targetMonth] }, { $eq: ['$year', targetYear] }] },
        ],
      });
    }

    const pipeline = [
      { $match: userMatch },
      {
        $lookup: {
          from: PointEntry.collection.name,
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: pointMatchConditions,
                },
              },
            },
            {
              $group: {
                _id: null,
                rewards: {
                  $sum: { $cond: [{ $gt: ['$points', 0] }, '$points', 0] },
                },
                penalties: {
                  $sum: { $cond: [{ $lt: ['$points', 0] }, '$points', 0] },
                },
              },
            },
          ],
          as: 'pointData',
        },
      },
      {
        $lookup: {
          from: Team.collection.name,
          localField: 'team',
          foreignField: '_id',
          as: 'teamDoc',
        },
      },
      {
        $project: {
          userId: '$_id',
          name: 1,
          username: 1,
          role: 1,
          teamId: '$team',
          team: { $ifNull: [{ $arrayElemAt: ['$teamDoc.name', 0] }, 'Unassigned'] },
          rewards: {
            $ifNull: [{ $arrayElemAt: ['$pointData.rewards', 0] }, 0],
          },
          penalties: {
            $ifNull: [{ $arrayElemAt: ['$pointData.penalties', 0] }, 0],
          },
        },
      },
      {
        $addFields: {
          total: { $add: ['$rewards', '$penalties'] },
        },
      },
      {
        $sort: { total: -1, name: 1 },
      },
    ];

    const rawMembers = await User.aggregate(pipeline);
    const rankedMembers = assignRanks(rawMembers);

    res.status(200).json({
      success: true,
      period,
      year: targetYear,
      month: targetMonth,
      week: targetWeek,
      date: selectedDateStr,
      startDate: period === 'week' ? startOfWeek.toISOString().split('T')[0] : (period === 'month' ? startOfMonth.toISOString().split('T')[0] : null),
      endDate: period === 'week' ? endOfWeek.toISOString().split('T')[0] : (period === 'month' ? endOfMonth.toISOString().split('T')[0] : null),
      data: rankedMembers,
    });
  } catch (error) {
    next(error);
  }
};
