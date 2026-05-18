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

      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        100
      );
      const offset = (page - 1) * limit;

      const selectedSiteId = req.query.site_id
        ? parseInt(req.query.site_id, 10)
        : null;

      const search = (req.query.search || "").toString().trim();
      const dateFrom = req.query.date_from || null;
      const dateTo = req.query.date_to || null;

      const whereParts = [];
      const params = [];

      // Admin hanya boleh lihat site sendiri
      if (role === "admin") {
        params.push(site_id);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      // Superadmin boleh filter site tertentu
      if (role === "superadmin" && selectedSiteId) {
        params.push(selectedSiteId);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      // Search server-side
      if (search !== "") {
        params.push(`%${search.toLowerCase()}%`);
        const idx = params.length;

        whereParts.push(`
          (
            LOWER(COALESCE(al.user_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.user_role, '')) LIKE $${idx}
            OR LOWER(COALESCE(s.site_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(d.department_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.action, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.module, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.method, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.endpoint, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.description, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.ip_address, '')) LIKE $${idx}
          )
        `);
      }

      // Date filter
      if (dateFrom) {
        params.push(dateFrom);
        whereParts.push(`al.created_at >= $${params.length}`);
      }

      if (dateTo) {
        params.push(dateTo);
        whereParts.push(`al.created_at < $${params.length}`);
      }

      const where =
        whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

      // Query total data
      const countResult = await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audit_logs al
        LEFT JOIN sites s ON s.id = al.site_id
        LEFT JOIN departments d ON d.id = al.department_id
        ${where}
        `,
        params
      );

      const total = countResult.rows[0]?.total || 0;

      // Query data per halaman
      const dataParams = [...params];

      dataParams.push(limit);
      const limitIndex = dataParams.length;

      dataParams.push(offset);
      const offsetIndex = dataParams.length;

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
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
        `,
        dataParams
      );

      return res.json({
        data: result.rows,
        meta: {
          page,
          limit,
          total,
          total_page: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("GET AUDIT LOG ERROR:", err);
      return res.status(500).json({ message: "Gagal mengambil audit log" });
    }
  }
);

module.exports = router;