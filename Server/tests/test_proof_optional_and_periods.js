const mongoose = require('mongoose');
const { createEntry, getEntriesByPeriod } = require('../controllers/entryController');
const { createTeamEntry } = require('../controllers/teamEntryController');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');

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

function createMockSession() {
  return {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: () => {},
  };
}

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

async function runTests() {
  console.log('=== RUNNING PROOF OPTIONAL & PERIOD POINTS TESTS ===\n');

  // Override startSession
  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => createMockSession();

  // Mock IDs
  const adminId = new mongoose.Types.ObjectId();
  const teamHeadId = new mongoose.Types.ObjectId();
  const assistantId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  const otherTeamMemberId = new mongoose.Types.ObjectId();
  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();

  const proofCriteriaId = new mongoose.Types.ObjectId();
  const teamProofCriteriaId = new mongoose.Types.ObjectId();

  const mockUsers = {
    [adminId.toString()]: { _id: adminId, role: 'admin', isActive: true, team: null },
    [teamHeadId.toString()]: { _id: teamHeadId, role: 'teamHead', isActive: true, team: team1Id },
    [assistantId.toString()]: { _id: assistantId, role: 'teamAssistant', isActive: true, team: team1Id },
    [memberId.toString()]: { _id: memberId, role: 'member', isActive: true, team: team1Id },
    [otherTeamMemberId.toString()]: { _id: otherTeamMemberId, role: 'member', isActive: true, team: team2Id },
  };

  const mockCriteria = {
    [proofCriteriaId.toString()]: {
      _id: proofCriteriaId,
      key: 'TEST_NEEDS_PROOF',
      name: 'Needs Proof Activity',
      category: 'cultural',
      points: 25,
      level: 'member',
      frequency: 'weekly',
      needsProof: true,
      isActive: true,
    },
    [teamProofCriteriaId.toString()]: {
      _id: teamProofCriteriaId,
      key: 'TEST_TEAM_NEEDS_PROOF',
      name: 'Needs Proof Team Activity',
      category: 'cultural',
      points: 100,
      level: 'team',
      frequency: 'monthly',
      needsProof: true,
      isActive: true,
    },
  };

  User.findById = (id) => ({
    session: () => Promise.resolve(mockUsers[id.toString()] || null),
  });

  Team.findById = (id) => ({
    session: () => Promise.resolve({ _id: id, name: 'Team Alpha', isActive: true }),
  });

  Criteria.findById = (id) => ({
    session: () => Promise.resolve(mockCriteria[id.toString()] || null),
  });

  PointEntry.findOne = () => ({
    session: () => Promise.resolve(null),
  });

  TeamPointEntry.findOne = () => ({
    session: () => Promise.resolve(null),
  });

  let createdPointEntries = [];
  PointEntry.create = async (docs) => {
    createdPointEntries.push(docs[0]);
    return docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), ...d }));
  };

  PointEntry.findById = () => ({
    populate: function () {
      return this;
    },
    then: function (resolve) {
      resolve(createdPointEntries[createdPointEntries.length - 1] || {});
    },
  });

  let createdTeamEntries = [];
  TeamPointEntry.create = async (docs) => {
    createdTeamEntries.push(docs[0]);
    return docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), ...d }));
  };

  TeamPointEntry.findById = () => ({
    populate: function () {
      return this;
    },
    then: function (resolve) {
      resolve(createdTeamEntries[createdTeamEntries.length - 1] || {});
    },
  });

  AuditLog.create = async (docs) => docs;

  // --------------------------------------------------------------------------
  // TEST GROUP 1: PROOF IMAGE IS OPTIONAL
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Proof Image Optionality ---');

  // Test 1.1: Member submits activity with needsProof: true WITHOUT proof image
  {
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: memberId.toString(),
        criteria: proofCriteriaId.toString(),
        quantity: 1,
        proofImage: '', // OMITTED / EMPTY
      },
    };
    const res = createMockRes();
    let errCaught = null;
    await createEntry(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 201, 'Test 1.1: Member submission succeeds without proof image even if needsProof=true (201 Created)');
    assert(createdPointEntries[createdPointEntries.length - 1].proofImage === null, 'Test 1.1: Empty proof stored safely as null');
  }

  // Test 1.2: Member submits activity with valid Cloudinary proof image
  {
    const validUrl = 'https://res.cloudinary.com/igqx4umu/image/upload/v1234/kadambas/proofs/test_proof.jpg';
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: memberId.toString(),
        criteria: proofCriteriaId.toString(),
        quantity: 1,
        proofImage: validUrl,
      },
    };
    const res = createMockRes();
    let errCaught = null;
    await createEntry(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 201, 'Test 1.2: Member submission succeeds with valid proof image (201 Created)');
    assert(createdPointEntries[createdPointEntries.length - 1].proofImage === validUrl, 'Test 1.2: Valid proof image preserved');
  }

  // Test 1.3: Member submits invalid proof URL -> 400 Bad Request
  {
    const req = {
      user: mockUsers[memberId.toString()],
      body: {
        member: memberId.toString(),
        criteria: proofCriteriaId.toString(),
        quantity: 1,
        proofImage: 'https://malicious-site.com/fake.png',
      },
    };
    const res = createMockRes();
    let errCaught = null;
    await createEntry(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 400, 'Test 1.3: Non-Cloudinary proof URL is properly rejected with 400 Bad Request');
  }

  // Test 1.4: Team Head submits team points with needsProof: true WITHOUT proof image
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        team: team1Id.toString(),
        criteria: teamProofCriteriaId.toString(),
        month: 11,
        year: 2026,
        proofImage: '', // OMITTED / EMPTY
      },
    };
    const res = createMockRes();
    let errCaught = null;
    await createTeamEntry(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 201, 'Test 1.4: Team Head team point submission succeeds without proof image (201 Created)');
    assert(createdTeamEntries[createdTeamEntries.length - 1].proofImage === null, 'Test 1.4: Team point empty proof stored as null');
  }

  // Test 1.5: Team Head submits team points with valid Cloudinary proof image
  {
    const validUrl = 'https://res.cloudinary.com/igqx4umu/image/upload/v1234/kadambas/proofs/team_proof.jpg';
    const req = {
      user: mockUsers[teamHeadId.toString()],
      body: {
        team: team1Id.toString(),
        criteria: teamProofCriteriaId.toString(),
        month: 11,
        year: 2026,
        proofImage: validUrl,
      },
    };
    const res = createMockRes();
    let errCaught = null;
    await createTeamEntry(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 201, 'Test 1.5: Team Head team point submission succeeds with valid proof image (201 Created)');
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: CALENDAR DATE PICKER & PERIOD POINTS QUERY
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Calendar & Period Points Endpoint ---');

  // Set up mock database records for PointEntry.find and TeamPointEntry.find
  const mockDbPointEntries = [
    // In Week 47 (Nov 16 - Nov 22, 2026), Month 11 (Nov 2026)
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 20,
      date: new Date('2026-11-18T10:00:00.000Z'),
      weekNumber: 47,
      month: 11,
      year: 2026,
      status: 'approved',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 10,
      date: new Date('2026-11-19T14:00:00.000Z'),
      weekNumber: 47,
      month: 11,
      year: 2026,
      status: 'pending',
    },
    // In Week 14 spanning March 30 - April 5, 2026
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 15,
      date: new Date('2026-03-31T09:00:00.000Z'),
      weekNumber: 14,
      month: 3,
      year: 2026,
      status: 'approved',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 25,
      date: new Date('2026-04-02T11:00:00.000Z'),
      weekNumber: 14,
      month: 4,
      year: 2026,
      status: 'approved',
    },
    // In Week 53 spanning Dec 28, 2026 - Jan 3, 2027
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 30,
      date: new Date('2026-12-30T10:00:00.000Z'),
      weekNumber: 53,
      month: 12,
      year: 2026,
      status: 'approved',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      team: team1Id,
      member: mockUsers[memberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 40,
      date: new Date('2027-01-02T10:00:00.000Z'),
      weekNumber: 53,
      month: 1,
      year: 2027,
      status: 'approved',
    },
    // Team 2 entry (for permission isolation tests)
    {
      _id: new mongoose.Types.ObjectId(),
      team: team2Id,
      member: mockUsers[otherTeamMemberId.toString()],
      criteria: mockCriteria[proofCriteriaId.toString()],
      points: 50,
      date: new Date('2026-11-18T12:00:00.000Z'),
      weekNumber: 47,
      month: 11,
      year: 2026,
      status: 'approved',
    },
  ];

  const mockDbTeamEntries = [
    {
      _id: new mongoose.Types.ObjectId(),
      team: { _id: team1Id, name: 'Team Alpha' },
      criteria: mockCriteria[teamProofCriteriaId.toString()],
      points: 100,
      month: 11,
      year: 2026,
      status: 'approved',
      frequency: 'monthly',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      team: { _id: team2Id, name: 'Team Beta' },
      criteria: mockCriteria[teamProofCriteriaId.toString()],
      points: 200,
      month: 11,
      year: 2026,
      status: 'approved',
      frequency: 'monthly',
    },
  ];

  // Helper filter simulator for PointEntry
  PointEntry.find = (filter) => {
    let result = [...mockDbPointEntries];

    if (filter.team) {
      result = result.filter((e) => e.team.toString() === filter.team.toString());
    }

    if (filter.$or) {
      result = result.filter((e) => {
        return filter.$or.some((cond) => {
          if (cond.date) {
            const entryTime = e.date.getTime();
            const minTime = cond.date.$gte ? new Date(cond.date.$gte).getTime() : 0;
            const maxTime = cond.date.$lte ? new Date(cond.date.$lte).getTime() : Infinity;
            if (entryTime >= minTime && entryTime <= maxTime) return true;
          }
          if (cond.weekNumber && cond.year) {
            const years = cond.year.$in || [cond.year];
            if (e.weekNumber === cond.weekNumber && years.includes(e.year)) return true;
          }
          if (cond.month && cond.year) {
            if (e.month === cond.month && e.year === cond.year) return true;
          }
          return false;
        });
      });
    }

    return {
      populate: function () {
        return this;
      },
      sort: function () {
        return this;
      },
      then: function (resolve) {
        resolve(result);
      },
    };
  };

  // Helper filter simulator for TeamPointEntry
  TeamPointEntry.find = (filter) => {
    let result = [...mockDbTeamEntries];
    if (filter.team) {
      result = result.filter((e) => (e.team._id || e.team).toString() === filter.team.toString());
    }
    if (filter.month) {
      result = result.filter((e) => e.month === filter.month);
    }
    if (filter.year) {
      result = result.filter((e) => e.year === filter.year);
    }
    return {
      populate: function () {
        return this;
      },
      sort: function () {
        return this;
      },
      then: function (resolve) {
        resolve(result);
      },
    };
  };

  // Test 2.1: Normal Week (Nov 18, 2026) by Admin (All Teams)
  {
    const req = {
      user: mockUsers[adminId.toString()],
      query: { date: '2026-11-18' },
    };
    const res = createMockRes();
    let errCaught = null;
    await getEntriesByPeriod(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 200, 'Test 2.1: Admin period query returns status 200');
    assert(res.body.data.week.weekNumber === 47, 'Test 2.1: Correct weekNumber 47 for 2026-11-18');
    assert(res.body.data.week.startDate === '2026-11-16', 'Test 2.1: Week start Monday 2026-11-16');
    assert(res.body.data.week.endDate === '2026-11-22', 'Test 2.1: Week end Sunday 2026-11-22');
    // Admin sees Team 1 and Team 2: Team 1 (20 approved, 10 pending), Team 2 (50 approved)
    assert(res.body.data.week.summary.approvedPoints === 70, 'Test 2.1: Admin approved weekly points = 70 (20 + 50)');
    assert(res.body.data.week.summary.pendingPoints === 10, 'Test 2.1: Admin pending weekly points = 10');
    // Monthly summary includes Team points (100 + 200 = 300) and member approved (70)
    assert(res.body.data.month.summary.approvedPoints === 370, 'Test 2.1: Admin monthly approved points = 370 (70 member + 300 team)');
  }

  // Test 2.2: Team Head Isolation (Team Head only sees own team's data)
  {
    const req = {
      user: mockUsers[teamHeadId.toString()],
      query: { date: '2026-11-18' },
    };
    const res = createMockRes();
    let errCaught = null;
    await getEntriesByPeriod(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 200, 'Test 2.2: Team Head period query returns 200');
    // Team Head only sees Team 1 (20 approved, 10 pending; NOT the 50 from Team 2)
    assert(res.body.data.week.summary.approvedPoints === 20, 'Test 2.2: Team Head strictly limited to Team 1 weekly points (20 pts, Team 2 excluded)');
    // Monthly: Team 1 member (20) + Team 1 team points (100) = 120 (Team 2's 200 pts excluded!)
    assert(res.body.data.month.summary.approvedPoints === 120, 'Test 2.2: Team Head strictly limited to Team 1 monthly points (120 pts, Team 2 excluded)');
  }

  // Test 2.3: Team Assistant has identical team-scoped access
  {
    const req = {
      user: mockUsers[assistantId.toString()],
      query: { date: '2026-11-18' },
    };
    const res = createMockRes();
    let errCaught = null;
    await getEntriesByPeriod(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 200, 'Test 2.3: Team Assistant period query returns 200');
    assert(res.body.data.week.summary.approvedPoints === 20, 'Test 2.3: Team Assistant sees same team-scoped weekly points');
    assert(res.body.data.month.summary.approvedPoints === 120, 'Test 2.3: Team Assistant sees same team-scoped monthly points');
  }

  // Test 2.4: Member is blocked from period endpoint with 403 Forbidden
  {
    const req = {
      user: mockUsers[memberId.toString()],
      query: { date: '2026-11-18' },
    };
    const res = createMockRes();
    let errCaught = null;
    await getEntriesByPeriod(req, res, (err) => { errCaught = err; });

    assert(!errCaught && res.statusCode === 403, 'Test 2.4: Member role is blocked with 403 Forbidden');
  }

  // Test 2.5: Week crossing month boundary (March 31 and April 2, 2026)
  {
    // Selecting March 31, 2026 (Tuesday in Week 14)
    const req1 = {
      user: mockUsers[teamHeadId.toString()],
      query: { date: '2026-03-31' },
    };
    const res1 = createMockRes();
    await getEntriesByPeriod(req1, res1, () => {});

    assert(res1.body.data.week.weekNumber === 14, 'Test 2.5: Week number for March 31 is Week 14');
    assert(res1.body.data.week.startDate === '2026-03-30', 'Test 2.5: Week 14 starts March 30, 2026');
    assert(res1.body.data.week.endDate === '2026-04-05', 'Test 2.5: Week 14 ends April 5, 2026');
    // Both March 31 (15 pts) and April 2 (25 pts) are in Week 14: total = 40
    assert(res1.body.data.week.summary.approvedPoints === 40, 'Test 2.5: Cross-month week correctly aggregates entries from both March and April (40 pts)');
    assert(res1.body.data.month.monthName === 'March', 'Test 2.5: Month section is March 2026');
    assert(res1.body.data.month.summary.approvedPoints === 15, 'Test 2.5: Monthly section for March only includes March entries (15 pts)');

    // Selecting April 2, 2026 (Thursday in the same Week 14)
    const req2 = {
      user: mockUsers[teamHeadId.toString()],
      query: { date: '2026-04-02' },
    };
    const res2 = createMockRes();
    await getEntriesByPeriod(req2, res2, () => {});

    assert(res2.body.data.week.weekNumber === 14, 'Test 2.5: April 2 has same Week 14');
    assert(res2.body.data.week.summary.approvedPoints === 40, 'Test 2.5: Weekly points identical regardless of which day in the cross-month week is picked (40 pts)');
    assert(res2.body.data.month.monthName === 'April', 'Test 2.5: Month section switches correctly to April');
    assert(res2.body.data.month.summary.approvedPoints === 25, 'Test 2.5: Monthly section for April only includes April entries (25 pts)');
  }

  // Test 2.6: Week crossing year boundary (Dec 30, 2026 and Jan 2, 2027)
  {
    // Selecting Dec 30, 2026 (Wednesday in Week 53)
    const reqDec = {
      user: mockUsers[teamHeadId.toString()],
      query: { date: '2026-12-30' },
    };
    const resDec = createMockRes();
    await getEntriesByPeriod(reqDec, resDec, () => {});

    assert(resDec.body.data.week.weekNumber === 53, 'Test 2.6: Dec 30 is Week 53');
    assert(resDec.body.data.week.startDate === '2026-12-28', 'Test 2.6: Week starts Monday Dec 28, 2026');
    assert(resDec.body.data.week.endDate === '2027-01-03', 'Test 2.6: Week ends Sunday Jan 3, 2027 across year boundary');
    // Both Dec 30 (30 pts) and Jan 2 (40 pts) are in Week 53: total = 70
    assert(resDec.body.data.week.summary.approvedPoints === 70, 'Test 2.6: Cross-year week aggregates entries from both 2026 and 2027 (70 pts)');
    assert(resDec.body.data.month.year === 2026 && resDec.body.data.month.monthName === 'December', 'Test 2.6: Dec date shows December 2026 month');
    assert(resDec.body.data.month.summary.approvedPoints === 30, 'Test 2.6: December month only includes 2026-12 entries (30 pts)');

    // Selecting Jan 2, 2027 (Saturday in the same Week 53)
    const reqJan = {
      user: mockUsers[teamHeadId.toString()],
      query: { date: '2027-01-02' },
    };
    const resJan = createMockRes();
    await getEntriesByPeriod(reqJan, resJan, () => {});

    assert(resJan.body.data.week.weekNumber === 53, 'Test 2.6: Jan 2 is still Week 53');
    assert(resJan.body.data.week.summary.approvedPoints === 70, 'Test 2.6: Week 53 aggregates both 2026 and 2027 entries when accessed from Jan 2027 (70 pts)');
    assert(resJan.body.data.month.year === 2027 && resJan.body.data.month.monthName === 'January', 'Test 2.6: January date shows January 2027 month');
    assert(resJan.body.data.month.summary.approvedPoints === 40, 'Test 2.6: January month only includes 2027-01 entries (40 pts)');
  }

  // Restore startSession
  mongoose.startSession = origStartSession;

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
