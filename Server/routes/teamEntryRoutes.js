const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const teamEntryController = require('../controllers/teamEntryController');
const auth = require('../middleware/auth');

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
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required'),
];

// Routes
router.post('/', createTeamEntryValidation, teamEntryController.createTeamEntry);
router.get('/', teamEntryController.getTeamEntries);
router.patch('/:id/approve', approveValidation, teamEntryController.approveTeamEntry);
router.patch('/:id/reject', rejectValidation, teamEntryController.rejectTeamEntry);

module.exports = router;

