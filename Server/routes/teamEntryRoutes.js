const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const teamEntryController = require('../controllers/teamEntryController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(auth);

// Validation for creating team point entries
const createTeamEntryValidation = [
  body('criteria')
    .isMongoId()
    .withMessage('Valid criteria ID is required'),
  body('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid 4-digit year'),
  body('team')
    .optional()
    .isMongoId()
    .withMessage('Valid team ID format is required'),
  body('note')
    .optional()
    .isString(),
  body('proofImage')
    .optional({ nullable: true })
    .isString(),
  body('proofPublicId')
    .optional({ nullable: true })
    .isString(),
];

// Validation for admin direct team criteria award
const adminTeamAwardValidation = [
  body('team')
    .isMongoId()
    .withMessage('Valid team ID is required'),
  body('criteria')
    .isMongoId()
    .withMessage('Valid criteria ID is required'),
  body('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid 4-digit year'),
  body('note')
    .optional()
    .isString(),
];

// Validation for admin manual team adjustment
const adminTeamAdjustValidation = [
  body('team')
    .isMongoId()
    .withMessage('Valid team ID is required'),
  body('points')
    .notEmpty()
    .withMessage('Points value is required')
    .isInt()
    .withMessage('Points must be a signed integer (positive or negative)'),
  body('reason')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .notEmpty()
    .withMessage('A mandatory reason is required for manual adjustments'),
  body('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid 4-digit year'),
  body('note')
    .optional()
    .isString(),
];

// Validation for approving team entry
const approveValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team entry ID format'),
];

// Validation for rejecting team entry
const rejectValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team entry ID format'),
  body('reason')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required'),
];

// Validation for reversing team entry
const reverseValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team entry ID format'),
  body('reason')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .notEmpty()
    .withMessage('Reversal reason is required'),
];

// Routes
router.post('/', createTeamEntryValidation, teamEntryController.createTeamEntry);
router.get('/', teamEntryController.getTeamEntries);

// Admin Direct Operations (Must precede /:id)
router.post('/admin/award', roleCheck('admin'), adminTeamAwardValidation, teamEntryController.adminDirectTeamAward);
router.post('/admin/adjust', roleCheck('admin'), adminTeamAdjustValidation, teamEntryController.adminManualTeamAdjustment);

// Single Entry Actions
router.patch('/:id/approve', approveValidation, teamEntryController.approveTeamEntry);
router.patch('/:id/reject', rejectValidation, teamEntryController.rejectTeamEntry);
router.post('/:id/reverse', roleCheck('admin'), reverseValidation, teamEntryController.reverseTeamEntry);

module.exports = router;
