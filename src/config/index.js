require("dotenv").config(); // does not override variables that are already set

const MIN_SECRET_LENGTH = 32;

// Settings the app cannot run without
const REQUIRED = ["JWT_SECRET", "JWT_ISSUER", "JWT_AUDIENCE"];

function readEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? null : value;
}

function loadConfig() {
  const problems = [];

  for (const name of REQUIRED) {
    if (readEnv(name) === null) {
      problems.push(`${name} is missing`);
    }
  }

  const secret = readEnv("JWT_SECRET");
  if (secret !== null && secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET is too short (it must be at least ${MIN_SECRET_LENGTH} characters)`
    );
  }

  if (problems.length > 0) {
    throw new Error(
      "Invalid configuration:\n  - " + problems.join("\n  - ")
    );
  }

  return Object.freeze({
    jwtSecret: secret,
    jwtIssuer: readEnv("JWT_ISSUER"),
    jwtAudience: readEnv("JWT_AUDIENCE"),
    jwtExpiresIn: readEnv("JWT_EXPIRES_IN") || "15m",
        port: Number(readEnv("PORT")) || 3000,
    metricsPort: Number(readEnv("METRICS_PORT")) || 9464,
    metricsHost: readEnv("METRICS_HOST") || "127.0.0.1",
  });
}

module.exports = loadConfig();