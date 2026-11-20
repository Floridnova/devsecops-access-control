const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const securityEvents = require("../securityEvents");
const audit = require("../audit");
const { ROLE_PERMISSIONS, hasPermission } = require("../permissions");
const { users, findUserById } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

const VALID_ROLES = Object.keys(ROLE_PERMISSIONS);

router.get("/users", requireRole("admin"), (req, res) => {
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branchId: u.branchId,
      active: u.active,
    }))
  );
});

// Audited action: change a staff member's role.
router.patch("/users/:id/role", (req, res) => {
  const target = findUserById(req.params.id);
  const requestedRole = req.body && req.body.role;

  // 1. Is the caller allowed to manage users at all?
  if (!hasPermission(req.user.role, "users:manage")) {
    audit.userRoleChange(req, { target, outcome: "denied", reason: "missing_permission", requestedRole });
    securityEvents.authorizationDenied(req, "users:manage");
    return res.status(403).json({ error: "Forbidden" });
  }

  // 2. Rejected attempts by an administrator (still audited)
  if (!target) {
    audit.userRoleChange(req, { target: null, outcome: "rejected", reason: "unknown_user", requestedRole });
    return res.status(404).json({ error: "Not found" });
  }
  if (typeof requestedRole !== "string" || !VALID_ROLES.includes(requestedRole)) {
    audit.userRoleChange(req, { target, outcome: "rejected", reason: "invalid_role", requestedRole });
    return res.status(400).json({ error: "Invalid role" });
  }
  if (target.id === req.user.id) {
    audit.userRoleChange(req, { target, outcome: "rejected", reason: "cannot_change_own_role", requestedRole });
    return res.status(403).json({ error: "Forbidden" });
  }

  // 3. Success: record before and after.
  const before = target.role;
  target.role = requestedRole;
  audit.userRoleChange(req, { target, outcome: "success", requestedRole, before, after: target.role });

  res.json({ id: target.id, role: target.role });
});

module.exports = router;