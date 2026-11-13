const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const { users } = require("../data/seed");

const router = express.Router();
router.use(authenticate);

router.get("/users", requireRole("admin"), (req, res) => {
  // Build a safe view of each user. The password hash is never included.
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branchId: u.branchId,
      active: u.active,
    }))
  );
});

module.exports = router;