// Fake values for tests only. They are not real secrets.
process.env.JWT_SECRET = "test-only-signing-key-0123456789-abcdefghij";
process.env.JWT_ISSUER = "dinedesk-api";
process.env.JWT_AUDIENCE = "dinedesk-staff";
process.env.JWT_EXPIRES_IN = "15m";
process.env.LOG_LEVEL = "silent";