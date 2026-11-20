const logger = require("./logger");

function shortText(value) {
  return typeof value === "string" ? value.slice(0, 40) : null;
}

// outcome: "success" | "denied" | "rejected"
function userRoleChange(req, { target, outcome, reason, requestedRole, before, after }) {
  const log = req.log || logger;
  const level = outcome === "success" ? "info" : "warn";

  log[level]({
    event: "audit_user_role_change",
    action: "user_role_change",
    actor: { id: req.user && req.user.id, role: req.user && req.user.role },
    target: { id: target ? target.id : shortText(req.params.id) },
    outcome,
    ...(reason ? { reason } : {}),
    before: { role: before !== undefined ? before : target ? target.role : null },
    after: { role: after !== undefined ? after : target ? target.role : null },
    requestedRole: shortText(requestedRole),
    ip: req.ip,
  });
}

module.exports = { userRoleChange };