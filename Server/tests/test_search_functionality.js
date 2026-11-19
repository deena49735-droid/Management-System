const mongoose = require('mongoose');
const { getEntries } = require('../controllers/entryController');
const { getTeamEntries } = require('../controllers/teamEntryController');
const PointEntry = require('../models/PointEntry');
const TeamPointEntry = require('../models/TeamPointEntry');
const Criteria = require('../models/Criteria');
const User = require('../models/User');
const Team = require('../models/Team');

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
  console.log('=== RUNNING SEARCH CONTROLLER & ISOLATION TESTS ===\n');

  // IDs for mock documents
  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();
  const user1Id = new mongoose.Types.ObjectId();
  const user2Id = new mongoose.Types.ObjectId();
  const criteria1Id = new mongoose.Types.ObjectId();
  const criteria2Id = new mongoose.Types.ObjectId();

  // Save original methods
  const origUserFind = User.find;
  const origCriteriaFind = Criteria.find;
  const origTeamFind = Team.find;
  const origPointEntryFind = PointEntry.find;
  const origPointEntryCount = PointEntry.countDocuments;
  const origTeamPointEntryFind = TeamPointEntry.find;
  const origTeamPointEntryCount = TeamPointEntry.countDocuments;

  try {
    // Mock User.find
    User.find = (filter) => {
      return {
        select: (fields) => ({
          lean: () => {
            const teamFilter = filter.team ? filter.team.toString() : null;
            const searchPattern = filter.$or ? filter.$or[0].name.source : '';

            const users = [];
            if ((!teamFilter || teamFilter === team1Id.toString()) && /alice/i.test(searchPattern)) {
              users.push({ _id: user1Id, name: 'Alice Smith', team: team1Id });
            }
            if ((!teamFilter || teamFilter === team2Id.toString()) && /bob/i.test(searchPattern)) {
              users.push({ _id: user2Id, name: 'Bob Jones', team: team2Id });
            }
            return Promise.resolve(users);
          },
        }),
      };
    };

    // Mock Criteria.find
    Criteria.find = (filter) => {
      return {
        select: (fields) => ({
          lean: () => {
            const searchPattern = filter.$or ? filter.$or[0].name.source : '';
            const crits = [];
            if (/attendance/i.test(searchPattern)) {
              crits.push({ _id: criteria1Id, name: 'Meeting Attendance' });
            }
            if (/outreach/i.test(searchPattern)) {
              crits.push({ _id: criteria2Id, name: 'Community Outreach' });
            }
            return Promise.resolve(crits);
          },
        }),
      };
    };

    // Mock Team.find
    Team.find = (filter) => {
      return {
        select: (fields) => ({
          lean: () => {
            const searchPattern = filter.name ? filter.name.source : '';
            const teams = [];
            if (/tigers/i.test(searchPattern)) {
              teams.push({ _id: team1Id, name: 'Tigers' });
            }
            if (/eagles/i.test(searchPattern)) {
              teams.push({ _id: team2Id, name: 'Eagles' });
            }
            return Promise.resolve(teams);
          },
        }),
      };
    };

    // Track captured PointEntry filters
    let capturedPointFilter = null;
    let capturedPointSkip = 0;
    let capturedPointLimit = 0;

    PointEntry.find = (filter) => {
      capturedPointFilter = filter;
      return {
        populate: function () {
          return this;
        },
        sort: function () {
          return this;
        },
        skip: function (s) {
          capturedPointSkip = s;
          return this;
        },
        limit: function (l) {
          capturedPointLimit = l;
          return Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              member: { _id: user1Id, name: 'Alice Smith' },
              team: { _id: team1Id, name: 'Tigers' },
              criteria: { _id: criteria1Id, name: 'Meeting Attendance' },
              points: 10,
              status: 'approved',
            },
          ]);
        },
      };
    };

    PointEntry.countDocuments = (filter) => {
      return Promise.resolve(1);
    };

    const next = (err) => {
      console.error('Caught error in next:', err);
    };

    // =========================================================================
    // TEST 1: Admin searching PointEntry with regex special characters
    // =========================================================================
    console.log('--- TEST 1: Regex Escaping Safety in PointEntry Search ---');
    const reqAdminRegex = {
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      query: { search: 'Alice (special+chars?*)', page: '1', limit: '10' },
    };
    const resAdminRegex = createMockRes();
    await getEntries(reqAdminRegex, resAdminRegex, next);

    assert(resAdminRegex.statusCode === 200, 'Regex special characters handled safely without throwing error');
    assert(resAdminRegex.body.success === true, 'Response indicates success: true');
    assert(resAdminRegex.body.pagination.total === 1, 'Pagination total returned correctly');
    assert(resAdminRegex.body.pagination.page === 1, 'Pagination page returned correctly');

    // =========================================================================
    // TEST 2: Tenant Isolation for Team Head / Assistant in PointEntry Search
    // =========================================================================
    console.log('\n--- TEST 2: Tenant Scoping Enforcement in PointEntry Search ---');
    const reqHead = {
      user: { _id: user1Id, role: 'teamHead', team: team1Id },
      query: { search: 'Eagles', page: '2', limit: '5' },
    };
    const resHead = createMockRes();
    await getEntries(reqHead, resHead, next);

    assert(resHead.statusCode === 200, 'Team Head search succeeds with 200 OK');
    assert(
      capturedPointFilter.team && capturedPointFilter.team.toString() === team1Id.toString(),
      'Team Head filter strictly enforces filter.team === req.user.team'
    );
    assert(Array.isArray(capturedPointFilter.$and), 'Search conditions placed in isolated $and clause');
    assert(capturedPointSkip === 5, 'Pagination skip correctly calculated for page 2 (skip=5)');
    assert(capturedPointLimit === 5, 'Pagination limit correctly applied (limit=5)');

    // =========================================================================
    // TEST 3: TeamPointEntry Search and Tenant Isolation
    // =========================================================================
    console.log('\n--- TEST 3: TeamPointEntry Search & Tenant Isolation ---');
    let capturedTeamFilter = null;
    let capturedTeamSkip = 0;
    let capturedTeamLimit = 0;

    TeamPointEntry.find = (filter) => {
      capturedTeamFilter = filter;
      return {
        populate: function () {
          return this;
        },
        sort: function () {
          return this;
        },
        skip: function (s) {
          capturedTeamSkip = s;
          return this;
        },
        limit: function (l) {
          capturedTeamLimit = l;
          return Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              team: { _id: team1Id, name: 'Tigers' },
              criteria: { _id: criteria1Id, name: 'Meeting Attendance' },
              points: 50,
              status: 'approved',
            },
          ]);
        },
      };
    };

    TeamPointEntry.countDocuments = (filter) => {
      return Promise.resolve(1);
    };

    const reqAssistantTeam = {
      user: { _id: user1Id, role: 'teamAssistant', team: team1Id },
      query: { search: 'Attendance', page: '1', limit: '10' },
    };
    const resAssistantTeam = createMockRes();
    await getTeamEntries(reqAssistantTeam, resAssistantTeam, next);

    assert(resAssistantTeam.statusCode === 200, 'Team Assistant team-entries search succeeds with 200');
    assert(
      capturedTeamFilter.team && capturedTeamFilter.team.toString() === team1Id.toString(),
      'Team Assistant strictly scoped to filter.team === req.user.team in TeamPointEntry'
    );
    assert(Array.isArray(capturedTeamFilter.$and), 'Search conditions isolated in $and clause for TeamPointEntry');
    assert(resAssistantTeam.body.pagination.total === 1, 'Team entries pagination total is 1');

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  } finally {
    // Restore original methods
    User.find = origUserFind;
    Criteria.find = origCriteriaFind;
    Team.find = origTeamFind;
    PointEntry.find = origPointEntryFind;
    PointEntry.countDocuments = origPointEntryCount;
    TeamPointEntry.find = origTeamPointEntryFind;
    TeamPointEntry.countDocuments = origTeamPointEntryCount;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
