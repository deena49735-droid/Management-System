const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const criteriaController = require('../controllers/criteriaController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// GET /api/criteria/structure is accessible to any logged-in user
router.get('/structure', auth, criteriaController.getCriteriaStructure);

// GET /api/criteria is accessible to any logged-in user
router.get('/', auth, criteriaController.getCriteria);

// Validation rules for criteria creation
const createValidation = [
  body('key')
    .trim()
    .notEmpty()
    .withMessage('Key is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('category')
    .isIn(['meeting_day', 'non_meeting_day', 'monthly', 'one_time', 'penalty'])
    .withMessage('Invalid criteria category'),
  body('points')
    .isNumeric()
    .withMessage('Points must be a valid number'),
  body('level')
    .isIn(['member', 'team'])
    .withMessage('Level must be either member or team'),
  body('basis')
    .optional()
    .isIn([
      'per_member',
      'per_team',
      'per_visitor',
      'per_testimonial',
      'per_specific_ask',
      'per_week',
      'per_month',
    ])
    .withMessage('Invalid basis'),
  body('frequency')
    .optional()
    .isIn(['weekly', 'monthly', 'one_time'])
    .withMessage('Invalid frequency'),
];

// Validation rules for criteria update
const updateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid criteria ID format'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('points')
    .optional()
    .isNumeric()
    .withMessage('Points must be a valid number'),
  body('needsProof')
    .optional()
    .isBoolean()
    .withMessage('needsProof must be a boolean'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('basisLabel')
    .optional()
    .trim(),
  body('displayOrder')
    .optional()
    .isNumeric(),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid criteria ID format'),
];

// Admin-only mutation routes
router.post('/', auth, roleCheck('admin'), createValidation, criteriaController.createCriteria);
router.put('/:id', auth, roleCheck('admin'), updateValidation, criteriaController.updateCriteria);
router.delete('/:id', auth, roleCheck('admin'), idParamValidation, criteriaController.deactivateCriteria);

module.exports = router;
