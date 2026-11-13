const express = require('express');
const router = express.Router();

const leaderboardController = require('../controllers/leaderboardController');
const auth = require('../middleware/auth');

// All leaderboard routes require authentication
router.use(auth);

// GET /api/leaderboard/teams
router.get('/teams', leaderboardController.getTeamLeaderboard);

// GET /api/leaderboard/members
router.get('/members', leaderboardController.getMemberLeaderboard);

module.exports = router;

