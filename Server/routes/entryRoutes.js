const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const entryController = require('../controllers/entryController');
const auth = require('../middleware/auth');

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

// Routes
router.post('/', createEntryValidation, entryController.createEntry);
router.get('/', entryController.getEntries);
router.get('/my-summary', entryController.getMySummary);
router.patch('/:id/approve', approveValidation, entryController.approveEntry);
router.patch('/:id/reject', rejectValidation, entryController.rejectEntry);

module.exports = router;

