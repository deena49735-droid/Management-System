const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Team = require('../models/Team');
const Criteria = require('../models/Criteria');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const AuditLog = require('../models/AuditLog');
const entryController = require('../controllers/entryController');
const teamEntryController = require('../controllers/teamEntryController');

// Helper to mock express req/res
const mockReqRes = (reqData = {}) => {
  let statusCode = 200;
  let responseData = null;

  const req = {
    body: {},
    params: {},
    query: {},
    user: null,
    ...reqData,
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
  };

  const next = (err) => {
    if (err) {
      if (err.code === 11000) {
        statusCode = 409;
        responseData = { success: false, message: 'Duplicate key conflict', err };
      } else {
        statusCode = 500;
        responseData = { success: false, message: err.message, err };
      }
    }
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
};

describe('Stage 1A Integration Tests', () => {
  let testTeam;
  let otherTeam;
  let adminUser;
  let headUser;
  let assistantUser;
  let memberUser;
  let weeklyCriteria;
  let monthlyCriteria;
  let teamMonthlyCriteria;
  let teamOneTimeCriteria;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

    // Clean up any previous test fixtures
    await User.deleteMany({ username: { $regex: /^test_stg1a_/ } });
    await Team.deleteMany({ name: { $regex: /^Test Team Stg1a/ } });
    await Criteria.deleteMany({ key: { $regex: /^test_stg1a_/ } });
    await PointEntry.deleteMany({});
    await TeamPointEntry.deleteMany({});
    await AuditLog.deleteMany({});

    // Create Teams
    testTeam = await Team.create({
      name: 'Test Team Stg1a A',
      code: 'STG1A_A',
      description: 'Test Team A',
      isActive: true,
    });

    otherTeam = await Team.create({
      name: 'Test Team Stg1a B',
      code: 'STG1A_B',
      description: 'Test Team B',
      isActive: true,
    });

    // Create Users
    adminUser = await User.create({
      name: 'Admin Test',
      username: 'test_stg1a_admin',
      phone: '9000000001',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    headUser = await User.create({
      name: 'Head Test',
      username: 'test_stg1a_head',
      phone: '9000000002',
      password: 'password123',
      role: 'teamHead',
      team: testTeam._id,
      isActive: true,
    });

    assistantUser = await User.create({
      name: 'Assistant Test',
      username: 'test_stg1a_asst',
      phone: '9000000003',
      password: 'password123',
      role: 'teamAssistant',
      team: testTeam._id,
      isActive: true,
    });

    memberUser = await User.create({
      name: 'Member Test',
      username: 'test_stg1a_member',
      phone: '9000000004',
      password: 'password123',
      role: 'member',
      team: testTeam._id,
      isActive: true,
    });

    // Update Team with lead & assistant
    testTeam.head = headUser._id;
    testTeam.assistant = assistantUser._id;
    await testTeam.save();

    // Create Criteria
    weeklyCriteria = await Criteria.create({
      key: 'test_stg1a_weekly',
      name: 'Test Weekly Member Activity',
      category: 'meeting_day',
      points: 20,
      basis: 'per_member',
      frequency: 'weekly',
      level: 'member',
      isActive: true,
    });

    monthlyCriteria = await Criteria.create({
      key: 'test_stg1a_monthly',
      name: 'Test Monthly Member Activity',
      category: 'monthly',
      points: 50,
      basis: 'per_member',
      frequency: 'monthly',
      level: 'member',
      isActive: true,
    });

    teamMonthlyCriteria = await Criteria.create({
      key: 'test_stg1a_team_monthly',
      name: 'Test Monthly Team Goal',
      category: 'monthly',
      points: 1000,
      basis: 'per_team',
      frequency: 'monthly',
      level: 'team',
      isActive: true,
    });

    teamOneTimeCriteria = await Criteria.create({
      key: 'test_stg1a_team_onetime',
      name: 'Test One-Time Team Bonus',
      category: 'one_time',
      points: 1000,
      basis: 'per_team',
      frequency: 'one_time',
      level: 'team',
      isActive: true,
    });
  });

  after(async () => {
    await User.deleteMany({ username: { $regex: /^test_stg1a_/ } });
    await Team.deleteMany({ name: { $regex: /^Test Team Stg1a/ } });
    await Criteria.deleteMany({ key: { $regex: /^test_stg1a_/ } });
    await PointEntry.deleteMany({});
    await TeamPointEntry.deleteMany({});
    await AuditLog.deleteMany({});
    await mongoose.disconnect();
  });

  describe('1. Transaction Atomicity & AuditLog', () => {
    it('should commit entry and AuditLog together in a single transaction', async () => {
      const { req, res, next, getStatus, getData } = mockReqRes({
        user: assistantUser,
        body: {
          member: memberUser._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          date: '2026-03-01T10:00:00Z',
          note: 'Atomicity test',
        },
      });

      await entryController.createEntry(req, res, next);
      assert.strictEqual(getStatus(), 201);
      const entryId = getData().data._id;

      // Verify AuditLog exists with ENTRY_CREATE action
      const log = await AuditLog.findOne({ targetId: entryId });
      assert.ok(log, 'AuditLog must be created in the same transaction');
      assert.strictEqual(log.action, 'ENTRY_CREATE');
      assert.strictEqual(log.targetType, 'PointEntry');
      assert.strictEqual(log.performedBy.toString(), assistantUser._id.toString());
      assert.strictEqual(log.points, 20);
    });

    it('should roll back PointEntry completely if an error occurs mid-transaction', async () => {
      const countBefore = await PointEntry.countDocuments();
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await PointEntry.create(
          [
            {
              member: memberUser._id,
              team: testTeam._id,
              criteria: weeklyCriteria._id,
              quantity: 1,
              points: 20,
              date: new Date(),
              weekNumber: 45,
              month: 11,
              year: 2026,
              frequency: 'weekly',
              enteredBy: assistantUser._id,
              status: 'pending',
            },
          ],
          { session }
        );

        // Simulate mid-transaction error
        throw new Error('Simulated failure before commit');
      } catch (err) {
        await session.abortTransaction();
      } finally {
        session.endSession();
      }

      const countAfter = await PointEntry.countDocuments();
      assert.strictEqual(countAfter, countBefore, 'PointEntry must not persist after aborted transaction');
    });
  });

  describe('2. Role Restrictions & Self-Approval Prevention', () => {
    it('should reject submission from members for other members', async () => {
      const otherMember = await User.create({
        name: 'Another Member',
        username: 'test_stg1a_another_mem',
        phone: '9876543299',
        password: 'password123',
        role: 'member',
        team: testTeam._id,
      });

      const callOther = mockReqRes({
        user: memberUser,
        body: {
          member: otherMember._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
        },
      });

      await entryController.createEntry(callOther.req, callOther.res, callOther.next);
      assert.strictEqual(callOther.getStatus(), 403);
      assert.match(callOther.getData().message, /Members can only submit entries for themselves/i);

      await User.deleteOne({ _id: otherMember._id });
    });

    it('should reject assistant submitting for members of another team', async () => {
      const otherMember = await User.create({
        name: 'Other Member',
        username: 'test_stg1a_other_m',
        phone: '9000000099',
        password: 'password123',
        role: 'member',
        team: otherTeam._id,
        isActive: true,
      });

      const { req, res, next, getStatus, getData } = mockReqRes({
        user: assistantUser,
        body: {
          member: otherMember._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
        },
      });

      await entryController.createEntry(req, res, next);
      assert.strictEqual(getStatus(), 403);
      assert.match(getData().message, /own team/i);
    });

    it('should block self-approval by teamHead', async () => {
      // Create an entry where recipient member is headUser
      const [headEntry] = await PointEntry.create([
        {
          member: headUser._id,
          team: testTeam._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          points: 20,
          date: '2026-03-15T10:00:00Z',
          weekNumber: 11,
          month: 3,
          year: 2026,
          frequency: 'weekly',
          enteredBy: assistantUser._id,
          status: 'pending',
        },
      ]);

      const { req, res, next, getStatus, getData } = mockReqRes({
        user: headUser,
        params: { id: headEntry._id.toString() },
      });

      await entryController.approveEntry(req, res, next);
      assert.strictEqual(getStatus(), 403);
      assert.match(getData().message, /Self-approval is strictly prohibited/i);
    });
  });

  describe('3. Frequency-Specific Deduplication', () => {
    it('should block duplicate weekly member entry with 409', async () => {
      const date = '2026-04-05T10:00:00Z'; // week 14, 2026

      const req1 = mockReqRes({
        user: assistantUser,
        body: {
          member: memberUser._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          date,
        },
      });
      await entryController.createEntry(req1.req, req1.res, req1.next);
      assert.strictEqual(req1.getStatus(), 201);

      // Attempt duplicate for same member, criteria, week
      const req2 = mockReqRes({
        user: assistantUser,
        body: {
          member: memberUser._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          date,
        },
      });
      await entryController.createEntry(req2.req, req2.res, req2.next);
      assert.strictEqual(req2.getStatus(), 409);
      assert.match(req2.getData().message, /already exists/i);
    });

    it('should allow resubmission if previous weekly entry was rejected', async () => {
      const date = '2026-05-10T10:00:00Z'; // week 19, 2026

      // Submit entry
      const req1 = mockReqRes({
        user: assistantUser,
        body: {
          member: memberUser._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          date,
        },
      });
      await entryController.createEntry(req1.req, req1.res, req1.next);
      assert.strictEqual(req1.getStatus(), 201);
      const entryId = req1.getData().data._id;

      // Reject entry
      const reqReject = mockReqRes({
        user: headUser,
        params: { id: entryId.toString() },
        body: { reason: 'Incorrect documentation' },
      });
      await entryController.rejectEntry(reqReject.req, reqReject.res, reqReject.next);
      assert.strictEqual(reqReject.getStatus(), 200);

      // Resubmit should succeed now that prior entry is rejected
      const reqResubmit = mockReqRes({
        user: assistantUser,
        body: {
          member: memberUser._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          date,
          note: 'Resubmitted with correct info',
        },
      });
      await entryController.createEntry(reqResubmit.req, reqResubmit.res, reqResubmit.next);
      assert.strictEqual(reqResubmit.getStatus(), 201);
    });

    it('should block duplicate team one-time bonus entry with 409', async () => {
      const req1 = mockReqRes({
        user: assistantUser,
        body: {
          criteria: teamOneTimeCriteria._id,
          team: testTeam._id,
        },
      });
      await teamEntryController.createTeamEntry(req1.req, req1.res, req1.next);
      assert.strictEqual(req1.getStatus(), 201);

      // Attempt second submission of one-time bonus
      const req2 = mockReqRes({
        user: assistantUser,
        body: {
          criteria: teamOneTimeCriteria._id,
          team: testTeam._id,
        },
      });
      await teamEntryController.createTeamEntry(req2.req, req2.res, req2.next);
      assert.strictEqual(req2.getStatus(), 409);
      assert.match(req2.getData().message, /one-time bonus criterion has already been awarded/i);
    });
  });

  describe('4. Admin Direct Operations', () => {
    it('should create immediately approved entry for admin award', async () => {
      const { req, res, next, getStatus, getData } = mockReqRes({
        user: adminUser,
        body: {
          member: memberUser._id,
          criteria: monthlyCriteria._id,
          quantity: 1,
          date: '2026-06-01T10:00:00Z',
          note: 'Direct official criteria award',
        },
      });

      await entryController.adminDirectAward(req, res, next);
      assert.strictEqual(getStatus(), 201);
      assert.strictEqual(getData().data.status, 'approved');
      assert.strictEqual(getData().data.points, 50);

      const log = await AuditLog.findOne({ targetId: getData().data._id });
      assert.strictEqual(log.action, 'ADMIN_AWARD');
      assert.strictEqual(log.newStatus, 'approved');
    });

    it('should allow exceptional manual adjustments to bypass duplicate filters', async () => {
      // First adjustment
      const req1 = mockReqRes({
        user: adminUser,
        body: {
          member: memberUser._id,
          points: 15,
          reason: 'Special chapter contribution',
          date: '2026-06-01T10:00:00Z',
        },
      });
      await entryController.adminManualAdjustment(req1.req, req1.res, req1.next);
      assert.strictEqual(req1.getStatus(), 201);

      // Second adjustment in same timeframe with same points -> must SUCCEED
      const req2 = mockReqRes({
        user: adminUser,
        body: {
          member: memberUser._id,
          points: 15,
          reason: 'Another special contribution',
          date: '2026-06-01T10:00:00Z',
        },
      });
      await entryController.adminManualAdjustment(req2.req, req2.res, req2.next);
      assert.strictEqual(req2.getStatus(), 201);
    });
  });

  describe('5. Reversal Integrity & Concurrency Protection', () => {
    it('should reverse an approved entry with an offsetting transaction and AuditLog', async () => {
      // 1. Create and approve an entry
      const [approvedDoc] = await PointEntry.create([
        {
          member: memberUser._id,
          team: testTeam._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          points: 20,
          date: '2026-07-01T10:00:00Z',
          weekNumber: 27,
          month: 7,
          year: 2026,
          frequency: 'weekly',
          enteredBy: assistantUser._id,
          approvedBy: adminUser._id,
          approvedAt: new Date(),
          status: 'approved',
        },
      ]);

      // 2. Reverse it
      const reqRev = mockReqRes({
        user: adminUser,
        params: { id: approvedDoc._id.toString() },
        body: { reason: 'Incorrect attendee count' },
      });

      await entryController.reverseEntry(reqRev.req, reqRev.res, reqRev.next);
      assert.strictEqual(reqRev.getStatus(), 200);

      const revData = reqRev.getData().data;
      assert.strictEqual(revData.isReversal, true);
      assert.strictEqual(revData.points, -20);
      assert.strictEqual(revData.reversalOf._id.toString(), approvedDoc._id.toString());

      // Original document must be completely untouched
      const originalAfter = await PointEntry.findById(approvedDoc._id);
      assert.strictEqual(originalAfter.status, 'approved');
      assert.strictEqual(originalAfter.points, 20);

      // AuditLog verification
      const revLog = await AuditLog.findOne({ action: 'ENTRY_REVERSAL', targetId: approvedDoc._id });
      assert.ok(revLog);
      assert.strictEqual(revLog.points, -20);
      assert.strictEqual(revLog.metadata.reversalEntryId.toString(), revData._id.toString());
    });

    it('should reject reversing a pending or rejected entry', async () => {
      const [pendingDoc] = await PointEntry.create([
        {
          member: memberUser._id,
          team: testTeam._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          points: 20,
          date: '2026-08-01T10:00:00Z',
          weekNumber: 31,
          month: 8,
          year: 2026,
          frequency: 'weekly',
          enteredBy: assistantUser._id,
          status: 'pending',
        },
      ]);

      const reqRev = mockReqRes({
        user: adminUser,
        params: { id: pendingDoc._id.toString() },
        body: { reason: 'Invalid attempt' },
      });

      await entryController.reverseEntry(reqRev.req, reqRev.res, reqRev.next);
      assert.strictEqual(reqRev.getStatus(), 400);
      assert.match(reqRev.getData().message, /Only approved entries can be reversed/i);
    });

    it('should protect against concurrent duplicate reversals via database uniqueness', async () => {
      // Create approved entry
      const [approvedDoc] = await PointEntry.create([
        {
          member: memberUser._id,
          team: testTeam._id,
          criteria: weeklyCriteria._id,
          quantity: 1,
          points: 20,
          date: '2026-09-01T10:00:00Z',
          weekNumber: 36,
          month: 9,
          year: 2026,
          frequency: 'weekly',
          enteredBy: assistantUser._id,
          approvedBy: adminUser._id,
          approvedAt: new Date(),
          status: 'approved',
        },
      ]);

      const call1 = mockReqRes({
        user: adminUser,
        params: { id: approvedDoc._id.toString() },
        body: { reason: 'Parallel reversal request 1' },
      });

      const call2 = mockReqRes({
        user: adminUser,
        params: { id: approvedDoc._id.toString() },
        body: { reason: 'Parallel reversal request 2' },
      });

      // Execute both concurrently
      await Promise.all([
        entryController.reverseEntry(call1.req, call1.res, call1.next),
        entryController.reverseEntry(call2.req, call2.res, call2.next),
      ]);

      const statuses = [call1.getStatus(), call2.getStatus()].sort();
      assert.deepStrictEqual(statuses, [200, 409], 'Exactly one request must succeed (200) and the other must be rejected (409)');
    });
  });

  describe('6. Pagination Contract', () => {
    it('should return standardized pagination envelope', async () => {
      const { req, res, next, getStatus, getData } = mockReqRes({
        user: adminUser,
        query: { page: '1', limit: '5' },
      });

      await entryController.getEntries(req, res, next);
      assert.strictEqual(getStatus(), 200);
      assert.ok(Array.isArray(getData().data));
      assert.ok(getData().pagination);
      assert.strictEqual(getData().pagination.page, 1);
      assert.strictEqual(getData().pagination.limit, 5);
      assert.ok(typeof getData().pagination.total === 'number');
      assert.ok(typeof getData().pagination.totalPages === 'number');
    });
  });
});

