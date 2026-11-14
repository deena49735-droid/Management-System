/**
 * Middleware to reject NoSQL injection operators ($) or dot notation (.) in keys
 * Returns 400 { success: false, message: "Invalid request." } if detected at any depth.
 */

function hasInvalidKey(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (hasInvalidKey(obj[key])) {
        return true;
      }
    }
  }
  return false;
}

module.exports = function rejectOperators(req, res, next) {
  if (
    hasInvalidKey(req.body) ||
    hasInvalidKey(req.query) ||
    hasInvalidKey(req.params)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request.',
    });
  }
  next();
};

