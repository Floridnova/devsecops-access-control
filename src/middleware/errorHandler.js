const securityEvents = require("../securityEvents");

// Express recognises an error handler by its four arguments. Keep all four.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON", requestId: req.id });
  }

  securityEvents.serverError(req, err);

  // Generic message + request id. Never a stack trace.
  res.status(500).json({ error: "Internal server error", requestId: req.id });
}

module.exports = errorHandler;