const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { validatePassword } = require('../utils/passwordValidator');

// Protect all user management routes with auth and admin role check
router.use(auth, roleCheck('admin'));

// Validation rules for user creation
const createUserValidation = [
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .isString()
    .withMessage('Email must be a string')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('username')
    .optional()
    .isString()
    .withMessage('Username must be a string')
    .trim(),
  body('phone')
    .isString()
    .withMessage('Phone must be a string')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be a valid 10-digit number'),
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .custom((value, { req }) => {
      const result = validatePassword(value, {
        email: req.body.email,
        username: req.body.username,
        name: req.body.name,
        phone: req.body.phone,
      });
      if (!result.isValid) {
        throw new Error(result.message);
      }
      return true;
    }),
  body('role')
    .optional()
    .custom((val) => {
      if (val && val !== 'member') {
        throw new Error('New members can only be created with the Member role. Team role assignments are managed after creation.');
      }
      return true;
    }),
  body('team')
    .optional({ nullable: true, checkFalsy: true })
    .custom((val) => {
      if (val) {
        throw new Error('Team assignment during member creation is not allowed. Assign members to teams after creation.');
      }
      return true;
    }),
];

// Validation rules for user updates
const updateUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('email')
    .optional()
    .isString()
    .withMessage('Email must be a string')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('username')
    .optional()
    .isString()
    .withMessage('Username must be a string')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-z0-9._]+$/)
    .withMessage('Username can only contain lowercase letters, numbers, dot, and underscore'),
  body('phone')
    .optional()
    .isString()
    .withMessage('Phone must be a string')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be a valid 10-digit number'),
  body('role')
    .optional()
    .isIn(['admin', 'teamHead', 'teamAssistant', 'member'])
    .withMessage('Role must be one of: admin, teamHead, teamAssistant, member'),
  body('team')
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null || val === '' || /^[0-9a-fA-F]{24}$/.test(val)) {
        return true;
      }
      throw new Error('Invalid team ID format');
    }),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

// Validation rules for resetting password
const resetPasswordValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .custom((value, { req }) => {
      const result = validatePassword(value, {
        email: req.body.email,
        username: req.body.username,
        name: req.body.name,
        phone: req.body.phone,
      });
      if (!result.isValid) {
        throw new Error(result.message);
      }
      return true;
    }),
];

// Routes
router.post('/', createUserValidation, userController.createUser);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', updateUserValidation, userController.updateUser);
router.patch('/:id/reset-password', resetPasswordValidation, userController.resetPassword);
router.delete('/:id', userController.deactivateUser);

module.exports = router;

