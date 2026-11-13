const express = require("express");
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { orders } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

function buildReport(branchId) {
  const branchOrders = orders.filter((o) => o.branchId === branchId);
  return {
    branchId,
    orderCount: branchOrders.length,
    totalSales: branchOrders.reduce((sum, o) => sum + o.total, 0),
  };
}

router.get("/branch", requirePermission("reports:read"), (req, res) => {
  // req.query.branchId is deliberately never read.
  if (req.user.branchId === null) {
    // Administrators belong to no branch, so they get every branch.
    return res.json({ scope: "all", branches: ["bole", "piassa"].map(buildReport) });
  }
  res.json(buildReport(req.user.branchId));
});

module.exports = router;