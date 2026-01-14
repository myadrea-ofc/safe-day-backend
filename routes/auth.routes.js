// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");

// Route untuk validasi token
router.get("/validate", authMiddleware, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

module.exports = router;
