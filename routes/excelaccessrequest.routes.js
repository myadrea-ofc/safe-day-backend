const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

const controller = require("../controllers/excel.access.request.controller");

// MEMBER
router.post("/", authMiddleware, allowRoles("member"), controller.createRequest);
router.get("/me", authMiddleware, allowRoles("member"), controller.getMyLatestRequest);

// ADMIN / SUPERADMIN
router.get("/", authMiddleware, allowRoles("admin", "superadmin"), controller.listRequests);
router.post("/:id/approve", authMiddleware, allowRoles("admin", "superadmin"), controller.approveRequest);
router.post("/:id/reject", authMiddleware, allowRoles("admin", "superadmin"), controller.rejectRequest);

module.exports = router;