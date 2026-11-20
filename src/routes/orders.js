const express = require("express");
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { canAccessOrder } = require("../policies/orderPolicy");
const securityEvents = require("../securityEvents");
const { orders, findOrderById, createOrder } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  res.json(orders.filter((order) => canAccessOrder(req.user, order)));
});

router.get("/:id", requirePermission("orders:read"), (req, res) => {
  const order = findOrderById(req.params.id);

  // A missing order and another branch's order both get the same 404.
  if (!order) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!canAccessOrder(req.user, order)) {
    // The client sees 404, but WE record that someone crossed the branch line.
    securityEvents.branchAccessDenied(req, order);
    return res.status(404).json({ error: "Not found" });
  }
  res.json(order);
});

router.post("/", requirePermission("orders:create"), (req, res) => {
  const { table, items } = req.body || {};

  const validItems =
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (i) =>
        i &&
        typeof i.name === "string" &&
        Number.isInteger(i.quantity) && i.quantity > 0 &&
        typeof i.price === "number" && i.price >= 0
    );

  if (typeof table !== "string" || table.trim() === "" || !validItems) {
    return res.status(400).json({ error: "Invalid order" });
  }

  const order = createOrder({
    branchId: req.user.branchId,
    table,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    createdBy: req.user.id,
  });
  res.status(201).json(order);
});

module.exports = router;