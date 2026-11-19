const mongoose = require('mongoose');
const { getTeamLeaderboard, getMemberLeaderboard } = require('../controllers/leaderboardController');
const Team = require('../models/Team');
const User = require('../models/User');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`);
    failed++;
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
  console.log('=== RUNNING LEADERBOARD DATE / CALENDAR SELECTION TESTS ===\n');

  const teamAId = new mongoose.Types.ObjectId();
  const teamBId = new mongoose.Types.ObjectId();
  const userA1Id = new mongoose.Types.ObjectId();
  const userA2Id = new mongoose.Types.ObjectId();
  const userB1Id = new mongoose.Types.ObjectId();

  const origTeamAggregate = Team.aggregate;
  const origUserAggregate = User.aggregate;

  try {
    // =========================================================================
    // TEST GROUP 1: Backward Compatibility & Current Date Mapping
    // =========================================================================
    console.log('--- TEST GROUP 1: Backward Compatibility & Parameter Mapping ---');

    let capturedTeamPipeline = null;
    Team.aggregate = function (pipeline) {
      capturedTeamPipeline = pipeline;
      return Promise.resolve([
        {
          teamId: teamAId,
          name: 'Team Alpha',
          memberPoints: 100,
          penalties: 0,
          teamPoints: 20,
          total: 120,
          memberCount: 6,
          average: 20,
          averageRounded: 20,
          rank: 1,
        },
        {
          teamId: teamBId,
          name: 'Team Beta',
          memberPoints: 60,
          penalties: -10,
          teamPoints: 0,
          total: 50,
          memberCount: 5,
          average: 10,
          averageRounded: 10,
          rank: 2,
        },
      ]);
    };

    // 1.1 Legacy call with year & month (no date parameter)
    const reqLegacy = {
      user: { role: 'member' },
      query: { period: 'month', year: '2026', month: '11' },
    };
    const resLegacy = createMockRes();
    await getTeamLeaderboard(reqLegacy, resLegacy, () => {});

    assert(resLegacy.statusCode === 200, 'Test 1.1: Legacy query without date returns 200 OK');
    assert(resLegacy.body.year === 2026, 'Test 1.1: Year resolved to 2026');
    assert(resLegacy.body.month === 11, 'Test 1.1: Month resolved to 11');
    assert(resLegacy.body.startDate === '2026-11-01', 'Test 1.1: Start date is 2026-11-01');
    assert(resLegacy.body.endDate === '2026-11-30', 'Test 1.1: End date is 2026-11-30');

    // 1.2 Call with date parameter: current date (2026-11-19)
    const reqCurrentDate = {
      user: { role: 'teamHead' },
      query: { period: 'week', date: '2026-11-19' },
    };
    const resCurrentDate = createMockRes();
    await getTeamLeaderboard(reqCurrentDate, resCurrentDate, () => {});

    assert(resCurrentDate.statusCode === 200, 'Test 1.2: Query with date returns 200 OK');
    assert(resCurrentDate.body.date === '2026-11-19', 'Test 1.2: Date echoed correctly in response');
    assert(resCurrentDate.body.week === 47, 'Test 1.2: Nov 19, 2026 resolves to Week 47');
    assert(resCurrentDate.body.startDate === '2026-11-16', 'Test 1.2: Week 47 start date is Monday 2026-11-16');
    assert(resCurrentDate.body.endDate === '2026-11-22', 'Test 1.2: Week 47 end date is Sunday 2026-11-22');

    // =========================================================================
    // TEST GROUP 2: Cross-Month and Cross-Year Boundaries
    // =========================================================================
    console.log('\n--- TEST GROUP 2: Cross-Month and Cross-Year Week Boundaries ---');

    // 2.1 Cross-month week: March 31, 2026 (Tuesday in Week 14)
    const reqCrossMonth = {
      user: { role: 'admin' },
      query: { period: 'week', date: '2026-03-31' },
    };
    const resCrossMonth = createMockRes();
    await getTeamLeaderboard(reqCrossMonth, resCrossMonth, () => {});

    assert(resCrossMonth.statusCode === 200, 'Test 2.1: Cross-month date returns 200 OK');
    assert(resCrossMonth.body.week === 14, 'Test 2.1: March 31, 2026 is Week 14');
    assert(resCrossMonth.body.startDate === '2026-03-30', 'Test 2.1: Week 14 starts Monday March 30, 2026');
    assert(resCrossMonth.body.endDate === '2026-04-05', 'Test 2.1: Week 14 ends Sunday April 5, 2026');

    // Inspect pointEntry match condition inside pipeline
    const lookupStage = capturedTeamPipeline.find((s) => s.$lookup && s.$lookup.from === PointEntry.collection.name);
    assert(lookupStage != null, 'Test 2.1: PointEntry lookup stage is present');
    const pointMatch = lookupStage.$lookup.pipeline[0].$match.$expr.$and;
    const periodCondition = pointMatch.find((c) => c.$or);
    assert(periodCondition != null, 'Test 2.1: Period condition contains date boundary $or clause');

    // 2.2 Cross-year week: Dec 30, 2026 (Wednesday in Week 53)
    const reqDec = {
      user: { role: 'teamAssistant' },
      query: { period: 'week', date: '2026-12-30' },
    };
    const resDec = createMockRes();
    await getTeamLeaderboard(reqDec, resDec, () => {});

    assert(resDec.statusCode === 200, 'Test 2.2: Dec 30 query returns 200 OK');
    assert(resDec.body.week === 53, 'Test 2.2: Dec 30, 2026 is Week 53');
    assert(resDec.body.startDate === '2026-12-28', 'Test 2.2: Week 53 starts Monday Dec 28, 2026');
    assert(resDec.body.endDate === '2027-01-03', 'Test 2.2: Week 53 ends Sunday Jan 3, 2027');

    // 2.3 Cross-year week: Jan 2, 2027 (Saturday in the same Week 53)
    const reqJan = {
      user: { role: 'member' },
      query: { period: 'week', date: '2027-01-02' },
    };
    const resJan = createMockRes();
    await getTeamLeaderboard(reqJan, resJan, () => {});

    assert(resJan.statusCode === 200, 'Test 2.3: Jan 2 query returns 200 OK');
    assert(resJan.body.week === 53, 'Test 2.3: Jan 2, 2027 is still Week 53');
    assert(resJan.body.startDate === '2026-12-28', 'Test 2.3: Identical start date across year boundary');
    assert(resJan.body.endDate === '2027-01-03', 'Test 2.3: Identical end date across year boundary');

    // 2.4 Monthly view for Dec 30 vs Jan 2
    const reqMonthDec = {
      user: { role: 'admin' },
      query: { period: 'month', date: '2026-12-30' },
    };
    const resMonthDec = createMockRes();
    await getTeamLeaderboard(reqMonthDec, resMonthDec, () => {});
    assert(resMonthDec.body.month === 12 && resMonthDec.body.year === 2026, 'Test 2.4: Dec 30 selects Month 12 / 2026');
    assert(resMonthDec.body.startDate === '2026-12-01', 'Test 2.4: Month start is 2026-12-01');
    assert(resMonthDec.body.endDate === '2026-12-31', 'Test 2.4: Month end is 2026-12-31');

    const reqMonthJan = {
      user: { role: 'admin' },
      query: { period: 'month', date: '2027-01-02' },
    };
    const resMonthJan = createMockRes();
    await getTeamLeaderboard(reqMonthJan, resMonthJan, () => {});
    assert(resMonthJan.body.month === 1 && resMonthJan.body.year === 2027, 'Test 2.4: Jan 2 selects Month 1 / 2027');
    assert(resMonthJan.body.startDate === '2027-01-01', 'Test 2.4: Month start is 2027-01-01');
    assert(resMonthJan.body.endDate === '2027-01-31', 'Test 2.4: Month end is 2027-01-31');

    // =========================================================================
    // TEST GROUP 3: Empty Results & Ranking Calculations
    // =========================================================================
    console.log('\n--- TEST GROUP 3: Empty Period & Ranking Calculations ---');

    Team.aggregate = function () {
      return Promise.resolve([
        {
          teamId: teamAId,
          name: 'Team Alpha',
          memberPoints: 0,
          penalties: 0,
          teamPoints: 0,
          total: 0,
          memberCount: 4,
          average: 0,
          averageRounded: 0,
        },
        {
          teamId: teamBId,
          name: 'Team Beta',
          memberPoints: 0,
          penalties: 0,
          teamPoints: 0,
          total: 0,
          memberCount: 5,
          average: 0,
          averageRounded: 0,
        },
      ]);
    };

    const reqEmptyMonth = {
      user: { role: 'member' },
      query: { period: 'month', date: '2025-01-15' },
    };
    const resEmptyMonth = createMockRes();
    await getTeamLeaderboard(reqEmptyMonth, resEmptyMonth, () => {});

    assert(resEmptyMonth.statusCode === 200, 'Test 3.1: Period with 0 points returns 200 OK');
    assert(resEmptyMonth.body.data.length === 2, 'Test 3.1: Both teams present in data');
    assert(resEmptyMonth.body.data[0].total === 0, 'Test 3.1: Total is 0');
    assert(resEmptyMonth.body.data[0].averageRounded === 0, 'Test 3.1: Average is 0.00 without division by zero');
    assert(resEmptyMonth.body.data[0].rank === 1 && resEmptyMonth.body.data[1].rank === 1, 'Test 3.1: Tied at 0 points receive rank 1');

    // =========================================================================
    // TEST GROUP 4: Member Leaderboard with Date & Team Filter
    // =========================================================================
    console.log('\n--- TEST GROUP 4: Member Leaderboard Date & Team Filtering ---');

    let capturedUserPipeline = null;
    User.aggregate = function (pipeline) {
      capturedUserPipeline = pipeline;
      return Promise.resolve([
        {
          userId: userA1Id,
          name: 'Alice',
          username: 'alice123',
          teamId: teamAId,
          team: 'Team Alpha',
          rewards: 40,
          penalties: 0,
          total: 40,
        },
      ]);
    };

    const reqMemberDate = {
      user: { role: 'member', team: teamAId },
      query: { period: 'month', date: '2026-11-19', team: teamAId.toString() },
    };
    const resMemberDate = createMockRes();
    await getMemberLeaderboard(reqMemberDate, resMemberDate, () => {});

    assert(resMemberDate.statusCode === 200, 'Test 4.1: getMemberLeaderboard with date returns 200 OK');
    assert(resMemberDate.body.date === '2026-11-19', 'Test 4.1: Response date is 2026-11-19');
    assert(resMemberDate.body.data[0].name === 'Alice', 'Test 4.1: Top member is Alice');
    assert(capturedUserPipeline[0].$match.team.toString() === teamAId.toString(), 'Test 4.1: Member pipeline filtered to Team Alpha');

    // =========================================================================
    // TEST GROUP 5: Role Permissions & Error Handling
    // =========================================================================
    console.log('\n--- TEST GROUP 5: Roles & Validation ---');

    const rolesToTest = ['admin', 'teamHead', 'teamAssistant', 'member'];
    for (const r of rolesToTest) {
      const res = createMockRes();
      await getTeamLeaderboard({ user: { role: r }, query: { period: 'week', date: '2026-11-19' } }, res, () => {});
      assert(res.statusCode === 200, `Test 5.1: Role '${r}' allowed access to leaderboard`);
    }

    // Invalid period
    const resInvalidPeriod = createMockRes();
    await getTeamLeaderboard({ user: { role: 'admin' }, query: { period: 'invalid' } }, resInvalidPeriod, () => {});
    assert(resInvalidPeriod.statusCode === 400, 'Test 5.2: Invalid period blocked with 400 Bad Request');

    // Invalid date string
    const resInvalidDate = createMockRes();
    await getTeamLeaderboard({ user: { role: 'admin' }, query: { period: 'week', date: 'not-a-date' } }, resInvalidDate, () => {});
    assert(resInvalidDate.statusCode === 400, 'Test 5.3: Malformed date string rejected with 400 Bad Request');

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  } finally {
    Team.aggregate = origTeamAggregate;
    User.aggregate = origUserAggregate;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
