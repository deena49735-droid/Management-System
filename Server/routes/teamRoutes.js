const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Rate limiter for teamHead and teamAssistant member creation (max 30 per hour per user)
const memberCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req) => (req.user?._id ? req.user._id.toString() : 'anonymous'),
  message: {
    success: false,
    message: 'Too many member accounts created. Please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { default: true, keyGeneratorIpFallback: false },
});

// Validation rules for teamHead / teamAssistant creating a new member
const createTeamMemberValidation = [
  body('name')
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('username')
    .isString()
    .withMessage('Username must be a string')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-z0-9._]+$/)
    .withMessage('Username can only contain lowercase letters, numbers, dot, and underscore'),
  body('phone')
    .isString()
    .withMessage('Phone must be a string')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be a valid 10-digit number'),
  body('password')
    .isString()
    .withMessage('Password must be a string')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Validation rules for adding existing member to own team
const addExistingMemberValidation = [
  body('userId')
    .isMongoId()
    .withMessage('Valid userId is required'),
];

// Authentication middleware required for all team routes
router.use(auth);

// GET /api/teams/my - accessible to any logged-in user who belongs to a team (placed before /:id)
router.get('/my', teamController.getMyTeam);

// GET /api/teams/options - minimal active team options for any authenticated role (placed before /:id)
router.get('/options', teamController.getTeamOptions);

// Routes for teamHead and teamAssistant to manage their own team's members (declared before /:id and outside admin-only check)
router.post(
  '/my/members',
  roleCheck('teamHead', 'teamAssistant'),
  memberCreateLimiter,
  createTeamMemberValidation,
  teamController.createMyTeamMember
);

router.get(
  '/my/available-members',
  roleCheck('teamHead', 'teamAssistant'),
  teamController.getAvailableMembers
);

router.post(
  '/my/members/add',
  roleCheck('teamHead', 'teamAssistant'),
  addExistingMemberValidation,
  teamController.addExistingMemberToMyTeam
);

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

