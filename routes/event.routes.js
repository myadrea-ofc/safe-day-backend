const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const siteDepartmentMiddleware = require(
  "../middlewares/siteDepartmentMiddleware"
);
const auditMiddleware = require("../middlewares/audit.middleware");

router.get(
  "/hses-event",
  authMiddleware,
  allowRoles("superadmin", "admin", "member"),
  async (req, res) => {
    res.json({ message: "List event" });
  }
);

router.post(
  "/hses_daily_plan",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  siteDepartmentMiddleware,
  auditMiddleware("Event Daily Plan"),
  async (req, res) => {
    res.json({ message: "Event created" });
  }
);

router.delete(
  "/hses-event/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  auditMiddleware("Event"),
  async (req, res) => {
    res.json({ message: "Event deleted" });
  }
);

module.exports = router;
