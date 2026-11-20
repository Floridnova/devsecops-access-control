const client = require("prom-client");

const register = new client.Registry();

// Labels are BOUNDED: method (a few values), route (a pattern, not the real URL)
// and status code (a few dozen values).
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "HTTP requests by method, route pattern and status code",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// One label with a fixed list of event names. No userId, ip or email labels.
const securityEventsTotal = new client.Counter({
  name: "security_events_total",
  help: "Security events by event name",
  labelNames: ["event"],
  registers: [register],
});

// Start every known event at 0 so the series exist before the first event.
const EVENT_NAMES = [
  "login_succeeded",
  "login_failed",
  "authentication_failed",
  "authorization_denied",
  "branch_access_denied",
  "server_error",
];
for (const event of EVENT_NAMES) {
  securityEventsTotal.inc({ event }, 0);
}

// "/api/orders/1" and "/api/orders/2" must both become "/api/orders/:id".
function routePattern(req) {
  const base = req.baseUrl || "";

  if (req.route && typeof req.route.path === "string") {
    const full = base + req.route.path || "/";
    return full.length > 1 ? full.replace(/\/+$/, "") : full;
  }
  // No route matched (401 from router middleware, 404...). Still bounded.
  return base ? `${base}/*` : "unmatched";
}

function httpMetrics(req, res, next) {
  res.on("finish", () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: routePattern(req),
      status_code: String(res.statusCode),
    });
  });
  next();
}

module.exports = { register, httpRequestsTotal, securityEventsTotal, httpMetrics };