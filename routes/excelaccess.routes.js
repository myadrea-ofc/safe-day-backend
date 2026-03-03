const express = require("express");
const router = express.Router();

const controller = require("../controllers/excelAccessController");
const auth = require("../middleware/auth");

router.get("/", auth, controller.getAccessList);
router.post("/grant", auth, controller.grantAccess);
router.post("/revoke", auth, controller.revokeAccess);
router.get("/unseen-count", auth, controller.getUnseenCount);
router.post("/mark-seen", auth, controller.markSeen);

module.exports = router;