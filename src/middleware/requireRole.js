const securityEvents = require("../securityEvents");

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      securityEvents.authorizationDenied(req, roles);
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = requireRole;