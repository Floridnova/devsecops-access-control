const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { findUserByEmail } = require("../data/seed");

const router = express.Router();

// Used when the email does not exist, so both failures take similar time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

router.post("/login", async (req, res) => {
  // Only email and password are read. Any role or branchId in the body is ignored.
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = findUserByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // One generic message for wrong email, wrong password and disabled accounts.
  if (!user || !user.active || !ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  // Minimal claims: only the user id (sub). Role and branch are read from our
  // own user records on every request, so they cannot be forged or go stale.
  const token = jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtExpiresIn,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
  });
});

module.exports = router;