// Load the config first. If it is invalid, print a clear message and stop.
let config;
try {
  config = require("./config");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require("./app");
const { startMetricsServer } = require("./metricsServer");

app.listen(config.port, () => {
  console.log(`DineDesk API listening on port ${config.port}`);
});

// /metrics lives on its own port, bound to 127.0.0.1 unless METRICS_HOST says otherwise.
startMetricsServer({ port: config.metricsPort, host: config.metricsHost });