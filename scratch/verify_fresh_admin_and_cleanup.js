const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

const authController = require('../Server/controllers/authController');
const User = require('../Server/models/User');

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

async function runLiveVerification() {
  console.log('=== STARTING LIVE DATABASE & ADMIN LOGIN VERIFICATION ===\n');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

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

  // 1. Verify Database Collection Counts
  try {
    const userCount = await db.collection('users').countDocuments();
    assert.strictEqual(userCount, 1, `Expected 1 user, found ${userCount}`);

    const teamCount = await db.collection('teams').countDocuments();
    assert.strictEqual(teamCount, 0, `Expected 0 teams, found ${teamCount}`);

    const pointCount = await db.collection('pointentries').countDocuments();
    assert.strictEqual(pointCount, 0, `Expected 0 point entries, found ${pointCount}`);

    const criteriaCount = await db.collection('criterias').countDocuments();
    assert.strictEqual(criteriaCount, 45, `Expected 45 criteria, found ${criteriaCount}`);

    const admin = await db.collection('users').findOne({ role: 'admin' });
    assert(admin, 'Admin account exists');
    assert.strictEqual(admin.email, 'admin@gmail.com', 'Admin email must be admin@gmail.com');
    assert.strictEqual(admin.role, 'admin', 'Admin role must be admin');
    assert.strictEqual(admin.team, null, 'Admin team must be null');
    assert.strictEqual(admin.isActive, true, 'Admin isActive must be true');

    recordPass('Database state: 1 Admin, 0 Teams, 0 Points, 45 Criteria preserved');
  } catch (err) {
    recordFail('Database state check', err);
  }

  const expectedEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();
  const expectedPassword = (process.env.ADMIN_PASSWORD || 'Ad@123412').trim();

  // 2. Test Live Admin Login with correct credentials
  try {
    const req = {
      body: {
        email: expectedEmail,
        password: expectedPassword,
      },
    };
    const res = createMockRes();
    await authController.login(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200, `Expected status 200, got ${res.statusCode}`);
    assert.strictEqual(res.body.success, true);
    assert(res.body.token, 'JWT token must be returned');
    assert.strictEqual(res.body.user.email, expectedEmail);
    assert.strictEqual(res.body.user.role, 'admin');
    assert.strictEqual(res.body.user.team, null);

    recordPass(`Admin login succeeds with email: ${expectedEmail} and configured password`);
  } catch (err) {
    recordFail('Admin login with correct credentials', err);
  }

  // 3. Test Live Admin Login with case-insensitive / trimmed email
  try {
    const req = {
      body: {
        email: `  ${expectedEmail.toUpperCase()}  `,
        password: expectedPassword,
      },
    };
    const res = createMockRes();
    await authController.login(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.user.email, expectedEmail);

    recordPass('Admin login handles case-insensitivity and whitespace trimming');
  } catch (err) {
    recordFail('Admin login case-insensitivity', err);
  }

  // 4. Test Login with incorrect password
  try {
    const req = {
      body: {
        email: 'admin@gmail.com',
        password: 'WrongPassword456!',
      },
    };
    const res = createMockRes();
    await authController.login(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.message, 'Invalid username or password.');

    recordPass('Login with incorrect password returns exactly "Invalid username or password."');
  } catch (err) {
    recordFail('Login with incorrect password', err);
  }

  // 5. Test Login with unknown account
  try {
    const req = {
      body: {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      },
    };
    const res = createMockRes();
    await authController.login(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.message, 'Invalid username or password.');

    recordPass('Login with unknown account returns exactly "Invalid username or password."');
  } catch (err) {
    recordFail('Login with unknown account', err);
  }

  // 6. Test Login with malformed email
  try {
    const req = {
      body: {
        email: 'not-an-email',
        password: 'SomePassword123!',
      },
    };
    const res = createMockRes();
    await authController.login(req, res, (err) => { if (err) throw err; });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.message, 'Invalid username or password.');

    recordPass('Login with malformed email returns exactly "Invalid username or password." without enumeration');
  } catch (err) {
    recordFail('Login with malformed email', err);
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await mongoose.disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runLiveVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
