const express = require("express");
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { canAccessOrder } = require("../policies/orderPolicy");
const { orders, findOrderById, createOrder } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

// Any authenticated staff member, but only orders the policy allows.
router.get("/", (req, res) => {
  res.json(orders.filter((order) => canAccessOrder(req.user, order)));
});

router.get("/:id", requirePermission("orders:read"), (req, res) => {
  const order = findOrderById(req.params.id);

  // A missing order and an order from another branch get the SAME answer (404),
  // so nobody can use the API to find out which order ids exist elsewhere.
  if (!order || !canAccessOrder(req.user, order)) {
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

  // The branch comes from the verified identity, never from the body.
  const order = createOrder({
    branchId: req.user.branchId,
    table,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    createdBy: req.user.id,
  });
  res.status(201).json(order);
});

module.exports = router;