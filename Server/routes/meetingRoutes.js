const express = require('express');
const router = express.Router();

const meetingController = require('../controllers/meetingController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All meeting routes require authentication
router.use(auth);

// Helper route to get allowed meeting day activities for custom activity selection
router.get('/allowed-activities', meetingController.getAllowedActivities);

// Core meeting collection routes
router.post(
  '/',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.createMeeting
);

router.get(
  '/',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.getMeetings
);

// Single meeting item routes
router.get(
  '/:id',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.getMeetingById
);

router.put(
  '/:id',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.updateMeeting
);

router.post(
  '/:id/submit',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.submitMeeting
);

router.post(
  '/:id/approve',
  roleCheck('admin', 'teamHead'),
  meetingController.approveMeeting
);

router.post(
  '/:id/send-back',
  roleCheck('admin', 'teamHead'),
  meetingController.sendBackMeeting
);

router.get(
  '/:id/preview',
  roleCheck('admin', 'teamAssistant', 'teamHead'),
  meetingController.previewMeeting
);

module.exports = router;

