const assert = require('assert');

// Simulate the exact extraction, filtering and sorting logic from AdminNewEntry.jsx
function processTeamMembers(teamRes, usersRes) {
  const candidateList = [];

  if (teamRes?.status === 'fulfilled' && teamRes.value?.data?.data) {
    const teamDoc = teamRes.value.data.data;
    if (teamDoc.head && typeof teamDoc.head === 'object') {
      candidateList.push(teamDoc.head);
    }
    if (teamDoc.assistant && typeof teamDoc.assistant === 'object') {
      candidateList.push(teamDoc.assistant);
    }
    if (Array.isArray(teamDoc.members)) {
      teamDoc.members.forEach((m) => {
        if (m && typeof m === 'object') {
          candidateList.push(m);
        }
      });
    }
  }

  if (usersRes?.status === 'fulfilled' && usersRes.value?.data?.data) {
    const userArray = usersRes.value.data.data.users || usersRes.value.data.data;
    if (Array.isArray(userArray)) {
      userArray.forEach((u) => {
        if (u && typeof u === 'object') {
          candidateList.push(u);
        }
      });
    }
  }

  const seen = new Set();
  const validMembers = [];

  candidateList.forEach((u) => {
    const uid = (u._id || u.id)?.toString();
    if (!uid) return;
    if (seen.has(uid)) return;
    seen.add(uid);

    // Enforce: Must be active, must NOT be admin, must have valid chapter role
    if (u.isActive === false) return;
    if (u.role === 'admin') return;
    if (!['member', 'teamHead', 'teamAssistant'].includes(u.role)) return;

    validMembers.push(u);
  });

  validMembers.sort((a, b) => {
    const roleOrder = { teamHead: 1, teamAssistant: 2, member: 3 };
    const orderA = roleOrder[a.role] || 4;
    const orderB = roleOrder[b.role] || 4;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });

  return validMembers;
}

function runTests() {
  console.log('Running Admin Member Dropdown Processing Tests...\n');

  // Test 1: Extracts Head, Assistant, and Members from teamRes
  const teamRes1 = {
    status: 'fulfilled',
    value: {
      data: {
        success: true,
        data: {
          _id: 'team1',
          name: 'Phoenix Warriors',
          head: { _id: 'user_head_1', name: 'Alice Head', username: 'alice', role: 'teamHead', isActive: true },
          assistant: { _id: 'user_asst_1', name: 'Bob Assistant', username: 'bob', role: 'teamAssistant', isActive: true },
          members: [
            { _id: 'user_mem_1', name: 'Charlie Member', username: 'charlie', role: 'member', isActive: true },
            { _id: 'user_mem_2', name: 'David Member', username: 'david', role: 'member', isActive: true },
          ],
        },
      },
    },
  };
  const usersRes1 = { status: 'rejected', reason: new Error('Network error') };

  const res1 = processTeamMembers(teamRes1, usersRes1);
  assert.strictEqual(res1.length, 4, 'Should include 4 active chapter accounts');
  assert.strictEqual(res1[0]._id, 'user_head_1', 'Team Head should be first');
  assert.strictEqual(res1[1]._id, 'user_asst_1', 'Team Assistant should be second');
  assert.strictEqual(res1[2]._id, 'user_mem_1', 'Charlie should be third');
  assert.strictEqual(res1[3]._id, 'user_mem_2', 'David should be fourth');
  console.log('✓ Test 1 Passed: Head, Assistant, and Members extracted and sorted in role order');

  // Test 2: Filters out Admin accounts and Inactive accounts
  const teamRes2 = {
    status: 'fulfilled',
    value: {
      data: {
        success: true,
        data: {
          _id: 'team2',
          head: { _id: 'user_admin_1', name: 'Super Admin', username: 'admin', role: 'admin', isActive: true },
          assistant: { _id: 'user_asst_2', name: 'Inactive Asst', username: 'inasst', role: 'teamAssistant', isActive: false },
          members: [
            { _id: 'user_mem_3', name: 'Active Member', username: 'active', role: 'member', isActive: true },
            { _id: 'user_mem_4', name: 'Inactive Member', username: 'inactive', role: 'member', isActive: false },
          ],
        },
      },
    },
  };
  const res2 = processTeamMembers(teamRes2, null);
  assert.strictEqual(res2.length, 1, 'Should filter out admin and inactive accounts');
  assert.strictEqual(res2[0]._id, 'user_mem_3', 'Only active chapter member should remain');
  console.log('✓ Test 2 Passed: Inactive and Admin accounts strictly excluded');

  // Test 3: Deduplicates accounts present in both teamRes and usersRes
  const teamRes3 = {
    status: 'fulfilled',
    value: {
      data: {
        success: true,
        data: {
          _id: 'team3',
          head: { _id: 'u1', name: 'Leader One', role: 'teamHead', isActive: true },
          members: [{ _id: 'u2', name: 'Member Two', role: 'member', isActive: true }],
        },
      },
    },
  };
  const usersRes3 = {
    status: 'fulfilled',
    value: {
      data: {
        success: true,
        data: {
          users: [
            { _id: 'u1', name: 'Leader One', role: 'teamHead', isActive: true },
            { _id: 'u2', name: 'Member Two', role: 'member', isActive: true },
            { _id: 'u3', name: 'Member Three', role: 'member', isActive: true },
          ],
        },
      },
    },
  };
  const res3 = processTeamMembers(teamRes3, usersRes3);
  assert.strictEqual(res3.length, 3, 'Should deduplicate u1 and u2, resulting in 3 unique users');
  const ids = res3.map((m) => m._id);
  // u1 is teamHead; u3 ('Member Three') precedes u2 ('Member Two') alphabetically
  assert.deepStrictEqual(ids, ['u1', 'u3', 'u2']);
  console.log('✓ Test 3 Passed: Deduplication succeeds across both API sources and sorts alphabetically');

  // Test 4: Format for dropdown labels and unique IDs
  const options = res1.map((m) => {
    const roleTag =
      m.role === 'teamHead'
        ? ' • Team Head'
        : m.role === 'teamAssistant'
        ? ' • Team Assistant'
        : '';
    const usernameTag = m.username ? ` (@${m.username})` : '';
    return {
      value: m._id,
      label: `${m.name}${usernameTag}${roleTag}`,
    };
  });

  assert.strictEqual(options[0].value, 'user_head_1');
  assert.strictEqual(options[0].label, 'Alice Head (@alice) • Team Head');
  assert.strictEqual(options[1].value, 'user_asst_1');
  assert.strictEqual(options[1].label, 'Bob Assistant (@bob) • Team Assistant');
  assert.strictEqual(options[2].value, 'user_mem_1');
  assert.strictEqual(options[2].label, 'Charlie Member (@charlie)');
  console.log('✓ Test 4 Passed: Dropdown option values are user IDs and labels have role badges');

  // Test 5: Empty state handling
  const teamResEmpty = {
    status: 'fulfilled',
    value: {
      data: {
        success: true,
        data: {
          _id: 'team_empty',
          name: 'Empty Team',
          head: null,
          assistant: null,
          members: [],
        },
      },
    },
  };
  const resEmpty = processTeamMembers(teamResEmpty, null);
  assert.strictEqual(resEmpty.length, 0, 'Should return empty array when no members exist');
  console.log('✓ Test 5 Passed: Empty state handled cleanly');

  console.log('\nAll 5 Admin Member Dropdown tests passed successfully!\n');
}

runTests();
