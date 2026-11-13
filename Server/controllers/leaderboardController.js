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
 * Assign standard competition ranks (1, 2, 2, 4)
 */
const assignRanks = (items) => {
  let currentRank = 1;
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && items[i].total < items[i - 1].total) {
      currentRank = i + 1;
    }
    items[i].rank = currentRank;
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

    const targetYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const targetMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
    const targetWeek = req.query.week ? parseInt(req.query.week, 10) : getWeekNumber(now);

    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      return res.status(400).json({ success: false, message: 'Invalid year.' });
    }
    if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month (1-12).' });
    }
    if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 53) {
      return res.status(400).json({ success: false, message: 'Invalid week number (1-53).' });
    }

    // Build PointEntry match conditions for $lookup
    const pointEntryMatchConditions = [
      { $eq: ['$team', '$$teamId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'week') {
      pointEntryMatchConditions.push(
        { $eq: ['$year', targetYear] },
        { $eq: ['$weekNumber', targetWeek] }
      );
    } else if (period === 'month') {
      pointEntryMatchConditions.push(
        { $eq: ['$year', targetYear] },
        { $eq: ['$month', targetMonth] }
      );
    }

    // TeamPointEntry match conditions (team-level bonus points not included in weekly period)
    const teamPointMatchConditions = [
      { $eq: ['$team', '$$teamId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'month') {
      teamPointMatchConditions.push(
        { $eq: ['$year', targetYear] },
        { $eq: ['$month', targetMonth] }
      );
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

    pipeline.push(
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
        },
      },
      {
        $addFields: {
          total: { $add: ['$memberPoints', '$teamPoints', '$penalties'] },
        },
      },
      {
        $sort: { total: -1, name: 1 },
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

    const targetYear = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
    const targetMonth = req.query.month ? parseInt(req.query.month, 10) : now.getMonth() + 1;
    const targetWeek = req.query.week ? parseInt(req.query.week, 10) : getWeekNumber(now);

    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      return res.status(400).json({ success: false, message: 'Invalid year.' });
    }
    if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month (1-12).' });
    }
    if (isNaN(targetWeek) || targetWeek < 1 || targetWeek > 53) {
      return res.status(400).json({ success: false, message: 'Invalid week number (1-53).' });
    }

    // Filter active users, exclude admins
    const userMatch = {
      isActive: true,
      role: { $ne: 'admin' },
    };

    if (req.query.team) {
      if (!mongoose.Types.ObjectId.isValid(req.query.team)) {
        return res.status(400).json({ success: false, message: 'Invalid team ID format.' });
      }
      userMatch.team = new mongoose.Types.ObjectId(req.query.team);
    }

    // Match conditions for member PointEntries
    const pointMatchConditions = [
      { $eq: ['$member', '$$userId'] },
      { $eq: ['$status', 'approved'] },
    ];

    if (period === 'week') {
      pointMatchConditions.push(
        { $eq: ['$year', targetYear] },
        { $eq: ['$weekNumber', targetWeek] }
      );
    } else if (period === 'month') {
      pointMatchConditions.push(
        { $eq: ['$year', targetYear] },
        { $eq: ['$month', targetMonth] }
      );
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
      data: rankedMembers,
    });
  } catch (error) {
    next(error);
  }
};
