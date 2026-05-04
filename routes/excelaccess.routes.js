const express = require("express");
const router = express.Router();

const controller = require("../controllers/excel.access.controller");
const auth = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const auditMiddleware = require("../middlewares/audit.middleware");

router.get("/", auth, auditMiddleware("Get Excel Access List"), controller.getAccessList);
router.post("/grant", auth, auditMiddleware("Grant Excel Access"), controller.grantAccess);
router.post("/revoke", auth, auditMiddleware("Revoke Excel Access"), controller.revokeAccess);
router.post("/delete", auth, auditMiddleware("Delete Excel Access"), controller.deleteAccess);
router.get("/unseen-count", auth, auditMiddleware("Get Unseen Count"), controller.getUnseenCount);
router.post("/mark-seen", auth, auditMiddleware("Mark as Seen"), controller.markSeen);

// MEMBER cek aksesnya sendiri
router.get("/me", auth, allowRoles("member"), auditMiddleware("Get My Excel Access"), controller.getMyAccess);

module.exports = router;