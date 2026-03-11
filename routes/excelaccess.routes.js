const express = require("express");
const router = express.Router();

const controller = require("../controllers/excel.access.controller");
const auth = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware"); // pastikan ada

router.get("/", auth, controller.getAccessList);
router.post("/grant", auth, controller.grantAccess);
router.post("/revoke", auth, controller.revokeAccess);
router.get("/unseen-count", auth, controller.getUnseenCount);
router.post("/mark-seen", auth, controller.markSeen);

// MEMBER cek aksesnya sendiri
router.get("/me", auth, allowRoles("member"), controller.getMyAccess);

module.exports = router;