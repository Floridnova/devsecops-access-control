const crypto = require("crypto");
const logger = require("../logger");

// An incoming id is reused only if it is 8-64 letters, digits or dashes.
// Anything else (spaces, newlines, long strings, symbols) is replaced.
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

function requestId(req, res, next) {
  const incoming = req.get("X-Request-Id");
  const id = incoming && ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);

  // Every line written with req.log carries the request id.
  req.log = logger.child({ requestId: id });
  next();
}

module.exports = requestId;