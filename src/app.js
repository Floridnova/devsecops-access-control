const express = require("express");

const requestId = require("./middleware/requestId");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const { httpMetrics } = require("./metrics");

const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const reportRoutes = require("./routes/reports");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(requestId);
app.use(requestLogger);
app.use(httpMetrics);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// NOTE: there is deliberately no /metrics route here.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;