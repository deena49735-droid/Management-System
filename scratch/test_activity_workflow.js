const assert = require('assert');
const mongoose = require('../Server/node_modules/mongoose');

// Point to test JWT secret
process.env.JWT_SECRET = 'test_secret_for_workflow_tests';

const entryController = require('../Server/controllers/entryController');
const PointEntry = require('../Server/models/PointEntry');
const Criteria = require('../Server/models/Criteria');
const User = require('../Server/models/User');
const AuditLog = require('../Server/models/AuditLog');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };
  return res;
};

async function runTests() {
  console.log('=== RUNNING ACTIVITY WORKFLOW PERMISSIONS TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function recordPass(name) {
    console.log(`[PASS] ${name}`);
    passed++;
  }

  function recordFail(name, err) {
    console.error(`[FAIL] ${name}:`, err.message || err);
    failed++;
  }

  // Setup mock IDs
  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();

  const adminUser = { _id: new mongoose.Types.ObjectId(), role: 'admin', team: null };
  const headTeam1 = { _id: new mongoose.Types.ObjectId(), role: 'teamHead', team: team1Id };
  const assistantTeam1 = { _id: new mongoose.Types.ObjectId(), role: 'teamAssistant', team: team1Id };
  const memberTeam1 = { _id: new mongoose.Types.ObjectId(), role: 'member', team: team1Id };
  const memberTeam2 = { _id: new mongoose.Types.ObjectId(), role: 'member', team: team2Id };

  const positiveCriteria = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Book Reading',
    key: 'book_reading',
    category: 'non_meeting_day',
    level: 'member',
    points: 10,
    frequency: 'daily',
    isActive: true,
  };

  const negativeCriteria = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Late to Meeting',
    key: 'late_penalty',
    category: 'penalty',
    level: 'member',
    points: -10,
    frequency: 'meeting',
    isActive: true,
  };

  // Mock Mongoose Transaction Session
  const mockSession = {
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: () => {},
  };
  mongoose.startSession = async () => mockSession;

  // Mock Criteria findById
  Criteria.findById = (id) => ({
    session: () => {
      if (id && id.toString() === negativeCriteria._id.toString()) return Promise.resolve(negativeCriteria);
      return Promise.resolve(positiveCriteria);
    },
  });

  // Mock AuditLog create
  AuditLog.create = async () => Promise.resolve([]);

  // Mock PointEntry.findOne for duplicate check
  PointEntry.findOne = () => ({ session: () => Promise.resolve(null) });

  let currentEntryDoc = null;
  PointEntry.findById = (id) => {
    const chain = {
      session: () => Promise.resolve(currentEntryDoc),
      populate: () => chain,
      then: (resolve) => Promise.resolve(resolve(currentEntryDoc)),
    };
    return chain;
  };

  // ==================== TEST GROUP 1: SUBMISSIONS ====================

  // 1. Admin Positive Submission -> Auto-approved
  try {
    User.findById = (id) => ({
      session: () => Promise.resolve({ _id: id, team: team1Id, isActive: true }),
    });
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: adminUser,
      body: {
        member: memberTeam1._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201, `Expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(createdDoc.status, 'approved', 'Admin submission must be auto-approved');
    assert.strictEqual(createdDoc.approvedBy.toString(), adminUser._id.toString());
    recordPass('1. Admin positive submission is auto-approved');
  } catch (err) {
    recordFail('1. Admin positive submission is auto-approved', err);
  }

  // 2. Admin Negative Submission -> Auto-approved
  try {
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: adminUser,
      body: {
        member: memberTeam1._id.toString(),
        criteria: negativeCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'approved', 'Admin negative submission must be auto-approved');
    assert.strictEqual(createdDoc.points, -10);
    recordPass('2. Admin negative submission is auto-approved');
  } catch (err) {
    recordFail('2. Admin negative submission is auto-approved', err);
  }

  // 3. Team Head Positive Submission for own team -> Auto-approved
  try {
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: headTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'approved', 'Team Head submission for own team must be auto-approved');
    assert.strictEqual(createdDoc.approvedBy.toString(), headTeam1._id.toString());
    recordPass('3. Team Head positive submission for own team is auto-approved');
  } catch (err) {
    recordFail('3. Team Head positive submission for own team is auto-approved', err);
  }

  // 4. Team Head Negative Submission for own team -> Auto-approved
  try {
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: headTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: negativeCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'approved', 'Team Head negative submission must be auto-approved');
    assert.strictEqual(createdDoc.points, -10);
    recordPass('4. Team Head negative submission for own team is auto-approved');
  } catch (err) {
    recordFail('4. Team Head negative submission for own team is auto-approved', err);
  }

  // 5. Team Head Cross-Team Submission -> 403 Forbidden
  try {
    User.findById = (id) => ({
      session: () => Promise.resolve({ _id: id, team: team2Id, isActive: true }),
    });

    const req = {
      user: headTeam1,
      body: {
        member: memberTeam2._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403, 'Cross-team submission must return 403');
    recordPass('5. Team Head cross-team submission is rejected with 403');
  } catch (err) {
    recordFail('5. Team Head cross-team submission is rejected with 403', err);
  }

  // 6. Team Assistant Positive Submission -> Pending
  try {
    User.findById = (id) => ({
      session: () => Promise.resolve({ _id: id, team: team1Id, isActive: true }),
    });
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: assistantTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'pending', 'Team Assistant submission must remain pending');
    assert.strictEqual(createdDoc.approvedBy, null);
    recordPass('6. Team Assistant positive submission remains pending');
  } catch (err) {
    recordFail('6. Team Assistant positive submission remains pending', err);
  }

  // 7. Team Assistant Negative Submission -> Pending
  try {
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: assistantTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: negativeCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'pending', 'Team Assistant negative submission must remain pending');
    assert.strictEqual(createdDoc.points, -10);
    recordPass('7. Team Assistant negative submission remains pending');
  } catch (err) {
    recordFail('7. Team Assistant negative submission remains pending', err);
  }

  // 8. Team Assistant Cross-Team Submission -> 403 Forbidden
  try {
    User.findById = (id) => ({
      session: () => Promise.resolve({ _id: id, team: team2Id, isActive: true }),
    });

    const req = {
      user: assistantTeam1,
      body: {
        member: memberTeam2._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    recordPass('8. Team Assistant cross-team submission is rejected with 403');
  } catch (err) {
    recordFail('8. Team Assistant cross-team submission is rejected with 403', err);
  }

  // 9. Member Positive Submission for self -> Pending
  try {
    User.findById = (id) => ({
      session: () => Promise.resolve({ _id: id, team: team1Id, isActive: true }),
    });
    let createdDoc = null;
    PointEntry.create = async (docs, opts) => {
      createdDoc = { ...docs[0], _id: new mongoose.Types.ObjectId() };
      currentEntryDoc = createdDoc;
      return [createdDoc];
    };

    const req = {
      user: memberTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(createdDoc.status, 'pending', 'Member submission must remain pending');
    recordPass('9. Member positive submission for self remains pending');
  } catch (err) {
    recordFail('9. Member positive submission for self remains pending', err);
  }

  // 10. Member Negative / Penalty Submission -> 403 Forbidden
  try {
    const req = {
      user: memberTeam1,
      body: {
        member: memberTeam1._id.toString(),
        criteria: negativeCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('penalty') || res.body.message.includes('negative'));
    recordPass('10. Member negative/penalty submission is rejected with 403');
  } catch (err) {
    recordFail('10. Member negative/penalty submission is rejected with 403', err);
  }

  // 11. Member Submission for another member -> 403 Forbidden
  try {
    const req = {
      user: memberTeam1,
      body: {
        member: memberTeam2._id.toString(),
        criteria: positiveCriteria._id.toString(),
        quantity: 1,
        date: '2026-11-17',
      },
    };
    const res = createMockRes();
    await entryController.createEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('Members can only submit entries for themselves'));
    recordPass('11. Member submitting for another member is rejected with 403');
  } catch (err) {
    recordFail('11. Member submitting for another member is rejected with 403', err);
  }

  // ==================== TEST GROUP 2: APPROVALS & PERMISSIONS ====================

  const makePendingEntry = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    status: 'pending',
    points: 10,
    team: team1Id,
    member: memberTeam1._id,
    enteredBy: memberTeam1._id,
    criteria: positiveCriteria._id,
    isReversal: false,
    ...overrides,
  });

  const setupFindByIdMock = (entry) => {
    PointEntry.findById = (id) => {
      const chain = {
        session: () => Promise.resolve(entry),
        populate: () => chain,
        then: (resolve) => Promise.resolve(resolve(entry)),
      };
      return chain;
    };
  };

  // Mock PointEntry.findOneAndUpdate for approvals
  PointEntry.findOneAndUpdate = async (filter, update) => {
    return {
      _id: filter._id,
      status: 'approved',
      approvedBy: update.$set.approvedBy,
      approvedAt: update.$set.approvedAt,
    };
  };

  // 12. Team Assistant approving Member positive submission -> 200 OK
  try {
    const entry = makePendingEntry({ enteredBy: memberTeam1._id, member: memberTeam1._id, points: 10 });
    setupFindByIdMock(entry);
    User.findById = () => ({ session: () => Promise.resolve({ _id: memberTeam1._id, role: 'member' }) });

    const req = { user: assistantTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    recordPass('12. Team Assistant can approve positive member submission');
  } catch (err) {
    recordFail('12. Team Assistant can approve positive member submission', err);
  }

  // 13. Team Assistant approving negative submission -> 403 Forbidden
  try {
    const entry = makePendingEntry({ enteredBy: memberTeam1._id, member: memberTeam1._id, points: -10 });
    setupFindByIdMock(entry);

    const req = { user: assistantTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('cannot approve negative point entries'));
    recordPass('13. Team Assistant cannot approve negative point entries (403)');
  } catch (err) {
    recordFail('13. Team Assistant cannot approve negative point entries (403)', err);
  }

  // 14. Team Assistant approving another Assistant submission -> 403 Forbidden
  try {
    const otherAssistantId = new mongoose.Types.ObjectId();
    const entry = makePendingEntry({ enteredBy: otherAssistantId, member: memberTeam1._id, points: 10 });
    setupFindByIdMock(entry);
    User.findById = () => ({ session: () => Promise.resolve({ _id: otherAssistantId, role: 'teamAssistant' }) });

    const req = { user: assistantTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('Team assistant entries must be approved by a team head or admin'));
    recordPass('14. Team Assistant cannot approve another assistant submission (403)');
  } catch (err) {
    recordFail('14. Team Assistant cannot approve another assistant submission (403)', err);
  }

  // 15. Team Assistant approving cross-team submission -> 403 Forbidden
  try {
    const entry = makePendingEntry({ team: team2Id });
    setupFindByIdMock(entry);

    const req = { user: assistantTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    recordPass('15. Team Assistant cross-team approval rejected with 403');
  } catch (err) {
    recordFail('15. Team Assistant cross-team approval rejected with 403', err);
  }

  // 16. Team Head approving Member submission -> 200 OK
  try {
    const entry = makePendingEntry({ enteredBy: memberTeam1._id, member: memberTeam1._id, points: 10 });
    setupFindByIdMock(entry);

    const req = { user: headTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    recordPass('16. Team Head can approve Member positive submission (200)');
  } catch (err) {
    recordFail('16. Team Head can approve Member positive submission (200)', err);
  }

  // 17. Team Head approving Team Assistant positive submission -> 200 OK
  try {
    const entry = makePendingEntry({ enteredBy: assistantTeam1._id, member: memberTeam1._id, points: 10 });
    setupFindByIdMock(entry);

    const req = { user: headTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    recordPass('17. Team Head can approve Team Assistant positive submission (200)');
  } catch (err) {
    recordFail('17. Team Head can approve Team Assistant positive submission (200)', err);
  }

  // 18. Team Head approving Team Assistant negative submission -> 200 OK
  try {
    const entry = makePendingEntry({ enteredBy: assistantTeam1._id, member: memberTeam1._id, points: -10 });
    setupFindByIdMock(entry);

    const req = { user: headTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    recordPass('18. Team Head can approve Team Assistant negative submission (200)');
  } catch (err) {
    recordFail('18. Team Head can approve Team Assistant negative submission (200)', err);
  }

  // 19. Team Head cross-team approval -> 403 Forbidden
  try {
    const entry = makePendingEntry({ team: team2Id });
    setupFindByIdMock(entry);

    const req = { user: headTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    recordPass('19. Team Head cross-team approval rejected with 403');
  } catch (err) {
    recordFail('19. Team Head cross-team approval rejected with 403', err);
  }

  // 20. Self-approval blocked (recipient or submitter) -> 403 Forbidden
  try {
    const entry = makePendingEntry({ enteredBy: headTeam1._id, member: memberTeam1._id });
    setupFindByIdMock(entry);

    const req = { user: headTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('You cannot approve or reject entries that you entered'));
    recordPass('20. Self-approval is blocked with 403');
  } catch (err) {
    recordFail('20. Self-approval is blocked with 403', err);
  }

  // 21. Member attempting approval -> 403 Forbidden
  try {
    const entry = makePendingEntry();
    setupFindByIdMock(entry);

    const req = { user: memberTeam1, params: { id: entry._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 403);
    assert(res.body.message.includes('Only team heads, team assistants, or admins can approve entries'));
    recordPass('21. Member approval attempt is blocked with 403');
  } catch (err) {
    recordFail('21. Member approval attempt is blocked with 403', err);
  }

  // 22. Admin approving pending Member & Assistant submissions globally -> 200 OK
  try {
    const entryCrossTeam = makePendingEntry({ team: team2Id, enteredBy: assistantTeam1._id, points: -20 });
    setupFindByIdMock(entryCrossTeam);

    const req = { user: adminUser, params: { id: entryCrossTeam._id.toString() } };
    const res = createMockRes();
    await entryController.approveEntry(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    recordPass('22. Admin can approve entries across any team globally (200)');
  } catch (err) {
    recordFail('22. Admin can approve entries across any team globally (200)', err);
  }

  console.log(`\n========================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
