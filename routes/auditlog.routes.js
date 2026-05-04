const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");

router.get(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

      const params = [];
      let where = "";

      if (role === "admin") {
        params.push(site_id);
        where = "WHERE al.site_id = $1";
      }

      const result = await pool.query(
        `
        SELECT
          al.id,
          al.user_id,
          al.user_name,
          al.user_role,
          al.site_id,
          COALESCE(s.site_name, '-') AS site_name,
          al.department_id,
          COALESCE(d.department_name, '-') AS department_name,
          al.action,
          al.module,
          al.method,
          al.endpoint,
          al.description,
          al.response_status,
          al.ip_address,
          al.device_id,
          al.user_agent,
          al.created_at
        FROM audit_logs al
        LEFT JOIN sites s ON s.id = al.site_id
        LEFT JOIN departments d ON d.id = al.department_id
        ${where}
        ORDER BY al.created_at DESC
        `,
        params
      );

      return res.json(result.rows);
    } catch (err) {
      console.error("GET AUDIT LOG ERROR:", err);
      return res.status(500).json({ message: "Gagal mengambil audit log" });
    }
  }
);

module.exports = router;