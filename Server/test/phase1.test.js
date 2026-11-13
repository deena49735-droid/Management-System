const { describe, it } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

// Ensure JWT_SECRET is set for tests
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.NODE_ENV = 'test';

const User = require('../models/User');
const Team = require('../models/Team');
const roleCheck = require('../middleware/roleCheck');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');

describe('Phase 1 Tests', () => {
  describe('User Model Schema & Methods', () => {
    it('should validate required fields: name, username, phone, password', async () => {
      const user = new User();
      let err;
      try {
        await user.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err);
      assert.ok(err.errors.name, 'Name should be required');
      assert.ok(err.errors.username, 'Username should be required');
      assert.ok(err.errors.phone, 'Phone should be required');
      assert.ok(err.errors.password, 'Password should be required');
    });

    it('should default role to member and isActive to true', () => {
      const user = new User({
        name: 'John Doe',
        username: 'johndoe',
        phone: '1234567890',
        password: 'password123',
      });
      assert.strictEqual(user.role, 'member');
      assert.strictEqual(user.isActive, true);
    });

    it('should reject invalid roles', async () => {
      const user = new User({
        name: 'John Doe',
        username: 'johndoe',
        phone: '1234567890',
        password: 'password123',
        role: 'superUser', // invalid
      });
      let err;
      try {
        await user.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err);
      assert.ok(err.errors.role, 'Role should be invalid');
    });

    it('should validate password minlength >= 6', async () => {
      const user = new User({
        name: 'John Doe',
        username: 'johndoe',
        phone: '1234567890',
        password: '123',
      });
      let err;
      try {
        await user.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err);
      assert.ok(err.errors.password, 'Password minlength validation should fail');
    });

    it('should correctly compare password using comparePassword method', async () => {
      const plainPassword = 'SecretPassword123';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      const user = new User({
        name: 'Jane Doe',
        username: 'janedoe',
        phone: '9876543210',
        password: hashedPassword,
      });

      const isMatch = await user.comparePassword(plainPassword);
      assert.strictEqual(isMatch, true);

      const isWrongMatch = await user.comparePassword('WrongPassword');
      assert.strictEqual(isWrongMatch, false);
    });

    it('should exclude password when serialized via toJSON', () => {
      const user = new User({
        name: 'Jane Doe',
        username: 'janedoe',
        phone: '9876543210',
        password: 'SecretPassword123',
      });
      const json = user.toJSON();
      assert.strictEqual(json.password, undefined);
      assert.strictEqual(json.name, 'Jane Doe');
    });
  });

  describe('Team Model Schema', () => {
    it('should validate required name', async () => {
      const team = new Team();
      let err;
      try {
        await team.validate();
      } catch (e) {
        err = e;
      }
      assert.ok(err);
      assert.ok(err.errors.name, 'Team name should be required');
    });

    it('should default isActive to true and members to array', () => {
      const team = new Team({ name: 'Alpha Warriors' });
      assert.strictEqual(team.isActive, true);
      assert.ok(Array.isArray(team.members));
      assert.strictEqual(team.members.length, 0);
    });
  });

  describe('roleCheck Middleware', () => {
    it('should return 401 if req.user is missing', () => {
      const middleware = roleCheck('admin');
      let statusCalled = null;
      let jsonCalled = null;
      const req = {};
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(statusCalled, 401);
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(jsonCalled.success, false);
    });

    it('should return 403 if user role is not allowed', () => {
      const middleware = roleCheck('admin', 'teamHead');
      let statusCalled = null;
      let jsonCalled = null;
      const req = { user: { role: 'member' } };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(statusCalled, 403);
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(jsonCalled.success, false);
    });

    it('should call next() if user role is allowed', () => {
      const middleware = roleCheck('admin', 'teamHead');
      const req = { user: { role: 'admin' } };
      const res = {};
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
    });
  });

  describe('auth Middleware', () => {
    it('should return 401 if Authorization header is missing', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = { headers: {} };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };

      await auth(req, res, () => {});

      assert.strictEqual(statusCalled, 401);
      assert.strictEqual(jsonCalled.success, false);
    });

    it('should return 401 if token is invalid', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = { headers: { authorization: 'Bearer invalid.token.here' } };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };

      await auth(req, res, () => {});

      assert.strictEqual(statusCalled, 401);
      assert.strictEqual(jsonCalled.success, false);
    });
  });

  describe('Auth Controller Input Validation', () => {
    it('should return 400 if username or password is empty', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = { body: { username: '', password: '' } };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };

      await authController.login(req, res, () => {});

      assert.strictEqual(statusCalled, 400);
      assert.strictEqual(jsonCalled.success, false);
    });

    it('adminOnlyTest should respond with admin user info', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = { user: { _id: '123', name: 'Admin User', role: 'admin' } };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => {
              jsonCalled = data;
            },
          };
        },
      };

      await authController.adminOnlyTest(req, res);

      assert.strictEqual(statusCalled, 200);
      assert.strictEqual(jsonCalled.success, true);
      assert.strictEqual(jsonCalled.user.role, 'admin');
    });
  });
});
