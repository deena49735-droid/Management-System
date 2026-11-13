const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Protect all user management routes with auth and admin role check
router.use(auth, roleCheck('admin'));

// Validation rules for user creation
const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('phone')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be a valid 10-digit number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'teamHead', 'teamAssistant', 'member'])
    .withMessage('Role must be one of: admin, teamHead, teamAssistant, member'),
  body('team')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid team ID format'),
];

// Validation rules for user updates
const updateUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone')
    .optional()
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
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Routes
router.post('/', createUserValidation, userController.createUser);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', updateUserValidation, userController.updateUser);
router.patch('/:id/reset-password', resetPasswordValidation, userController.resetPassword);
router.delete('/:id', userController.deactivateUser);

module.exports = router;

