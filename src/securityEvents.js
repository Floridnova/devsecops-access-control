const logger = require("./logger");
const { securityEventsTotal } = require("./metrics");

function pathOf(req) {
  return String(req.originalUrl || req.url || "").split("?")[0].slice(0, 200);
}

function emit(req, level, event, fields) {
  const target = req.log || logger;
  target[level]({ event, ip: req.ip, ...fields });
    securityEventsTotal.inc({ event });
}

// info: a normal, successful sign-in
function loginSucceeded(req, user) {
  emit(req, "info", "login_succeeded", {
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
  });
}

// warn: userId only for a KNOWN account. The typed email is never logged.
function loginFailed(req, user, reason) {
  emit(req, "warn", "login_failed", {
    ...(user ? { userId: user.id } : {}),
    reason,
  });
}

// warn: no valid identity (401)
function authenticationFailed(req, reason) {
  emit(req, "warn", "authentication_failed", {
    reason,
    method: req.method,
    path: pathOf(req),
  });
}

// warn: known user, not allowed (403)
function authorizationDenied(req, required) {
  emit(req, "warn", "authorization_denied", {
    userId: req.user && req.user.id,
    role: req.user && req.user.role,
    required,
    method: req.method,
    path: pathOf(req),
  });
}

// warn: object-level check failed (someone asked for another branch's order)
function branchAccessDenied(req, order) {
  emit(req, "warn", "branch_access_denied", {
    userId: req.user && req.user.id,
    role: req.user && req.user.role,
    userBranchId: req.user && req.user.branchId,
    orderId: order.id,
    orderBranchId: order.branchId,
    path: pathOf(req),
  });
}

// error: something broke on our side. The stack stays in the log only.
function serverError(req, err) {
  emit(req, "error", "server_error", {
    method: req.method,
    path: pathOf(req),
    errorName: err && err.name,
    errorMessage: err && err.message,
    stack: err && err.stack,
  });
}

module.exports = {
  loginSucceeded,
  loginFailed,
  authenticationFailed,
  authorizationDenied,
  branchAccessDenied,
  serverError,
};