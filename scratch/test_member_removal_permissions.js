const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

const teamController = require('../Server/controllers/teamController');
const User = require('../Server/models/User');
const Team = require('../Server/models/Team');
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
  console.log('=== STARTING MEMBER REMOVAL PERMISSIONS & AUDIT LOG TESTS ===\n');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

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

  // Find Admin
  const admin = await User.findOne({ role: 'admin' });
  assert(admin, 'Admin account must exist');

  // Create temporary test users and teams
  const suffix = Date.now();
  let headA, assistantA, memberA1, memberA2;
  let headB, assistantB, memberB1;
  let teamA, teamB;

  try {
    headA = await User.create({
      name: `Head A ${suffix}`,
      username: `heada_${suffix}`,
      phone: `91${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'teamHead',
      isActive: true,
    });

    assistantA = await User.create({
      name: `Assistant A ${suffix}`,
      username: `assta_${suffix}`,
      phone: `92${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'teamAssistant',
      isActive: true,
    });

    memberA1 = await User.create({
      name: `Member A1 ${suffix}`,
      username: `mem1_${suffix}`,
      phone: `93${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'member',
      isActive: true,
    });

    memberA2 = await User.create({
      name: `Member A2 ${suffix}`,
      username: `mem2_${suffix}`,
      phone: `94${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'member',
      isActive: true,
    });

    teamA = await Team.create({
      name: `Team Alpha ${suffix}`,
      head: headA._id,
      assistant: assistantA._id,
      members: [memberA1._id, memberA2._id],
      isActive: true,
    });

    headA.team = teamA._id;
    await headA.save();
    assistantA.team = teamA._id;
    await assistantA.save();
    memberA1.team = teamA._id;
    await memberA1.save();
    memberA2.team = teamA._id;
    await memberA2.save();

    // Create Team B
    headB = await User.create({
      name: `Head B ${suffix}`,
      username: `headb_${suffix}`,
      phone: `95${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'teamHead',
      isActive: true,
    });

    assistantB = await User.create({
      name: `Assistant B ${suffix}`,
      username: `asstb_${suffix}`,
      phone: `96${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'teamAssistant',
      isActive: true,
    });

    memberB1 = await User.create({
      name: `Member B1 ${suffix}`,
      username: `memb1_${suffix}`,
      phone: `97${String(suffix).slice(-8)}`,
      password: 'Password123!@#',
      role: 'member',
      isActive: true,
    });

    teamB = await Team.create({
      name: `Team Beta ${suffix}`,
      head: headB._id,
      assistant: assistantB._id,
      members: [memberB1._id],
      isActive: true,
    });

    headB.team = teamB._id;
    await headB.save();
    assistantB.team = teamB._id;
    await assistantB.save();
    memberB1.team = teamB._id;
    await memberB1.save();

    console.log('✅ Temporary test fixtures created.\n');

    // TEST 1: Team Assistant attempts to remove member -> Must be rejected (403)
    try {
      const req = {
        user: assistantA,
        params: { id: teamA._id.toString(), userId: memberA1._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 403, `Expected 403 for Team Assistant, got ${res.statusCode}`);
      assert(res.body.message.includes('Team Assistants do not have permission'));
      recordPass('Team Assistant removal attempt is rejected with 403 Forbidden');
    } catch (err) {
      recordFail('Team Assistant removal attempt check', err);
    }

    // TEST 2: Team Head attempts to remove member from another team (cross-team) -> Must be rejected (403)
    try {
      const req = {
        user: headA,
        params: { id: teamB._id.toString(), userId: memberB1._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 403, `Expected 403 for cross-team removal, got ${res.statusCode}`);
      assert(res.body.message.includes('only remove members from your own assigned team'));
      recordPass('Team Head cross-team removal attempt is rejected with 403 Forbidden');
    } catch (err) {
      recordFail('Team Head cross-team removal check', err);
    }

    // TEST 3: Team Head attempts to remove themselves -> Must be rejected (403)
    try {
      const req = {
        user: headA,
        params: { id: teamA._id.toString(), userId: headA._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 403);
      assert(res.body.message.includes('cannot remove themselves'));
      recordPass('Team Head self-removal attempt is rejected with 403 Forbidden');
    } catch (err) {
      recordFail('Team Head self-removal check', err);
    }

    // TEST 4: Team Head attempts to remove Team Assistant -> Must be rejected (403)
    try {
      const req = {
        user: headA,
        params: { id: teamA._id.toString(), userId: assistantA._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 403);
      assert(res.body.message.includes('cannot remove Team Assistants'));
      recordPass('Team Head attempt to remove Team Assistant is rejected with 403 Forbidden');
    } catch (err) {
      recordFail('Team Head removing Assistant check', err);
    }

    // TEST 5: Team Head attempts to remove Admin -> Must be rejected (403)
    try {
      const req = {
        user: headA,
        params: { id: teamA._id.toString(), userId: admin._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 404); // Admin is not even in team members
      recordPass('Team Head attempt to remove Admin is rejected (not a member)');
    } catch (err) {
      recordFail('Team Head removing Admin check', err);
    }

    // TEST 6: Team Head successfully removes Member A1 from their own team
    try {
      const req = {
        user: headA,
        params: { id: teamA._id.toString(), userId: memberA1._id.toString() },
        body: { reason: 'Relocated to another district' },
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Member removed from team successfully.');

      // Verify User record in DB: account must be preserved, team must be null
      const updatedUser = await User.findById(memberA1._id);
      assert(updatedUser, 'Member account must still exist in DB');
      assert.strictEqual(updatedUser.team, null, 'User team must be cleared to null');
      assert.strictEqual(updatedUser.role, 'member', 'User role must remain member');
      assert.strictEqual(updatedUser.isActive, true, 'User isActive must remain true');

      // Verify Team record in DB: memberA1 removed from members array
      const updatedTeam = await Team.findById(teamA._id);
      const stillInMembers = updatedTeam.members.some((m) => m.toString() === memberA1._id.toString());
      assert.strictEqual(stillInMembers, false, 'Member must be removed from team.members');
      assert.strictEqual(updatedTeam.members.length, 1, 'Team A must have 1 member remaining (Member A2)');

      // Verify AuditLog record in DB
      const audit = await AuditLog.findOne({
        action: 'MEMBER_REMOVE',
        targetId: memberA1._id,
      }).sort({ createdAt: -1 });

      assert(audit, 'AuditLog entry must be created');
      assert.strictEqual(audit.performedBy.toString(), headA._id.toString());
      assert.strictEqual(audit.metadata.teamId.toString(), teamA._id.toString());
      assert.strictEqual(audit.metadata.performedByRole, 'teamHead');
      assert.strictEqual(audit.reason, 'Relocated to another district');

      recordPass('Team Head successfully removes own team member with AuditLog and account preservation');
    } catch (err) {
      recordFail('Team Head successful removal check', err);
    }

    // TEST 7: Team Head removes via /api/teams/my/members/:userId (without :id in params)
    try {
      const req = {
        user: headA,
        params: { userId: memberA2._id.toString() },
        body: {},
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);

      // Verify memberA2 team assignment is cleared
      const updatedUser = await User.findById(memberA2._id);
      assert.strictEqual(updatedUser.team, null);

      recordPass('Team Head removal via /my/members/:userId route succeeds seamlessly');
    } catch (err) {
      recordFail('Team Head /my/members removal check', err);
    }

    // TEST 8: Admin removes member from any team (Global authority)
    try {
      const req = {
        user: admin,
        params: { id: teamB._id.toString(), userId: memberB1._id.toString() },
        body: { reason: 'Admin reassignment' },
      };
      const res = createMockRes();
      await teamController.removeMember(req, res, (err) => { if (err) throw err; });

      assert.strictEqual(res.statusCode, 200, `Expected 200 for Admin, got ${res.statusCode}`);
      assert.strictEqual(res.body.success, true);

      // Verify memberB1 team assignment is cleared
      const updatedUser = await User.findById(memberB1._id);
      assert.strictEqual(updatedUser.team, null);

      // Verify AuditLog for Admin
      const audit = await AuditLog.findOne({
        action: 'MEMBER_REMOVE',
        targetId: memberB1._id,
      }).sort({ createdAt: -1 });

      assert(audit, 'Admin removal audit entry must exist');
      assert.strictEqual(audit.performedBy.toString(), admin._id.toString());
      assert.strictEqual(audit.metadata.performedByRole, 'admin');

      recordPass('Admin retains global removal authority across all teams with AuditLog');
    } catch (err) {
      recordFail('Admin removal check', err);
    }

  } finally {
    // Clean up temporary test fixtures
    console.log('\nCleaning up temporary test fixtures...');
    const userIdsToClean = [
      headA?._id, assistantA?._id, memberA1?._id, memberA2?._id,
      headB?._id, assistantB?._id, memberB1?._id,
    ].filter(Boolean);

    const teamIdsToClean = [teamA?._id, teamB?._id].filter(Boolean);

    if (userIdsToClean.length > 0) {
      await User.deleteMany({ _id: { $in: userIdsToClean } });
      await AuditLog.deleteMany({ targetId: { $in: userIdsToClean } });
    }
    if (teamIdsToClean.length > 0) {
      await Team.deleteMany({ _id: { $in: teamIdsToClean } });
    }
    console.log('✅ Temporary test fixtures cleaned up.');
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
