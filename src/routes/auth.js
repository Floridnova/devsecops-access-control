const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { findUserByEmail } = require("../data/seed");
const securityEvents = require("../securityEvents");

const router = express.Router();

// Used when the email does not exist, so both failures take similar time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function genericFailure(res) {
  return res.status(401).json({ error: "Invalid email or password" });
}

router.post("/login", async (req, res) => {
  // Only email and password are read. Any role or branchId in the body is ignored.
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string") {
    securityEvents.loginFailed(req, null, "invalid_request");
    return genericFailure(res);
  }

  const user = findUserByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // The CLIENT always sees the same message. Our LOG records the real reason.
  if (!user) {
    securityEvents.loginFailed(req, null, "unknown_account");
    return genericFailure(res);
  }
  if (!user.active) {
    securityEvents.loginFailed(req, user, "account_disabled");
    return genericFailure(res);
  }
  if (!ok) {
    securityEvents.loginFailed(req, user, "bad_password");
    return genericFailure(res);
  }

  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  securityEvents.loginSucceeded(req, user);

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
  });
});

module.exports = router;