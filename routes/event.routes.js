const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const siteDepartmentMiddleware = require(
  "../middlewares/siteDepartmentMiddleware"
);

// 🔹 Semua role boleh lihat event
router.get(
  "/hses-event",
  authMiddleware,
  allowRoles("superadmin", "admin", "member"),
  async (req, res) => {
    res.json({ message: "List event" });
  }
);

// 🔹 Hanya admin & superadmin boleh create
router.post(
  "/hses_daily_plan",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  siteDepartmentMiddleware,
  async (req, res) => {
    res.json({ message: "Event created" });
  }
);

// 🔹 Hanya superadmin boleh delete
router.delete(
  "/hses-event/:id",
  authMiddleware,
  allowRoles("superadmin", "admin"),
  async (req, res) => {
    res.json({ message: "Event deleted" });
  }
);

module.exports = router;
