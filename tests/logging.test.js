const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

const logger = require("../src/logger");
const app = require("../src/app");
const requestId = require("../src/middleware/requestId");
const errorHandler = require("../src/middleware/errorHandler");
const { DEMO_PASSWORD, findUserById } = require("../src/data/seed");

const SECRET = process.env.JWT_SECRET;
const ISSUER = process.env.JWT_ISSUER;
const AUDIENCE = process.env.JWT_AUDIENCE;

// Seed ids: 1 admin, 2 Bole waiter, 3 Bole cashier, 4 Bole manager,
// 5 Piassa waiter. Orders 1-2 are Bole, 3-4 are Piassa.

let output;
let spy;

beforeAll(() => {
  logger.level = "info"; // setup-env sets "silent" for the other test file
});

beforeEach(() => {
  output = [];
  spy = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  spy.mockRestore();
});

function allLogs() {
  return output
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

const eventsNamed = (name) => allLogs().filter((l) => l.event === name);
const raw = () => output.join("");
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function loginAs(email, password = DEMO_PASSWORD) {
  return request(app).post("/api/auth/login").send({ email, password });
}

describe("log format and request ids", () => {
  test("every request line has timestamp, level, service, requestId and event", async () => {
    const res = await request(app).get("/health");
    const line = eventsNamed("http_request")[0];

    expect(line).toBeDefined();
    expect(new Date(line.timestamp).toISOString()).toBe(line.timestamp); // ISO 8601, UTC
    expect(line.timestamp.endsWith("Z")).toBe(true);
    expect(line.level).toBe("info");
    expect(line.service).toBe("dinedesk-api");
    expect(line.requestId).toBe(res.headers["x-request-id"]);
    expect(line.event).toBe("http_request");
  });

  test("a valid incoming X-Request-Id is reused", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "client-req-12345");
    expect(res.headers["x-request-id"]).toBe("client-req-12345");
    expect(eventsNamed("http_request")[0].requestId).toBe("client-req-12345");
  });

  test("an invalid incoming X-Request-Id is replaced", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "bad id with spaces!");
    expect(res.headers["x-request-id"]).not.toBe("bad id with spaces!");
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  test("redaction replaces password, token, authorization and cookie", () => {
    logger.info({
      event: "redaction_check",
      password: "hunter2-secret",
      token: "token-secret-value",
      authorization: "Bearer abc-secret",
      cookie: "session=cookie-secret",
    });
    expect(raw()).toContain("[REDACTED]");
    expect(raw()).not.toContain("hunter2-secret");
    expect(raw()).not.toContain("token-secret-value");
    expect(raw()).not.toContain("abc-secret");
    expect(raw()).not.toContain("cookie-secret");
  });
});

describe("security events", () => {
  test("failed login for a known account -> login_failed with userId, no typed email", async () => {
    const res = await loginAs("waiter.bole@dinedesk.test", "wrong-password");
    expect(res.status).toBe(401);

    const line = eventsNamed("login_failed")[0];
    expect(line.level).toBe("warn");
    expect(line.userId).toBe(2);
    expect(line.reason).toBe("bad_password");
    expect(line.requestId).toBe(res.headers["x-request-id"]);
    expect(raw()).not.toContain("wrong-password");
    expect(raw()).not.toContain("waiter.bole@dinedesk.test");
  });

  test("failed login for an unknown email -> login_failed with no userId and no email", async () => {
    const res = await loginAs("nobody.here@dinedesk.test", "whatever-123");
    expect(res.status).toBe(401);

    const line = eventsNamed("login_failed")[0];
    expect(line.userId).toBeUndefined();
    expect(line.reason).toBe("unknown_account");
    expect(raw()).not.toContain("nobody.here@dinedesk.test");
  });

  test("successful login -> login_succeeded", async () => {
    const res = await loginAs("manager.bole@dinedesk.test");
    expect(res.status).toBe(200);

    const line = eventsNamed("login_succeeded")[0];
    expect(line.level).toBe("info");
    expect(line.userId).toBe(4);
    expect(line.role).toBe("manager");
  });

  test("no token -> authentication_failed with reason missing_token", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);

    const line = eventsNamed("authentication_failed")[0];
    expect(line.level).toBe("warn");
    expect(line.reason).toBe("missing_token");
  });

  test("expired token -> authentication_failed with reason token_expired", async () => {
    const expired = jwt.sign(
      { sub: "2", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
      { algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await request(app).get("/api/orders").set(auth(expired));
    expect(res.status).toBe(401);
    expect(eventsNamed("authentication_failed")[0].reason).toBe("token_expired");
  });

  test("403 -> authorization_denied with userId, role and what was required", async () => {
    const login = await loginAs("waiter.bole@dinedesk.test");
    output.length = 0; // look only at the next request

    const res = await request(app).get("/api/admin/users").set(auth(login.body.token));
    expect(res.status).toBe(403);

    const line = eventsNamed("authorization_denied")[0];
    expect(line.level).toBe("warn");
    expect(line.userId).toBe(2);
    expect(line.role).toBe("waiter");
    expect(line.required).toEqual(["admin"]);
    expect(line.requestId).toBe(res.headers["x-request-id"]);
  });

  test("cross-branch order request -> branch_access_denied", async () => {
    const login = await loginAs("manager.bole@dinedesk.test");
    output.length = 0;

    const res = await request(app).get("/api/orders/3").set(auth(login.body.token)); // Piassa order
    expect(res.status).toBe(404);

    const line = eventsNamed("branch_access_denied")[0];
    expect(line.level).toBe("warn");
    expect(line.userId).toBe(4);
    expect(line.role).toBe("manager");
    expect(line.userBranchId).toBe("bole");
    expect(line.orderId).toBe(3);
    expect(line.orderBranchId).toBe("piassa");
  });

  test("a server error's log line and response share the same request id", async () => {
    const mini = express();
    mini.use(requestId);
    mini.get("/boom", () => {
      throw new Error("database exploded");
    });
    mini.use(errorHandler);

    const res = await request(mini).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
    expect(res.body.requestId).toBe(res.headers["x-request-id"]);
    expect(JSON.stringify(res.body)).not.toContain("database exploded");
    expect(JSON.stringify(res.body)).not.toContain("stack");

    const line = eventsNamed("server_error")[0];
    expect(line.level).toBe("error");
    expect(line.requestId).toBe(res.body.requestId);
    expect(line.errorMessage).toBe("database exploded");
  });
});

describe("audit trail: role changes", () => {
  test("successful role change -> audit event with actor, target, before and after", async () => {
    const login = await loginAs("admin@dinedesk.test");
    output.length = 0;

    const target = findUserById(3); // Bole cashier
    try {
      const res = await request(app)
        .patch("/api/admin/users/3/role")
        .set(auth(login.body.token))
        .send({ role: "waiter" });
      expect(res.status).toBe(200);

      const line = eventsNamed("audit_user_role_change")[0];
      expect(line.level).toBe("info");
      expect(line.action).toBe("user_role_change");
      expect(line.outcome).toBe("success");
      expect(line.actor).toEqual({ id: 1, role: "admin" });
      expect(line.target).toEqual({ id: 3 });
      expect(line.before).toEqual({ role: "cashier" });
      expect(line.after).toEqual({ role: "waiter" });
      expect(line.requestId).toBe(res.headers["x-request-id"]);
    } finally {
      target.role = "cashier"; // restore the seed data for other tests
    }
  });

  test("rejected attempt by a waiter -> 403 and an audit event with outcome denied", async () => {
    const login = await loginAs("waiter.bole@dinedesk.test");
    output.length = 0;

    const res = await request(app)
      .patch("/api/admin/users/3/role")
      .set(auth(login.body.token))
      .send({ role: "admin" });
    expect(res.status).toBe(403);
    expect(findUserById(3).role).toBe("cashier"); // nothing changed

    const line = eventsNamed("audit_user_role_change")[0];
    expect(line.level).toBe("warn");
    expect(line.outcome).toBe("denied");
    expect(line.reason).toBe("missing_permission");
    expect(line.actor).toEqual({ id: 2, role: "waiter" });
    expect(line.before).toEqual({ role: "cashier" });
    expect(line.after).toEqual({ role: "cashier" });
    expect(line.requestedRole).toBe("admin");
  });

  test("rejected attempt by an admin with an invalid role -> audit outcome rejected", async () => {
    const login = await loginAs("admin@dinedesk.test");
    output.length = 0;

    const res = await request(app)
      .patch("/api/admin/users/3/role")
      .set(auth(login.body.token))
      .send({ role: "superuser" });
    expect(res.status).toBe(400);

    const line = eventsNamed("audit_user_role_change")[0];
    expect(line.outcome).toBe("rejected");
    expect(line.reason).toBe("invalid_role");
    expect(findUserById(3).role).toBe("cashier");
  });
});

describe("no secrets in the logs", () => {
  test("log in, use the token, and the password, token and signing key appear nowhere", async () => {
    const login = await loginAs("manager.bole@dinedesk.test");
    const token = login.body.token;
    expect(token).toBeDefined();

    await request(app).get("/api/orders").set(auth(token));
    await request(app).get("/api/reports/branch").set(auth(token));
    await request(app).get("/api/orders/3").set(auth(token)); // triggers a security event too

    const text = raw();
    expect(eventsNamed("http_request").length).toBeGreaterThan(2); // the test is not vacuous
    expect(text).not.toContain(DEMO_PASSWORD);
    expect(text).not.toContain(token);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("$2a$"); // bcrypt hashes
    expect(text).not.toContain("$2b$");
    expect(text).not.toContain("Bearer ");
  });
});