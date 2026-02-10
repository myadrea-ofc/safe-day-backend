const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/unread-count", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS unread
    FROM notifications
    WHERE user_id = $1
      AND is_read = false
    `,
    [req.user.id]
  );

  res.json(result.rows[0]);
});

router.get("/", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
    SELECT id, title, body, data, is_read, created_at
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
});


router.put("/:id/read", authMiddleware, async (req, res) => {
  await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    `,
    [req.params.id, req.user.id]
  );

  res.json({ message: "Marked as read" });
});


module.exports = router;
