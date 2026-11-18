const mongoose = require('mongoose');
const roleCheck = require('../middleware/roleCheck');
const { getEntriesByPeriod } = require('../controllers/entryController');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');

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
  console.log('=== RUNNING BY-PERIOD PERMISSION & WORKFLOW TESTS ===\n');

  // ==================== TEST GROUP 1: ROLECHECK MIDDLEWARE ====================
  console.log('--- TEST GROUP 1: roleCheck Middleware Array & Rest Parameter Handling ---');

  // Test 1.1: roleCheck with rest parameters roleCheck('admin', 'teamHead', 'teamAssistant')
  const middlewareRest = roleCheck('admin', 'teamHead', 'teamAssistant');

  // Admin
  let adminNextCalled = false;
  const resAdmin = createMockRes();
  middlewareRest({ user: { role: 'admin' } }, resAdmin, () => { adminNextCalled = true; });
  assert(adminNextCalled === true && resAdmin.statusCode === 200, 'Test 1.1: roleCheck rest-args allows admin');

  // Team Head
  let headNextCalled = false;
  const resHead = createMockRes();
  middlewareRest({ user: { role: 'teamHead' } }, resHead, () => { headNextCalled = true; });
  assert(headNextCalled === true && resHead.statusCode === 200, 'Test 1.1: roleCheck rest-args allows teamHead');

  // Team Assistant
  let asstNextCalled = false;
  const resAsst = createMockRes();
  middlewareRest({ user: { role: 'teamAssistant' } }, resAsst, () => { asstNextCalled = true; });
  assert(asstNextCalled === true && resAsst.statusCode === 200, 'Test 1.1: roleCheck rest-args allows teamAssistant');

  // Member
  let memberNextCalled = false;
  const resMember = createMockRes();
  middlewareRest({ user: { role: 'member' } }, resMember, () => { memberNextCalled = true; });
  assert(memberNextCalled === false && resMember.statusCode === 403, 'Test 1.1: roleCheck rest-args blocks member with 403 Forbidden');
  assert(resMember.body.message === 'Forbidden. You do not have permission to perform this action.', 'Test 1.1: Correct 403 error message returned');

  // Unauthenticated (no req.user)
  let unauthNextCalled = false;
  const resUnauth = createMockRes();
  middlewareRest({}, resUnauth, () => { unauthNextCalled = true; });
  assert(unauthNextCalled === false && resUnauth.statusCode === 401, 'Test 1.1: roleCheck rest-args blocks unauthenticated with 401');

  // Test 1.2: roleCheck with array argument roleCheck(['admin', 'teamHead', 'teamAssistant'])
  const middlewareArray = roleCheck(['admin', 'teamHead', 'teamAssistant']);

  let adminArrayNextCalled = false;
  const resAdminArray = createMockRes();
  middlewareArray({ user: { role: 'admin' } }, resAdminArray, () => { adminArrayNextCalled = true; });
  assert(adminArrayNextCalled === true && resAdminArray.statusCode === 200, 'Test 1.2: roleCheck with array allows admin');

  let headArrayNextCalled = false;
  const resHeadArray = createMockRes();
  middlewareArray({ user: { role: 'teamHead' } }, resHeadArray, () => { headArrayNextCalled = true; });
  assert(headArrayNextCalled === true && resHeadArray.statusCode === 200, 'Test 1.2: roleCheck with array allows teamHead');

  let asstArrayNextCalled = false;
  const resAsstArray = createMockRes();
  middlewareArray({ user: { role: 'teamAssistant' } }, resAsstArray, () => { asstArrayNextCalled = true; });
  assert(asstArrayNextCalled === true && resAsstArray.statusCode === 200, 'Test 1.2: roleCheck with array allows teamAssistant');

  let memberArrayNextCalled = false;
  const resMemberArray = createMockRes();
  middlewareArray({ user: { role: 'member' } }, resMemberArray, () => { memberArrayNextCalled = true; });
  assert(memberArrayNextCalled === false && resMemberArray.statusCode === 403, 'Test 1.2: roleCheck with array blocks member with 403');

  // ==================== TEST GROUP 2: CONTROLLER TEAM SCOPING & PERMISSIONS ====================
  console.log('\n--- TEST GROUP 2: Controller Permissions & Scoping ---');

  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();
  const criteriaId = new mongoose.Types.ObjectId();
  const member1Id = new mongoose.Types.ObjectId();
  const member2Id = new mongoose.Types.ObjectId();

  const mockWeeklyEntries = [
    {
      _id: new mongoose.Types.ObjectId(),
      member: { _id: member1Id, name: 'Alice', role: 'member' },
      team: { _id: team1Id, name: 'Team Alpha' },
      criteria: { _id: criteriaId, name: 'Meeting Attendance', points: 10 },
      points: 10,
      status: 'approved',
      date: new Date('2026-11-18T10:00:00Z'),
      weekNumber: 47,
      year: 2026,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      member: { _id: member2Id, name: 'Bob', role: 'member' },
      team: { _id: team2Id, name: 'Team Beta' },
      criteria: { _id: criteriaId, name: 'Meeting Attendance', points: 15 },
      points: 15,
      status: 'approved',
      date: new Date('2026-11-18T11:00:00Z'),
      weekNumber: 47,
      year: 2026,
    },
  ];

  const mockMonthlyTeamEntries = [
    {
      _id: new mongoose.Types.ObjectId(),
      team: { _id: team1Id, name: 'Team Alpha' },
      criteria: { _id: criteriaId, name: 'Monthly Challenge', points: 50 },
      points: 50,
      status: 'approved',
      month: 11,
      year: 2026,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      team: { _id: team2Id, name: 'Team Beta' },
      criteria: { _id: criteriaId, name: 'Monthly Challenge', points: 75 },
      points: 75,
      status: 'approved',
      month: 11,
      year: 2026,
    },
  ];

  // Helper chainable mock
  function createPopulateMock(results) {
    return {
      populate: function () {
        return this;
      },
      sort: function () {
        return Promise.resolve(results);
      },
    };
  }

  // Intercept Mongoose queries
  const origPointFind = PointEntry.find;
  const origTeamPointFind = TeamPointEntry.find;

  PointEntry.find = function (filter) {
    let filtered = [...mockWeeklyEntries];
    if (filter && filter.team) {
      const filterTeamStr = filter.team.toString();
      filtered = filtered.filter((e) => e.team._id.toString() === filterTeamStr);
    }
    return createPopulateMock(filtered);
  };

  TeamPointEntry.find = function (filter) {
    let filtered = [...mockMonthlyTeamEntries];
    if (filter && filter.team) {
      const filterTeamStr = filter.team.toString();
      filtered = filtered.filter((e) => e.team._id.toString() === filterTeamStr);
    }
    return createPopulateMock(filtered);
  };

  // Test 2.1: Admin viewing all teams
  const reqAdminAll = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
    query: { date: '2026-11-18' },
  };
  const resAdminAll = createMockRes();
  await getEntriesByPeriod(reqAdminAll, resAdminAll, () => {});
  assert(resAdminAll.statusCode === 200, 'Test 2.1: Admin request succeeds with 200 OK');
  assert(resAdminAll.body.data.week.entries.length === 2, 'Test 2.1: Admin sees entries across all teams (2 entries)');
  assert(resAdminAll.body.data.week.summary.approvedPoints === 25, 'Test 2.1: Admin total weekly points = 25 (10 + 15)');
  assert(resAdminAll.body.data.month.teamEntries.length === 2, 'Test 2.1: Admin sees monthly team entries for both teams (2 entries)');
  assert(resAdminAll.body.data.month.summary.teamApprovedPoints === 125, 'Test 2.1: Admin monthly team points = 125 (50 + 75)');

  // Test 2.2: Admin filtering by Team 1
  const reqAdminTeam1 = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
    query: { date: '2026-11-18', team: team1Id.toString() },
  };
  const resAdminTeam1 = createMockRes();
  await getEntriesByPeriod(reqAdminTeam1, resAdminTeam1, () => {});
  assert(resAdminTeam1.statusCode === 200, 'Test 2.2: Admin filtering by team succeeds');
  assert(resAdminTeam1.body.data.week.entries.length === 1, 'Test 2.2: Filtered to Team 1 entries only (1 entry)');
  assert(resAdminTeam1.body.data.week.summary.approvedPoints === 10, 'Test 2.2: Team 1 weekly points = 10');
  assert(resAdminTeam1.body.data.month.teamEntries.length === 1, 'Test 2.2: Filtered to Team 1 monthly team entries (1 entry)');
  assert(resAdminTeam1.body.data.month.summary.teamApprovedPoints === 50, 'Test 2.2: Team 1 monthly team points = 50');

  // Test 2.3: Team Head (assigned to Team 1)
  const reqHead2 = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'teamHead', team: team1Id },
    query: { date: '2026-11-18' },
  };
  const resHead2 = createMockRes();
  await getEntriesByPeriod(reqHead2, resHead2, () => {});
  assert(resHead2.statusCode === 200, 'Test 2.3: Team Head request succeeds with 200 OK');
  assert(resHead2.body.data.week.entries.length === 1, 'Test 2.3: Team Head only sees Team 1 entries (1 entry)');
  assert(resHead2.body.data.week.summary.approvedPoints === 10, 'Test 2.3: Team Head weekly points = 10 (Team 2 excluded)');
  assert(resHead2.body.data.month.teamEntries.length === 1, 'Test 2.3: Team Head only sees Team 1 monthly entries (1 entry)');
  assert(resHead2.body.data.month.summary.teamApprovedPoints === 50, 'Test 2.3: Team Head monthly team points = 50 (Team 2 excluded)');

  // Test 2.4: Team Assistant (assigned to Team 2)
  const reqAsst2 = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'teamAssistant', team: team2Id },
    query: { date: '2026-11-18' },
  };
  const resAsst2 = createMockRes();
  await getEntriesByPeriod(reqAsst2, resAsst2, () => {});
  assert(resAsst2.statusCode === 200, 'Test 2.4: Team Assistant request succeeds with 200 OK');
  assert(resAsst2.body.data.week.entries.length === 1, 'Test 2.4: Team Assistant only sees Team 2 entries (1 entry)');
  assert(resAsst2.body.data.week.summary.approvedPoints === 15, 'Test 2.4: Team Assistant weekly points = 15 (Team 1 excluded)');
  assert(resAsst2.body.data.month.teamEntries.length === 1, 'Test 2.4: Team Assistant only sees Team 2 monthly entries (1 entry)');
  assert(resAsst2.body.data.month.summary.teamApprovedPoints === 75, 'Test 2.4: Team Assistant monthly team points = 75 (Team 1 excluded)');

  // Test 2.5: Team Head with no team assigned
  const reqHeadNoTeam = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'teamHead', team: null },
    query: { date: '2026-11-18' },
  };
  const resHeadNoTeam = createMockRes();
  await getEntriesByPeriod(reqHeadNoTeam, resHeadNoTeam, () => {});
  assert(resHeadNoTeam.statusCode === 200, 'Test 2.5: Team Head with no team returns 200 OK');
  assert(resHeadNoTeam.body.data.week.entries.length === 0, 'Test 2.5: Zero weekly entries');
  assert(resHeadNoTeam.body.data.week.summary.approvedPoints === 0, 'Test 2.5: Zero weekly points');
  assert(resHeadNoTeam.body.data.month.teamEntries.length === 0, 'Test 2.5: Zero monthly entries');

  // Test 2.6: Member role blocked at controller
  const reqMemberController = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'member' },
    query: { date: '2026-11-18' },
  };
  const resMemberController = createMockRes();
  await getEntriesByPeriod(reqMemberController, resMemberController, () => {});
  assert(resMemberController.statusCode === 403, 'Test 2.6: Member role blocked at controller with 403 Forbidden');

  // Test 2.7: Empty date / no entries scenario
  PointEntry.find = () => createPopulateMock([]);
  TeamPointEntry.find = () => createPopulateMock([]);
  const reqEmpty = {
    user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
    query: { date: '2026-11-18' },
  };
  const resEmpty = createMockRes();
  await getEntriesByPeriod(reqEmpty, resEmpty, () => {});
  assert(resEmpty.statusCode === 200, 'Test 2.7: Request with no entries returns 200 OK');
  assert(resEmpty.body.data.week.entries.length === 0, 'Test 2.7: Empty weekly entries array');
  assert(resEmpty.body.data.week.summary.approvedPoints === 0, 'Test 2.7: 0 approved weekly points');
  assert(resEmpty.body.data.month.memberEntries.length === 0, 'Test 2.7: Empty monthly member entries array');
  assert(resEmpty.body.data.month.teamEntries.length === 0, 'Test 2.7: Empty monthly team entries array');
  assert(resEmpty.body.data.month.summary.approvedPoints === 0, 'Test 2.7: 0 approved monthly points');

  // Restore mocks
  PointEntry.find = origPointFind;
  TeamPointEntry.find = origTeamPointFind;

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
