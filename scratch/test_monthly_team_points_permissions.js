const assert = require('assert');

// Mock setup for testing teamEntryController.createTeamEntry and approveTeamEntry
const mockCriteria = {
  monthlyCriterion: {
    _id: 'crit_monthly_1',
    key: 'kitty_fee_on_time',
    name: 'Kitty fee on time payment',
    category: 'monthly',
    points: 1000,
    level: 'team',
    frequency: 'monthly',
    isActive: true,
    needsProof: false,
  },
  oneTimeCriterion: {
    _id: 'crit_onetime_1',
    key: 'bni_connect_update',
    name: '100% BNI Connect updation',
    category: 'one_time',
    points: 1000,
    level: 'team',
    frequency: 'one_time',
    isActive: true,
    needsProof: false,
  },
  memberCriterion: {
    _id: 'crit_member_1',
    key: 'on_time_attendance',
    name: 'On Time Attendance',
    category: 'meeting_day',
    points: 20,
    level: 'member',
    frequency: 'weekly',
    isActive: true,
    needsProof: false,
  },
};

const mockTeams = {
  teamA: { _id: 'team_a', name: 'Team Alpha', isActive: true },
  teamB: { _id: 'team_b', name: 'Team Beta', isActive: true },
};

// In-memory entries ledger for testing
let teamPointEntries = [];
let auditLogs = [];

// Simulate createTeamEntry controller logic exactly as implemented
async function simulateCreateTeamEntry(req) {
  const { criteria, month, year, note, proofImage, proofPublicId, team } = req.body;
  const userRole = req.user.role;

  if (!['admin', 'teamHead', 'teamAssistant'].includes(userRole)) {
    return { status: 403, body: { success: false, message: 'Members cannot submit team entries.' } };
  }

  let targetTeamId;
  if (userRole === 'teamHead') {
    if (!req.user.team) {
      return { status: 400, body: { success: false, message: 'You are not assigned to any team.' } };
    }
    if (team && team.toString() !== req.user.team.toString()) {
      return { status: 403, body: { success: false, message: 'Team heads can only submit team entries for their own team.' } };
    }
    targetTeamId = req.user.team;
  } else if (userRole === 'teamAssistant') {
    if (!req.user.team) {
      return { status: 400, body: { success: false, message: 'You are not assigned to any team.' } };
    }
    if (team && team.toString() !== req.user.team.toString()) {
      return { status: 403, body: { success: false, message: 'Team assistants can only submit team entries for their own team.' } };
    }
    targetTeamId = req.user.team;
  } else if (userRole === 'admin') {
    targetTeamId = team || req.user.team;
    if (!targetTeamId) {
      return { status: 400, body: { success: false, message: 'Team ID is required when admin submits team points.' } };
    }
  }

  const teamDoc = Object.values(mockTeams).find((t) => t._id === targetTeamId);
  if (!teamDoc || !teamDoc.isActive) {
    return { status: 404, body: { success: false, message: 'Active team not found.' } };
  }

  const criteriaDoc = Object.values(mockCriteria).find((c) => c._id === criteria);
  if (!criteriaDoc || !criteriaDoc.isActive) {
    return { status: 404, body: { success: false, message: 'Active criteria not found.' } };
  }

  if (criteriaDoc.level !== 'team') {
    return { status: 400, body: { success: false, message: 'Only team-level criteria can be submitted as a team entry.' } };
  }

  const frequency = criteriaDoc.frequency === 'one_time' || criteriaDoc.category === 'one_time' ? 'one_time' : 'monthly';

  if (userRole === 'teamHead' && frequency !== 'monthly') {
    return {
      status: 403,
      body: {
        success: false,
        message: 'Team heads can only submit monthly team points. One-time bonus achievements are submitted by team assistants or awarded by administrators.',
      },
    };
  }

  const currentDate = new Date();
  const entryMonth = month !== undefined ? parseInt(month, 10) : currentDate.getMonth() + 1;
  const entryYear = year !== undefined ? parseInt(year, 10) : currentDate.getFullYear();

  // Duplicate query
  const duplicate = teamPointEntries.find((e) => {
    if (e.team !== teamDoc._id || e.criteria !== criteriaDoc._id) return false;
    if (!['pending', 'approved'].includes(e.status)) return false;
    if (e.isReversal || e.isAdminAdjustment) return false;
    if (frequency === 'monthly') {
      return e.month === entryMonth && e.year === entryYear;
    }
    return true;
  });

  if (duplicate) {
    return {
      status: 409,
      body: {
        success: false,
        message: frequency === 'one_time'
          ? 'This one-time bonus criterion has already been awarded or submitted for this team.'
          : `A pending or approved team entry for this monthly criterion already exists for ${entryMonth}/${entryYear}.`,
      },
    };
  }

  const isAutoApproved = userRole === 'admin' || userRole === 'teamHead';
  const entryStatus = isAutoApproved ? 'approved' : 'pending';
  const approvedBy = isAutoApproved ? req.user._id : null;
  const approvedAt = isAutoApproved ? new Date() : null;

  const newEntry = {
    _id: `entry_${teamPointEntries.length + 1}`,
    team: teamDoc._id,
    criteria: criteriaDoc._id,
    points: criteriaDoc.points,
    month: entryMonth,
    year: entryYear,
    frequency,
    status: entryStatus,
    submittedBy: req.user._id,
    approvedBy,
    approvedAt,
    isAdminAdjustment: false,
    isReversal: false,
  };

  teamPointEntries.push(newEntry);

  auditLogs.push({
    action: 'ENTRY_CREATE',
    targetId: newEntry._id,
    performedBy: req.user._id,
    newStatus: entryStatus,
    autoApproved: isAutoApproved,
  });

  if (isAutoApproved) {
    auditLogs.push({
      action: 'ENTRY_APPROVE',
      targetId: newEntry._id,
      performedBy: req.user._id,
      previousStatus: 'pending',
      newStatus: 'approved',
    });
  }

  return { status: 201, body: { success: true, data: newEntry } };
}

// Simulate approveTeamEntry
async function simulateApproveTeamEntry(req, entryId) {
  const userRole = req.user.role;
  const entry = teamPointEntries.find((e) => e._id === entryId);
  if (!entry) {
    return { status: 404, body: { success: false, message: 'Team point entry not found.' } };
  }

  if (userRole !== 'admin') {
    if (userRole !== 'teamHead') {
      return { status: 403, body: { success: false, message: 'Only team heads or admins can approve team entries.' } };
    }
    if (!req.user.team || entry.team.toString() !== req.user.team.toString()) {
      return { status: 403, body: { success: false, message: 'Team heads can only approve entries for their own team.' } };
    }
    if (entry.submittedBy.toString() === req.user._id.toString()) {
      return { status: 403, body: { success: false, message: 'Self-approval is strictly prohibited. An admin must approve this entry.' } };
    }
  }

  if (entry.status === 'approved') {
    return { status: 400, body: { success: false, message: 'This team entry is already approved.' } };
  }

  entry.status = 'approved';
  entry.approvedBy = req.user._id;
  entry.approvedAt = new Date();

  auditLogs.push({
    action: 'ENTRY_APPROVE',
    targetId: entry._id,
    performedBy: req.user._id,
    newStatus: 'approved',
  });

  return { status: 200, body: { success: true, message: 'Team entry approved successfully.', data: entry } };
}

async function runTests() {
  console.log('Running Monthly Team Points Permissions & Workflow Tests...\n');

  // Test 1: Admin can submit monthly points for any team -> Automatically approved
  teamPointEntries = [];
  auditLogs = [];
  const adminReq = {
    user: { _id: 'admin_1', role: 'admin' },
    body: {
      team: 'team_b',
      criteria: 'crit_monthly_1',
      month: 11,
      year: 2026,
    },
  };
  const res1 = await simulateCreateTeamEntry(adminReq);
  assert.strictEqual(res1.status, 201, 'Admin submission should succeed');
  assert.strictEqual(res1.body.data.status, 'approved', 'Admin submission must be automatically approved');
  assert.strictEqual(res1.body.data.approvedBy, 'admin_1', 'approvedBy should be set to Admin ID');
  assert.strictEqual(res1.body.data.team, 'team_b', 'Team should be team_b');
  console.log('✓ Test 1 Passed: Admin submits monthly points for any team -> Auto-approved');

  // Test 2: Team Head can submit monthly points for own team -> Automatically approved
  const headReq = {
    user: { _id: 'head_a', role: 'teamHead', team: 'team_a' },
    body: {
      criteria: 'crit_monthly_1',
      month: 11,
      year: 2026,
    },
  };
  const res2 = await simulateCreateTeamEntry(headReq);
  assert.strictEqual(res2.status, 201, 'Team Head submission should succeed');
  assert.strictEqual(res2.body.data.status, 'approved', 'Team Head submission must be automatically approved');
  assert.strictEqual(res2.body.data.approvedBy, 'head_a', 'approvedBy should be set to Team Head ID');
  assert.strictEqual(res2.body.data.team, 'team_a', 'Target team should be own team');
  console.log('✓ Test 2 Passed: Team Head submits monthly points for own team -> Auto-approved');

  // Test 3: Team Head cannot submit monthly points for another team
  const headWrongTeamReq = {
    user: { _id: 'head_a', role: 'teamHead', team: 'team_a' },
    body: {
      team: 'team_b',
      criteria: 'crit_monthly_1',
      month: 11,
      year: 2026,
    },
  };
  const res3 = await simulateCreateTeamEntry(headWrongTeamReq);
  assert.strictEqual(res3.status, 403, 'Team Head submitting for other team must be forbidden');
  console.log('✓ Test 3 Passed: Team Head blocked from submitting for another team (HTTP 403)');

  // Test 4: Team Assistant submits monthly points -> Remains pending
  const asstReq = {
    user: { _id: 'asst_a', role: 'teamAssistant', team: 'team_a' },
    body: {
      criteria: 'crit_monthly_1',
      month: 12,
      year: 2026,
    },
  };
  const res4 = await simulateCreateTeamEntry(asstReq);
  assert.strictEqual(res4.status, 201, 'Assistant submission should succeed');
  assert.strictEqual(res4.body.data.status, 'pending', 'Assistant submission must remain pending');
  assert.strictEqual(res4.body.data.approvedBy, null, 'approvedBy must be null for pending entry');
  console.log('✓ Test 4 Passed: Team Assistant submits monthly points -> Remains pending');

  // Test 5: Team Head approves Assistant submission for own team
  const approveReq = {
    user: { _id: 'head_a', role: 'teamHead', team: 'team_a' },
  };
  const res5 = await simulateApproveTeamEntry(approveReq, res4.body.data._id);
  assert.strictEqual(res5.status, 200, 'Team Head approval must succeed');
  assert.strictEqual(res5.body.data.status, 'approved', 'Entry status must transition to approved');
  assert.strictEqual(res5.body.data.approvedBy, 'head_a', 'approvedBy must be Team Head');
  console.log('✓ Test 5 Passed: Team Head approves Assistant submission successfully');

  // Test 6: Member cannot submit monthly team points
  const memberReq = {
    user: { _id: 'mem_1', role: 'member', team: 'team_a' },
    body: {
      criteria: 'crit_monthly_1',
      month: 11,
      year: 2026,
    },
  };
  const res6 = await simulateCreateTeamEntry(memberReq);
  assert.strictEqual(res6.status, 403, 'Members must not be allowed to submit team points');
  console.log('✓ Test 6 Passed: Member blocked from submitting team points (HTTP 403)');

  // Test 7: Duplicate submissions are rejected
  const dupReq = {
    user: { _id: 'admin_1', role: 'admin' },
    body: {
      team: 'team_a',
      criteria: 'crit_monthly_1',
      month: 11,
      year: 2026,
    },
  };
  const res7 = await simulateCreateTeamEntry(dupReq);
  assert.strictEqual(res7.status, 409, 'Duplicate active submission must return 409 Conflict');
  console.log('✓ Test 7 Passed: Duplicate monthly submission rejected (HTTP 409)');

  // Test 8: One-time bonus criteria workflow unchanged
  // Team Head cannot submit one-time bonuses
  const headOneTimeReq = {
    user: { _id: 'head_a', role: 'teamHead', team: 'team_a' },
    body: {
      criteria: 'crit_onetime_1',
      month: 11,
      year: 2026,
    },
  };
  const res8 = await simulateCreateTeamEntry(headOneTimeReq);
  assert.strictEqual(res8.status, 403, 'Team Head cannot submit one-time bonuses');

  // Team Assistant can submit one-time bonuses (pending)
  const asstOneTimeReq = {
    user: { _id: 'asst_a', role: 'teamAssistant', team: 'team_a' },
    body: {
      criteria: 'crit_onetime_1',
      month: 11,
      year: 2026,
    },
  };
  const res9 = await simulateCreateTeamEntry(asstOneTimeReq);
  assert.strictEqual(res9.status, 201, 'Assistant one-time submission should succeed');
  assert.strictEqual(res9.body.data.status, 'pending', 'Assistant one-time submission remains pending');
  console.log('✓ Test 8 Passed: Existing one-time bonus workflow preserved unchanged');

  // Test 9: Self-approval protection for Team Head
  // If Team Head somehow had a pending entry submitted by themselves, they cannot approve it
  teamPointEntries.push({
    _id: 'entry_manual_pending',
    team: 'team_a',
    criteria: 'crit_monthly_1',
    status: 'pending',
    submittedBy: 'head_a',
  });
  const selfApproveRes = await simulateApproveTeamEntry(approveReq, 'entry_manual_pending');
  assert.strictEqual(selfApproveRes.status, 403, 'Self-approval must be blocked');
  console.log('✓ Test 9 Passed: Self-approval prohibited for Team Head');

  console.log('\nAll 9 Monthly Team Points permission tests passed successfully!\n');
}

runTests();
