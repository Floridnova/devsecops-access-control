const express = require("express");
const { register } = require("./metrics");
const logger = require("./logger");

// A separate Express app, so /metrics is never part of the public API.
function createMetricsApp() {
  const metricsApp = express();
  metricsApp.disable("x-powered-by");

  metricsApp.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  return metricsApp;
}

function startMetricsServer({ port, host }) {
  return createMetricsApp().listen(port, host, () => {
    logger.info({ event: "metrics_server_started", host, port });
  });
}

module.exports = { createMetricsApp, startMetricsServer };