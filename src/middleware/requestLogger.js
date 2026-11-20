// One info line per finished request. No headers and no body are logged.
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info({
      event: "http_request",
      method: req.method,
      path: String(req.originalUrl || req.url).split("?")[0].slice(0, 200),
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.user ? req.user.id : undefined,
    });
  });

  next();
}

module.exports = requestLogger;