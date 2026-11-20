const jwt = require("jsonwebtoken");
const config = require("../config");
const { findUserById } = require("../data/seed");
const securityEvents = require("../securityEvents");

function reject(req, res, reason) {
  securityEvents.authenticationFailed(req, reason);
  return res.status(401).json({ error: "Unauthorized" });
}

function authenticate(req, res, next) {
  // Accept only "Authorization: Bearer <token>"
  const header = req.headers.authorization;
  if (typeof header !== "string") return reject(req, res, "missing_token");

  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return reject(req, res, "malformed_header");

  let payload;
  try {
    payload = jwt.verify(match[1], config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  } catch (err) {
    const reason = err && err.name === "TokenExpiredError" ? "token_expired" : "invalid_token";
    return reject(req, res, reason);
  }

  if (!payload || typeof payload.sub !== "string") {
    return reject(req, res, "invalid_claims");
  }

  // Identity comes from the verified token and OUR user records only.
  const user = findUserById(payload.sub);
  if (!user) return reject(req, res, "unknown_user");
  if (!user.active) return reject(req, res, "inactive_user");

  req.user = {
    id: user.id,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
  };
  next();
}

module.exports = authenticate;