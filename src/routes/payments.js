const express = require("express");
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { findOrderById } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

let nextPaymentId = 1;

router.post("/", requirePermission("payments:create"), (req, res) => {
  const { orderId, amount } = req.body || {};

  if (typeof amount !== "number" || !(amount > 0)) {
    return res.status(400).json({ error: "Invalid payment" });
  }

  const order = findOrderById(orderId);
  if (!order) return res.status(404).json({ error: "Not found" });

  res.status(201).json({
    id: nextPaymentId++,
    orderId: order.id,
    amount,
    status: "accepted",
  });
});

module.exports = router;