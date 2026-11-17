const mongoose = require('mongoose');
const { createEntry } = require('../controllers/entryController');
const { createTeamEntry } = require('../controllers/teamEntryController');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');

// Test runner helper
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

// Mock session factory
function createMockSession() {
  return {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: () => {},
  };
}

async function runTests() {
  console.log('=== RUNNING SUBMISSION & 500 FIX TEST SUITE ===\n');

  // Override mongoose.startSession
  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => createMockSession();

  // Mock common IDs
  const adminId = new mongoose.Types.ObjectId();
  const teamHeadId = new mongoose.Types.ObjectId();
  const assistantId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  const otherMemberId = new mongoose.Types.ObjectId();
  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();
  const positiveCriteriaId = new mongoose.Types.ObjectId();
  const negativeCriteriaId = new mongoose.Types.ObjectId();
  const teamCriteriaId = new mongoose.Types.ObjectId();

  const mockUsers = {
    [adminId.toString()]: { _id: adminId, role: 'admin', isActive: true, team: null },
    [teamHeadId.toString()]: { _id: teamHeadId, role: 'teamHead', isActive: true, team: team1Id },
    [assistantId.toString()]: { _id: assistantId, role: 'teamAssistant', isActive: true, team: team1Id },
    [memberId.toString()]: { _id: memberId, role: 'member', isActive: true, team: team1Id },
    [otherMemberId.toString()]: { _id: otherMemberId, role: 'member', isActive: true, team: team2Id },
  };

  const mockCriteria = {
    [positiveCriteriaId.toString()]: {
      _id: positiveCriteriaId,
      key: 'TEST_POS',
      name: 'Test Positive',
      category: 'cultural',
      points: 10,
      level: 'member',
      frequency: 'weekly',
      needsProof: false,
      isActive: true,
    },
    [negativeCriteriaId.toString()]: {
      _id: negativeCriteriaId,
      key: 'TEST_NEG',
      name: 'Test Negative Penalty',
      category: 'penalty',
      points: -10,
      level: 'member',
      frequency: 'weekly',
      needsProof: false,
      isActive: true,
    },
    [teamCriteriaId.toString()]: {
      _id: teamCriteriaId,
      key: 'TEST_TEAM',
      name: 'Test Team Monthly',
      category: 'cultural',
      points: 50,
      level: 'team',
      frequency: 'monthly',
      needsProof: false,
      isActive: true,
    },
  };

  // Mock User.findById
  User.findById = (id) => ({
    session: () => Promise.resolve(mockUsers[id.toString()] || null),
  });

  // Mock Criteria.findById
  Criteria.findById = (id) => ({
    session: () => Promise.resolve(mockCriteria[id.toString()] || null),
  });

  // Mock Team.findById
  Team.findById = (id) => ({
    session: () => Promise.resolve({ _id: id, name: 'Team Alpha', isActive: true }),
  });

  // Mock PointEntry.findOne (for duplicate checks)
  let mockExistingPointEntry = null;
  PointEntry.findOne = () => ({
    session: () => Promise.resolve(mockExistingPointEntry),
  });

  // Mock PointEntry.create
  let createdPointEntries = [];
  PointEntry.create = async (docs, opts) => {
    createdPointEntries.push({ docs, opts });
    return docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), ...d }));
  };

  // Mock PointEntry.findById (for return population)
  PointEntry.findById = () => ({
    populate: function () {
      return this;
    },
    then: function (resolve) {
      resolve(createdPointEntries[createdPointEntries.length - 1]?.docs[0] || {});
    },
  });

  // Mock TeamPointEntry
  let mockExistingTeamEntry = null;
  TeamPointEntry.findOne = () => ({
    session: () => Promise.resolve(mockExistingTeamEntry),
  });

  let createdTeamEntries = [];
  TeamPointEntry.create = async (docs, opts) => {
    createdTeamEntries.push({ docs, opts });
    return docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), ...d }));
  };

  TeamPointEntry.findById = () => ({
    populate: function () {
      return this;
    },
    then: function (resolve) {
      resolve(createdTeamEntries[createdTeamEntries.length - 1]?.docs[0] || {});
    },
  });

  // Mock AuditLog.create - track options to verify { session, ordered: true }
  let createdAuditLogs = [];
  AuditLog.create = async (docs, opts) => {
    // If multiple docs and session provided without ordered: true, throw MongooseError just like real Mongoose!
    if (opts && opts.session && !opts.ordered && docs.length > 1) {
      throw new Error("MongooseError: Cannot call `create()` with a session and multiple documents unless `ordered: true` is set");
    }
    createdAuditLogs.push({ docs, opts });
    return docs;
  };

  function createMockRes() {
    return {
      statusCode: null,
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

  // TEST 1: Admin submits positive entry -> must succeed with 201, auto-approved, ordered: true
  {
    const req = {
      user: mockUsers[adminId.toString()],
      body: {
        member: memberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 1: Admin submits positive entry -> Status 201 without 500 error');
    assert(res.body.data.status === 'approved', 'Test 1: Admin entry is auto-approved');
    const lastAuditCall = createdAuditLogs[createdAuditLogs.length - 1];
    assert(lastAuditCall.docs.length === 2, 'Test 1: Two audit logs created (CREATE and APPROVE)');
    assert(lastAuditCall.opts.ordered === true, 'Test 1: AuditLog.create called with ordered: true (prevents 500)');
  }

  // TEST 2: Admin submits negative entry for any team -> must succeed with 201, auto-approved
  {
    const req = {
      user: mockUsers[adminId.toString()],
      body: {
        member: otherMemberId.toString(),
        criteria: negativeCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 2: Admin submits negative entry across teams -> Status 201');
    assert(res.body.data.status === 'approved', 'Test 2: Admin negative entry is auto-approved');
  }

  // TEST 3: Team Head submits positive entry for own team member -> 201 auto-approved, ordered: true
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        member: memberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 3: Team Head submits positive entry for own team -> Status 201');
    assert(res.body.data.status === 'approved', 'Test 3: Team Head entry is auto-approved');
    const lastAuditCall = createdAuditLogs[createdAuditLogs.length - 1];
    assert(lastAuditCall.opts.ordered === true, 'Test 3: Team Head AuditLog.create has ordered: true');
  }

  // TEST 4: Team Head submits negative entry for own team member -> 201 auto-approved
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        member: memberId.toString(),
        criteria: negativeCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 4: Team Head submits negative entry for own team -> Status 201');
    assert(res.body.data.status === 'approved', 'Test 4: Team Head negative entry is auto-approved');
  }

  // TEST 5: Team Head submits for other team's member -> 403 Forbidden
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        member: otherMemberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 403, 'Test 5: Team Head cross-team submission blocked with 403 Forbidden');
  }

  // TEST 6: Team Assistant submits for own team member -> 201 pending
  {
    const req = {
      user: mockUsers[assistantId.toString()],
      body: {
        member: memberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 6: Team Assistant submits positive entry -> Status 201');
    assert(res.body.data.status === 'pending', 'Test 6: Team Assistant submission remains pending');
  }

  // TEST 7: Member submits positive entry for self -> 201 pending
  {
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: memberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 7: Member submits positive entry for self -> Status 201 pending');
    assert(res.body.data.status === 'pending', 'Test 7: Member submission status is pending');
  }

  // TEST 8: Member submits for someone else -> 403 Forbidden
  {
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: otherMemberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 403, 'Test 8: Member submitting for another user blocked with 403 Forbidden');
  }

  // TEST 9: Member submits negative entry -> 403 Forbidden
  {
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: memberId.toString(),
        criteria: negativeCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 403, 'Test 9: Member submitting negative entry blocked with 403 Forbidden');
  }

  // TEST 10: Duplicate entry check -> 409 Conflict
  {
    mockExistingPointEntry = { _id: new mongoose.Types.ObjectId(), status: 'pending' };
    const req = {
      user: mockUsers[adminId.toString()],
      body: {
        member: memberId.toString(),
        criteria: positiveCriteriaId.toString(),
        quantity: 1,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 409, 'Test 10: Duplicate entry returns 409 Conflict without 500 error');
    mockExistingPointEntry = null; // reset
  }

  // TEST 11: Team Monthly Points submitted by Admin -> 201 auto-approved, ordered: true
  {
    const req = {
      user: mockUsers[adminId.toString()],
      body: {
        team: team1Id.toString(),
        criteria: teamCriteriaId.toString(),
        month: 11,
        year: 2026,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createTeamEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 11: Admin submits Monthly Team Point -> Status 201 without 500 error');
    assert(res.body.data.status === 'approved', 'Test 11: Monthly Team Point is auto-approved');
    const lastAuditCall = createdAuditLogs[createdAuditLogs.length - 1];
    assert(lastAuditCall.opts.ordered === true, 'Test 11: TeamPointEntry AuditLog.create called with ordered: true');
  }

  // TEST 12: Team Monthly Points submitted by Team Head for own team -> 201 auto-approved, ordered: true
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        team: team1Id.toString(),
        criteria: teamCriteriaId.toString(),
        month: 11,
        year: 2026,
      },
    };
    const res = createMockRes();
    let errorCaught = null;
    await createTeamEntry(req, res, (err) => { errorCaught = err; });

    assert(!errorCaught && res.statusCode === 201, 'Test 12: Team Head submits Monthly Team Point -> Status 201 without 500 error');
    assert(res.body.data.status === 'approved', 'Test 12: Monthly Team Point is auto-approved');
  }

  // Restore mongoose.startSession
  mongoose.startSession = origStartSession;

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
