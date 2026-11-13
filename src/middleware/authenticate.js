const jwt = require("jsonwebtoken");
const config = require("../config");
const { findUserById } = require("../data/seed");

function unauthorized(res) {
  return res.status(401).json({ error: "Unauthorized" });
}

function authenticate(req, res, next) {
  // Accept only "Authorization: Bearer <token>"
  const header = req.headers.authorization;
  if (typeof header !== "string") return unauthorized(res);

  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) return unauthorized(res);

  let payload;
  try {
    payload = jwt.verify(match[1], config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
  } catch (err) {
    // missing signature, wrong key, expired, wrong issuer/audience, malformed...
    return unauthorized(res);
  }

  if (!payload || typeof payload.sub !== "string") return unauthorized(res);

  // Identity comes from the verified token and OUR user records only.
  const user = findUserById(payload.sub);
  if (!user || !user.active) return unauthorized(res);

  req.user = {
    id: user.id,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
  };
  next();
}

module.exports = authenticate;