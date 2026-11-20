const pino = require("pino");

// Anything that might hold a secret is replaced before it is written.
const REDACT_PATHS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "jwtSecret",
  "apiKey",
  "*.password",
  "*.token",
  "*.authorization",
  "*.cookie",
  "*.secret",
  "*.jwtSecret",
  "*.apiKey",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

// Pino writes through this object, so tests can capture the output
// by spying on process.stdout.write.
const destination = {
  write(line) {
    process.stdout.write(line);
  },
};

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: { service: "dinedesk-api" },
    // ISO 8601, UTC
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    // "level":"info" instead of a number
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  },
  destination
);

module.exports = logger;