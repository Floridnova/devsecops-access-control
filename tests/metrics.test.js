const request = require("supertest");
const app = require("../src/app");
const { createMetricsApp } = require("../src/metricsServer");
const { register } = require("../src/metrics");
const { DEMO_PASSWORD } = require("../src/data/seed");

async function tokenFor(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: DEMO_PASSWORD });
  return res.body.token;
}

async function values(metricName) {
  return (await register.getSingleMetric(metricName).get()).values;
}

beforeEach(() => {
  register.resetMetrics();
});

describe("metrics endpoint", () => {
  test("the API port does not serve /metrics (404)", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain("http_requests_total");
  });

  test("the separate metrics app serves /metrics with both counters", async () => {
    const res = await request(createMetricsApp()).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("security_events_total");
  });
});

describe("metric labels", () => {
  test("/api/orders/1 and /api/orders/2 are counted under ONE route label", async () => {
    const token = await tokenFor("manager.bole@dinedesk.test");
    const auth = { Authorization: `Bearer ${token}` };

    await request(app).get("/api/orders/1").set(auth);
    await request(app).get("/api/orders/2").set(auth);

    const all = await values("http_requests_total");
    const routes = all.map((v) => v.labels.route);

    expect(routes).toContain("/api/orders/:id");
    expect(routes).not.toContain("/api/orders/1");
    expect(routes).not.toContain("/api/orders/2");

    const hit = all.find(
      (v) =>
        v.labels.route === "/api/orders/:id" &&
        v.labels.method === "GET" &&
        v.labels.status_code === "200"
    );
    expect(hit.value).toBe(2);
  });

  test("unknown URLs do not create new labels", async () => {
    await request(app).get("/nope-123");
    await request(app).get("/nope-456");

    const all = await values("http_requests_total");
    const routes = all.map((v) => v.labels.route);
    expect(routes.some((r) => r.includes("nope"))).toBe(false);
    expect(routes).toContain("unmatched");
  });
});

describe("security event counter", () => {
  test("a failed login increases security_events_total{event=login_failed}", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "waiter.bole@dinedesk.test", password: "wrong-password" });

    const all = await values("security_events_total");
    const failed = all.find((v) => v.labels.event === "login_failed");
    expect(failed.value).toBe(1);
  });

  test("a cross-branch order request increases event=branch_access_denied", async () => {
    const token = await tokenFor("manager.bole@dinedesk.test");
    await request(app).get("/api/orders/3").set({ Authorization: `Bearer ${token}` });

    const all = await values("security_events_total");
    const denied = all.find((v) => v.labels.event === "branch_access_denied");
    expect(denied.value).toBe(1);
  });
});