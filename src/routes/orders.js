const express = require("express");
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { orders, findOrderById, createOrder } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

// TEMPORARY until Task 4: returns every branch's orders. Do not submit like this.
router.get("/", (req, res) => {
  res.json(orders);
});

// TEMPORARY until Task 4: no branch check.
router.get("/:id", requirePermission("orders:read"), (req, res) => {
  const order = findOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: "Not found" });
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