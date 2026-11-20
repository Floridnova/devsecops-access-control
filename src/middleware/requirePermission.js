const { hasPermission } = require("../permissions");
const securityEvents = require("../securityEvents");

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!hasPermission(req.user.role, permission)) {
      securityEvents.authorizationDenied(req, permission);
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = requirePermission;