const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const entryController = require('../controllers/entryController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All entry routes require authentication
router.use(auth);

// Validation for creating member point entries
const createEntryValidation = [
  body('member')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('criteria')
    .isMongoId()
    .withMessage('Valid criteria ID is required'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer of at least 1'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('note')
    .optional()
    .isString(),
  body('proofImage')
    .optional({ nullable: true })
    .isString(),
];

// Validation for admin direct criteria award
const adminAwardValidation = [
  body('member')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('criteria')
    .isMongoId()
    .withMessage('Valid criteria ID is required'),
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be an integer of at least 1'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('note')
    .optional()
    .isString(),
];

// Validation for admin manual adjustment
const adminAdjustValidation = [
  body('member')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('points')
    .notEmpty()
    .withMessage('Points value is required')
    .isInt()
    .withMessage('Points must be a signed integer (positive or negative)'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('A mandatory reason is required for manual adjustments'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('note')
    .optional()
    .isString(),
];

// Validation for approving entry
const approveValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID format'),
];

// Validation for rejecting entry
const rejectValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID format'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required'),
];

// Validation for reversing entry
const reverseValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid entry ID format'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reversal reason is required'),
];

// Routes
router.post('/', createEntryValidation, entryController.createEntry);
router.get('/', entryController.getEntries);
router.get('/my-summary', entryController.getMySummary);
router.get('/my-breakdown', entryController.getMyBreakdown);

// Admin Direct Operations (Must precede /:id)
router.post('/admin/award', roleCheck('admin'), adminAwardValidation, entryController.adminDirectAward);
router.post('/admin/adjust', roleCheck('admin'), adminAdjustValidation, entryController.adminManualAdjustment);

// Single Entry Actions
router.patch('/:id/approve', approveValidation, entryController.approveEntry);
router.patch('/:id/reject', rejectValidation, entryController.rejectEntry);
router.post('/:id/reverse', roleCheck('admin'), reverseValidation, entryController.reverseEntry);

module.exports = router;
