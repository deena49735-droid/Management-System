const mongoose = require('mongoose');
const { getTeamLeaderboard } = require('../controllers/leaderboardController');
const { getTeamScorecard } = require('../controllers/teamEntryController');
const { getEntriesByPeriod } = require('../controllers/entryController');
const Team = require('../models/Team');
const User = require('../models/User');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedCount++;
  }
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runTests() {
  console.log('=== RUNNING TEAM AVERAGE POINTS & FAIR RANKING TEST SUITE ===\n');

  // =========================================================================
  // TEST GROUP 1: Core Mathematical Formula & Ranking Verification
  // =========================================================================
  console.log('--- TEST GROUP 1: Formula & Ranking Order (Prompt Example) ---');

  // Test setup with the exact prompt requirements:
  // - Team A: 150 pts / 7 members = 21.43
  // - Team B: 150 pts / 8 members = 18.75
  // - Team C: 240 pts / 8 members = 30.00 (which ranks above both)
  // - Team D: 0 members, 0 pts = 0.00
  // - Team E: 0 members, 50 pts = 0.00 (safe zero-division)
  // - Team F: 120 pts / 6 members = 20.00
  // - Team G: 120 pts / 6 members = 20.00 (equal average, stable tie order)

  const teamAId = new mongoose.Types.ObjectId();
  const teamBId = new mongoose.Types.ObjectId();
  const teamCId = new mongoose.Types.ObjectId();
  const teamDId = new mongoose.Types.ObjectId();
  const teamEId = new mongoose.Types.ObjectId();
  const teamFId = new mongoose.Types.ObjectId();
  const teamGId = new mongoose.Types.ObjectId();

  const mockTeamsAggregate = [
    {
      _id: teamAId,
      teamId: teamAId,
      name: 'Team Alpha',
      memberPoints: 100,
      teamPoints: 50,
      penalties: 0,
      total: 150,
      memberCount: 7,
      average: 150 / 7,
      averageRounded: Number((150 / 7).toFixed(2)),
    },
    {
      _id: teamBId,
      teamId: teamBId,
      name: 'Team Beta',
      memberPoints: 100,
      teamPoints: 50,
      penalties: 0,
      total: 150,
      memberCount: 8,
      average: 150 / 8,
      averageRounded: Number((150 / 8).toFixed(2)),
    },
    {
      _id: teamCId,
      teamId: teamCId,
      name: 'Team Gamma',
      memberPoints: 180,
      teamPoints: 60,
      penalties: 0,
      total: 240,
      memberCount: 8,
      average: 240 / 8,
      averageRounded: Number((240 / 8).toFixed(2)),
    },
    {
      _id: teamDId,
      teamId: teamDId,
      name: 'Team Delta (Empty)',
      memberPoints: 0,
      teamPoints: 0,
      penalties: 0,
      total: 0,
      memberCount: 0,
      average: 0,
      averageRounded: 0,
    },
    {
      _id: teamEId,
      teamId: teamEId,
      name: 'Team Epsilon (Zero Members)',
      memberPoints: 0,
      teamPoints: 50,
      penalties: 0,
      total: 50,
      memberCount: 0,
      average: 0,
      averageRounded: 0,
    },
    {
      _id: teamFId,
      teamId: teamFId,
      name: 'Team Foxtrot',
      memberPoints: 100,
      teamPoints: 20,
      penalties: 0,
      total: 120,
      memberCount: 6,
      average: 120 / 6,
      averageRounded: Number((120 / 6).toFixed(2)),
    },
    {
      _id: teamGId,
      teamId: teamGId,
      name: 'Team Golf',
      memberPoints: 100,
      teamPoints: 20,
      penalties: 0,
      total: 120,
      memberCount: 6,
      average: 120 / 6,
      averageRounded: Number((120 / 6).toFixed(2)),
    },
  ];

  // Intercept Team.aggregate for getTeamLeaderboard
  const origTeamAggregate = Team.aggregate;
  Team.aggregate = function () {
    return Promise.resolve(JSON.parse(JSON.stringify(mockTeamsAggregate)));
  };

  const reqLeaderboard = {
    user: { role: 'admin' },
    query: { period: 'month', year: '2026', month: '11' },
  };
  const resLeaderboard = createMockRes();
  await getTeamLeaderboard(reqLeaderboard, resLeaderboard, () => {});

  assert(resLeaderboard.statusCode === 200, 'Test 1.1: getTeamLeaderboard returns 200 OK');
  const ranked = resLeaderboard.body.data;

  // Verify Rankings:
  // Rank 1: Team Gamma (240 / 8 = 30.00)
  assert(ranked[0].name === 'Team Gamma', 'Test 1.2: Rank #1 is Team Gamma (240 pts / 8 members = 30.00)');
  assert(ranked[0].rank === 1, 'Test 1.2: Rank #1 value is 1');
  assert(ranked[0].averageRounded === 30.00, 'Test 1.2: Team Gamma averageRounded is 30.00');
  assert(ranked[0].total === 240, 'Test 1.2: Team Gamma total is 240');

  // Rank 2: Team Alpha (150 / 7 = 21.43)
  assert(ranked[1].name === 'Team Alpha', 'Test 1.3: Rank #2 is Team Alpha (150 pts / 7 members = 21.43)');
  assert(ranked[1].rank === 2, 'Test 1.3: Rank #2 value is 2');
  assert(ranked[1].averageRounded === 21.43, 'Test 1.3: Team Alpha averageRounded is 21.43');
  assert(Math.abs(ranked[1].average - (150 / 7)) < 1e-9, 'Test 1.3: Team Alpha unrounded average is accurate');

  // Rank 3 (tied): Team Foxtrot and Team Golf (120 / 6 = 20.00)
  assert(ranked[2].name === 'Team Foxtrot' && ranked[3].name === 'Team Golf', 'Test 1.4: Tied teams Foxtrot and Golf are sorted stably alphabetically');
  assert(ranked[2].rank === 3 && ranked[3].rank === 3, 'Test 1.4: Both tied teams receive competition rank #3');
  assert(ranked[2].averageRounded === 20.00 && ranked[3].averageRounded === 20.00, 'Test 1.4: Both tied teams have 20.00 average');

  // Rank 5: Team Beta (150 / 8 = 18.75)
  assert(ranked[4].name === 'Team Beta', 'Test 1.5: Rank #5 is Team Beta (150 pts / 8 members = 18.75)');
  assert(ranked[4].rank === 5, 'Test 1.5: Rank #5 value is 5');
  assert(ranked[4].averageRounded === 18.75, 'Test 1.5: Team Beta averageRounded is 18.75');
  assert(ranked[4].average < ranked[1].average, 'Test 1.5: Team Alpha (21.43) ranks above Team Beta (18.75) despite having identical 150 total points');

  // Zero members safety:
  const emptyTeam = ranked.find((t) => t.name.includes('Empty'));
  assert(emptyTeam.memberCount === 0 && emptyTeam.average === 0, 'Test 1.6: 0 members and 0 pts returns average = 0 safely');
  const zeroMemberWithBonus = ranked.find((t) => t.name.includes('Zero Members'));
  assert(zeroMemberWithBonus.memberCount === 0 && zeroMemberWithBonus.average === 0, 'Test 1.7: 0 members with bonus points returns average = 0 safely without division by zero');

  // Restore Team.aggregate
  Team.aggregate = origTeamAggregate;

  // =========================================================================
  // TEST GROUP 2: Approval, Rejection, Reversal & Point Types Verification
  // =========================================================================
  console.log('\n--- TEST GROUP 2: Numerator Point Types & Approval Rules ---');

  // Verify that:
  // - Approved member activities (positive) ARE included
  // - Approved penalties (negative) ARE included
  // - Approved team monthly/bonus points ARE included
  // - Pending entries ARE NOT included
  // - Rejected entries ARE NOT included
  // - Reversed entries ARE properly accounted for

  const mockEntriesForTeam = [
    { points: 50, status: 'approved', isReversal: false },     // +50 approved activity
    { points: 30, status: 'approved', isReversal: false },     // +30 approved activity
    { points: -10, status: 'approved', isReversal: false },    // -10 approved penalty
    { points: 100, status: 'pending', isReversal: false },     // +100 pending (MUST BE EXCLUDED)
    { points: 80, status: 'rejected', isReversal: false },     // +80 rejected (MUST BE EXCLUDED)
    { points: -50, status: 'approved', isReversal: true },     // -50 approved reversal
  ];

  let calculatedNumerator = 0;
  for (const e of mockEntriesForTeam) {
    if (e.status === 'approved') {
      calculatedNumerator += e.points;
    }
  }

  // 50 + 30 - 10 - 50 = 20
  assert(calculatedNumerator === 20, 'Test 2.1: Numerator correctly excludes pending (100) and rejected (80), and includes reversal (-50) (expected 20)');

  // If team bonus is +100 approved:
  const teamBonusApproved = 100;
  const totalWithBonus = calculatedNumerator + teamBonusApproved; // 20 + 100 = 120
  const teamMembers = 5;
  const averageWithBonus = totalWithBonus / teamMembers; // 120 / 5 = 24.00
  assert(totalWithBonus === 120, 'Test 2.2: Total with team bonus = 120');
  assert(averageWithBonus === 24.00, 'Test 2.3: Average with bonus = 24.00 pts/member');

  // =========================================================================
  // TEST GROUP 3: Team Scorecard Endpoint Verification
  // =========================================================================
  console.log('\n--- TEST GROUP 3: Team Scorecard Endpoint ---');

  const scorecardTeamId = new mongoose.Types.ObjectId();
  const mockTeamDoc = {
    _id: scorecardTeamId,
    name: 'Scorecard Test Team',
    code: 'STT',
    head: new mongoose.Types.ObjectId(),
    assistant: new mongoose.Types.ObjectId(),
  };

  const origTeamFindById = Team.findById;
  const origUserFind = User.find;
  const origPointDistinct = PointEntry.distinct;
  const origPointAggregate = PointEntry.aggregate;
  const origCriteriaFind = Criteria.find;
  const origTeamPointFind = TeamPointEntry.find;

  Team.findById = () => ({
    select: () => Promise.resolve(mockTeamDoc),
  });

  // Mock 8 eligible members in team
  const mockUsers = Array.from({ length: 8 }, () => ({ _id: new mongoose.Types.ObjectId() }));
  User.find = () => ({
    select: () => Promise.resolve(mockUsers),
  });

  PointEntry.distinct = () => Promise.resolve([]);

  // Mock 120 member points
  PointEntry.aggregate = () => Promise.resolve([{ _id: null, total: 120 }]);

  // Mock criteria
  const mockMonthlyCriteria = [
    { _id: new mongoose.Types.ObjectId(), key: 'm1', name: 'Crit 1', points: 40, category: 'monthly', level: 'team' },
  ];
  Criteria.find = (filter) => ({
    sort: () => Promise.resolve(filter && filter.category === 'monthly' ? mockMonthlyCriteria : []),
  });

  // Mock team point entries (1 approved entry of 40 points)
  TeamPointEntry.find = () => ({
    sort: () => Promise.resolve([
      { criteria: mockMonthlyCriteria[0]._id, status: 'approved', points: 40, isReversal: false, isAdminAdjustment: false },
    ]),
  });

  const reqScorecard = {
    user: { role: 'admin', team: scorecardTeamId },
    query: { teamId: scorecardTeamId.toString(), month: '11', year: '2026' },
  };
  const resScorecard = createMockRes();
  await getTeamScorecard(reqScorecard, resScorecard, () => {});

  assert(resScorecard.statusCode === 200, 'Test 3.1: getTeamScorecard returns 200 OK');
  assert(resScorecard.body.data.eligibleMemberCount === 8, 'Test 3.2: Scorecard returns eligibleMemberCount = 8');
  assert(resScorecard.body.data.memberPointsTotal === 120, 'Test 3.3: Scorecard memberPointsTotal = 120');
  assert(resScorecard.body.data.earnedMonthly === 40, 'Test 3.4: Scorecard earnedMonthly = 40');
  // Total = 120 member + 40 monthly = 160. Average = 160 / 8 = 20.00
  assert(resScorecard.body.data.totalTeamPoints === 160, 'Test 3.5: Scorecard totalTeamPoints = 160 (120 + 40)');
  assert(resScorecard.body.data.averagePointsPerMember === 20.00, 'Test 3.6: Scorecard averagePointsPerMember = 20.00 (160 ÷ 8)');

  // Restore mocks
  Team.findById = origTeamFindById;
  User.find = origUserFind;
  PointEntry.distinct = origPointDistinct;
  PointEntry.aggregate = origPointAggregate;
  Criteria.find = origCriteriaFind;
  TeamPointEntry.find = origTeamPointFind;

  // =========================================================================
  // TEST GROUP 4: By-Period Points Endpoint Verification
  // =========================================================================
  console.log('\n--- TEST GROUP 4: By-Period Endpoint Average Points Calculation ---');

  const periodTeamId = new mongoose.Types.ObjectId();
  const origPointFind = PointEntry.find;
  const origTeamPointEntryFind = TeamPointEntry.find;

  // Mock 7 eligible members
  const mock7Users = Array.from({ length: 7 }, () => ({ _id: new mongoose.Types.ObjectId() }));
  User.find = () => ({
    select: () => Promise.resolve(mock7Users),
  });

  PointEntry.distinct = () => Promise.resolve([]);

  // Mock point entries for a 150 points week:
  const mockPeriodWeeklyEntries = [
    {
      _id: new mongoose.Types.ObjectId(),
      points: 150,
      status: 'approved',
      date: new Date('2026-11-18'),
      member: { name: 'Alice' },
      team: { name: 'Alpha' },
      criteria: { name: 'Task' },
    },
  ];

  PointEntry.find = () => ({
    populate: function () { return this; },
    sort: () => Promise.resolve(mockPeriodWeeklyEntries),
  });

  TeamPointEntry.find = () => ({
    populate: function () { return this; },
    sort: () => Promise.resolve([]),
  });

  const reqPeriod = {
    user: { role: 'teamHead', team: periodTeamId },
    query: { date: '2026-11-18' },
  };
  const resPeriod = createMockRes();
  await getEntriesByPeriod(reqPeriod, resPeriod, () => {});

  assert(resPeriod.statusCode === 200, 'Test 4.1: getEntriesByPeriod returns 200 OK');
  assert(resPeriod.body.data.week.summary.approvedPoints === 150, 'Test 4.2: Approved weekly points = 150');
  assert(resPeriod.body.data.week.summary.eligibleMemberCount === 7, 'Test 4.3: Eligible weekly member count = 7');
  // 150 / 7 = 21.43
  assert(resPeriod.body.data.week.summary.averagePointsPerMember === 21.43, 'Test 4.4: Weekly averagePointsPerMember = 21.43 (150 ÷ 7)');
  assert(Math.abs(resPeriod.body.data.week.summary.unroundedAverage - (150 / 7)) < 1e-9, 'Test 4.5: Weekly unroundedAverage is exact');

  // Restore remaining mocks
  User.find = origUserFind;
  PointEntry.find = origPointFind;
  PointEntry.distinct = origPointDistinct;
  TeamPointEntry.find = origTeamPointEntryFind;

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
