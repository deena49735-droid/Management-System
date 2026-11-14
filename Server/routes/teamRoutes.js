const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Authentication middleware required for all team routes
router.use(auth);

// GET /api/teams/my - accessible to any logged-in user who belongs to a team (placed before /:id)
router.get('/my', teamController.getMyTeam);

// GET /api/teams/options - minimal active team options for any authenticated role (placed before /:id)
router.get('/options', teamController.getTeamOptions);

// Protect all subsequent team management routes with admin role check
router.use(roleCheck('admin'));

// Validation rules for creating a team
const createTeamValidation = [
  body('name')
    .isString()
    .withMessage('Team name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Team name is required'),
];

// Validation rules for updating a team
const updateTeamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team ID format'),
  body('name')
    .optional()
    .isString()
    .withMessage('Team name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Team name cannot be empty'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

// Validation rules for role assignments & member management
const teamIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team ID format'),
];

const assignRoleValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team ID format'),
  body('userId')
    .isMongoId()
    .withMessage('Valid userId is required'),
];

const memberParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid team ID format'),
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
];

// Routes
router.post('/', createTeamValidation, teamController.createTeam);
router.get('/', teamController.getTeams);
router.get('/:id', teamIdValidation, teamController.getTeamById);
router.put('/:id', updateTeamValidation, teamController.updateTeam);
router.patch('/:id/head', assignRoleValidation, teamController.assignHead);
router.patch('/:id/assistant', assignRoleValidation, teamController.assignAssistant);
router.post('/:id/members', assignRoleValidation, teamController.addMember);
router.delete('/:id/members/:userId', memberParamValidation, teamController.removeMember);
router.delete('/:id', teamIdValidation, teamController.deactivateTeam);

module.exports = router;

