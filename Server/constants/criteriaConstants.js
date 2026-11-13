/**
 * Shared Criteria Constants for Kadambas Game Management System
 * Follows the official Kadambas Game Criteria structure exactly.
 */

const CATEGORY_ORDER = [
  'meeting_day',
  'non_meeting_day',
  'monthly',
  'one_time',
  'penalty',
];

const CATEGORY_LABELS = {
  meeting_day: 'Meeting Day Activities',
  non_meeting_day: 'Non-Meeting Day Activities',
  monthly: 'Monthly Points',
  one_time: 'One Time Bonus Points',
  penalty: 'Negative Points Criteria',
};

const CATEGORY_LEVELS = {
  meeting_day: 'member',
  non_meeting_day: 'member',
  monthly: 'team',
  one_time: 'team',
  penalty: 'member',
};

/**
 * Quantity rule: Quantity is allowed above 1 ONLY when basisLabel contains
 * "Per Visitor", "Per Testimonial", "Per Specific Ask" or "Per Week".
 * For all other criteria, quantity is always 1.
 */
const allowsMultipleQuantity = (basisLabel = '') => {
  if (!basisLabel) return false;
  return /Per Visitor|Per Testimonial|Per Specific Ask|Per Week/i.test(basisLabel);
};

/**
 * Meeting Attendance Timing Rules
 */
const EARLY_BIRD_TIME = '07:25';
const LATE_AFTER = '07:59';

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  CATEGORY_LEVELS,
  allowsMultipleQuantity,
  EARLY_BIRD_TIME,
  LATE_AFTER,
};

