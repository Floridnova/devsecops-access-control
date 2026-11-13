const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { DEMO_PASSWORD } = require("../src/data/seed");
const { getPermissions } = require("../src/permissions");

const SECRET = process.env.JWT_SECRET;
const ISSUER = process.env.JWT_ISSUER;
const AUDIENCE = process.env.JWT_AUDIENCE;

// Seed order ids: 1 and 2 are Bole, 3 and 4 are Piassa.
const BOLE_ORDER = 1;
const PIASSA_ORDER = 3;

async function login(email, password = DEMO_PASSWORD) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res;
}

async function tokenFor(email) {
  const res = await login(email);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe("authentication", () => {
  test("no token -> 401", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  test("malformed Authorization header -> 401", async () => {
    const res = await request(app).get("/api/orders").set("Authorization", "Token abc");
    expect(res.status).toBe(401);
  });

  test("token signed with the wrong key -> 401", async () => {
    const forged = jwt.sign({ sub: "1" }, "a-completely-different-key-0123456789", {
      algorithm: "HS256",
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: "15m",
    });
    const res = await request(app).get("/api/orders").set(auth(forged));
    expect(res.status).toBe(401);
  });

  test("expired token -> 401", async () => {
    const expired = jwt.sign(
      { sub: "2", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
      { algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE }
    );
    const res = await request(app).get("/api/orders").set(auth(expired));
    expect(res.status).toBe(401);
  });

  test('token with alg "none" -> 401', async () => {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      sub: "1",
      iss: ISSUER,
      aud: AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    const res = await request(app).get("/api/admin/users").set(auth(unsigned));
    expect(res.status).toBe(401);
  });

  test("wrong email and wrong password give the same generic error", async () => {
    const wrongEmail = await login("nobody@dinedesk.test", "whatever-123");
    const wrongPassword = await login("waiter.bole@dinedesk.test", "wrong-password");
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.body).toEqual(wrongPassword.body);
  });

  test("login ignores a role sent in the body", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "waiter.bole@dinedesk.test",
      password: DEMO_PASSWORD,
      role: "admin",
      branchId: "piassa",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("waiter");
    expect(res.body.user.branchId).toBe("bole");

    const adminRoute = await request(app).get("/api/admin/users").set(auth(res.body.token));
    expect(adminRoute.status).toBe(403);
  });
});

describe("roles and permissions", () => {
  test("waiter calling GET /api/admin/users -> 403", async () => {
    const token = await tokenFor("waiter.bole@dinedesk.test");
    const res = await request(app).get("/api/admin/users").set(auth(token));
    expect(res.status).toBe(403);
  });

  test("administrator calling GET /api/admin/users -> 200 with no password hashes", async () => {
    const token = await tokenFor("admin@dinedesk.test");
    const res = await request(app).get("/api/admin/users").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  test("waiter creating an order -> 201", async () => {
    const token = await tokenFor("waiter.bole@dinedesk.test");
    const res = await request(app)
      .post("/api/orders")
      .set(auth(token))
      .send({ table: "B9", items: [{ name: "Tibs", quantity: 1, price: 250 }] });
    expect(res.status).toBe(201);
    expect(res.body.branchId).toBe("bole");
  });

  test("cashier creating an order -> 403", async () => {
    const token = await tokenFor("cashier.bole@dinedesk.test");
    const res = await request(app)
      .post("/api/orders")
      .set(auth(token))
      .send({ table: "B9", items: [{ name: "Tibs", quantity: 1, price: 250 }] });
    expect(res.status).toBe(403);
  });

  test("a branchId in the order body is ignored", async () => {
    const token = await tokenFor("waiter.bole@dinedesk.test");
    const res = await request(app)
      .post("/api/orders")
      .set(auth(token))
      .send({ table: "B8", branchId: "piassa", items: [{ name: "Shiro", quantity: 1, price: 120 }] });
    expect(res.status).toBe(201);
    expect(res.body.branchId).toBe("bole");
  });

  test("an unknown role has no permissions", () => {
    expect(getPermissions("hacker")).toEqual([]);
    expect(getPermissions("constructor")).toEqual([]);
    expect(getPermissions(undefined)).toEqual([]);
  });
});

describe("branch-level authorization", () => {
  test("Bole manager reading a Bole order -> 200", async () => {
    const token = await tokenFor("manager.bole@dinedesk.test");
    const res = await request(app).get(`/api/orders/${BOLE_ORDER}`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.branchId).toBe("bole");
  });

  test("Bole manager reading a Piassa order -> 404, same as a missing order", async () => {
    const token = await tokenFor("manager.bole@dinedesk.test");
    const otherBranch = await request(app).get(`/api/orders/${PIASSA_ORDER}`).set(auth(token));
    const missing = await request(app).get("/api/orders/99999").set(auth(token));

    expect(otherBranch.status).toBe(404);
    expect(otherBranch.body).toEqual(missing.body);
    expect(JSON.stringify(otherBranch.body)).not.toMatch(/piassa|shiro|P2/i);
  });

  test("the order list only contains the user's own branch", async () => {
    const token = await tokenFor("waiter.bole@dinedesk.test");
    const res = await request(app).get("/api/orders").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((o) => o.branchId === "bole")).toBe(true);
  });

  test("administrator can read an order from any branch", async () => {
    const token = await tokenFor("admin@dinedesk.test");
    const res = await request(app).get(`/api/orders/${PIASSA_ORDER}`).set(auth(token));
    expect(res.status).toBe(200);
  });

  test("waiter calling GET /api/reports/branch -> 403", async () => {
    const token = await tokenFor("waiter.bole@dinedesk.test");
    const res = await request(app).get("/api/reports/branch").set(auth(token));
    expect(res.status).toBe(403);
  });

  test("Piassa manager with ?branchId=bole still gets only Piassa data", async () => {
    const token = await tokenFor("manager.piassa@dinedesk.test");

    const plain = await request(app).get("/api/reports/branch").set(auth(token));
    const tricked = await request(app)
      .get("/api/reports/branch?branchId=bole")
      .set(auth(token));

    expect(plain.status).toBe(200);
    expect(tricked.status).toBe(200);
    expect(tricked.body.branchId).toBe("piassa");
    expect(tricked.body).toEqual(plain.body);
  });
});