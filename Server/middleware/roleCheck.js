/**
 * Role-Based Access Control Middleware
 * Restricts access to users having one of the specified roles
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'teamHead', etc.)
 */
const roleCheck = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.',
      });
    }

    next();
  };
};

module.exports = roleCheck;

