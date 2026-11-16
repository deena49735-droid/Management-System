const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/VIGNESHBABU T G/OneDrive/Documents/DTG/PROJECTS/Management System/Server/.env' });

const { validatePassword } = require('../Server/utils/passwordValidator');
const authController = require('../Server/controllers/authController');
const userController = require('../Server/controllers/userController');
const User = require('../Server/models/User');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('=== STARTING EMAIL AUTH & ENTRIES VALIDATION TESTS ===\n');

  // Test 1: Password validation with email context
  runTest('Password validator rejects password containing email prefix', () => {
    const res = validatePassword('RajeshKumar@123!', {
      email: 'rajeshkumar@example.com',
      name: 'Other Name',
      phone: '9876543210'
    });
    assert.strictEqual(res.isValid, false);
    assert(res.message.includes('email address'), `Expected email rejection message, got: ${res.message}`);
  });

  runTest('Password validator accepts strong password without email prefix', () => {
    const res = validatePassword('Xy9#kL2$mQ8!vP1*', {
      email: 'rajeshkumar@example.com',
      name: 'Other Name',
      phone: '9876543210'
    });
    assert.strictEqual(res.isValid, true);
  });

  // Test 2: createUser validation
  await runAsyncTest('createUser rejects invalid email format', async () => {
    const req = {
      body: {
        name: 'Test Member',
        email: 'invalid-email-format',
        phone: '9876543299',
        password: 'ValidPassword123#$'
      }
    };
    let statusCode = null;
    let responseData = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await userController.createUser(req, res, (err) => { if (err) throw err; });
    assert.strictEqual(statusCode, 400);
    assert(responseData.message.includes('valid email address'), `Expected email validation error, got: ${responseData.message}`);
  });

  // Test 3: createUser rejects duplicate email
  await runAsyncTest('createUser rejects duplicate email', async () => {
    const origFindOne = User.findOne;
    try {
      User.findOne = async (query) => {
        if (query.email) {
          return { _id: 'existing_id', email: query.email };
        }
        return null;
      };

      const req = {
        body: {
          name: 'Test Member',
          email: 'duplicate@example.com',
          phone: '9876543299',
          password: 'ValidPassword123#$'
        }
      };
      let statusCode = null;
      let responseData = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        }
      };

      await userController.createUser(req, res, (err) => { if (err) throw err; });
      assert.strictEqual(statusCode, 409);
      assert(responseData.message.includes('email address already exists'), `Expected duplicate email error, got: ${responseData.message}`);
    } finally {
      User.findOne = origFindOne;
    }
  });

  // Test 4: updateUser rejects duplicate email
  await runAsyncTest('updateUser rejects duplicate email from another user', async () => {
    const origFindById = User.findById;
    const origFindOne = User.findOne;
    try {
      User.findById = async (id) => ({
        _id: 'user_123',
        role: 'member',
        email: 'user123@example.com',
        phone: '9876543210',
        name: 'Test User',
        save: async () => {}
      });
      User.findOne = async (query) => {
        if (query.email) {
          return { _id: 'other_user_456', email: query.email };
        }
        return null;
      };

      const req = {
        params: { id: '60c72b2f9b1d8b2badbee555' },
        user: { _id: 'admin_id', role: 'admin' },
        body: {
          email: 'taken@example.com'
        }
      };
      let statusCode = null;
      let responseData = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        }
      };

      await userController.updateUser(req, res, (err) => { if (err) throw err; });
      assert.strictEqual(statusCode, 409);
      assert(responseData.message.includes('email address already exists'), `Expected duplicate email error, got: ${responseData.message}`);
    } finally {
      User.findById = origFindById;
      User.findOne = origFindOne;
    }
  });

  // Test 5: authController.login accepts email and normalizes
  await runAsyncTest('authController.login finds user by email or legacy username', async () => {
    const origFindOne = User.findOne;
    try {
      let queryReceived = null;
      User.findOne = (query) => {
        queryReceived = query;
        return {
          select: () => ({
            _id: 'mock_user_id',
            name: 'Rajesh',
            email: 'rajesh@example.com',
            role: 'teamAssistant',
            isActive: true,
            comparePassword: async (pwd) => pwd === 'CorrectPassword123#$'
          })
        };
      };

      const req = {
        body: {
          email: '  Rajesh@Example.COM  ',
          password: 'CorrectPassword123#$'
        }
      };
      let statusCode = null;
      let responseData = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        }
      };

      await authController.login(req, res, (err) => { if (err) throw err; });
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.user.email, 'rajesh@example.com');
      assert.deepStrictEqual(queryReceived.$or, [
        { email: 'rajesh@example.com' },
        { username: 'rajesh@example.com' }
      ]);
    } finally {
      User.findOne = origFindOne;
    }
  });

  // Test 6: authController.login rejects non-matching credentials
  await runAsyncTest('authController.login rejects invalid password', async () => {
    const origFindOne = User.findOne;
    try {
      User.findOne = () => ({
        select: () => ({
          _id: 'mock_user_id',
          name: 'Rajesh',
          email: 'rajesh@example.com',
          role: 'teamAssistant',
          isActive: true,
          comparePassword: async () => false
        })
      });

      const req = {
        body: {
          email: 'rajesh@example.com',
          password: 'WrongPassword123#$'
        }
      };
      let statusCode = null;
      let responseData = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        }
      };

      await authController.login(req, res, (err) => { if (err) throw err; });
      assert.strictEqual(statusCode, 401);
      assert(
      responseData.message.includes('Invalid username or password') ||
      responseData.message.includes('Invalid email or password')
    );
    } finally {
      User.findOne = origFindOne;
    }
  });

  console.log(`\n=== TEST RESULTS ===`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
