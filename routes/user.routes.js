const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const bcrypt = require("bcryptjs");

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const userController = require("../controllers/user.controller");

router.put(
  "/change-password",
  authMiddleware,
  userController.changePassword
);

router.post(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { name, password, role, site_id, department_id } = req.body;

      if (!name || !password || !role || !department_id) {
        return res.status(400).json({ message: "Data tidak lengkap" });
      }

      const roleResult = await pool.query(
        `SELECT id FROM roles WHERE role_name = $1`,
        [role]
      );

      if (roleResult.rowCount === 0) {
        return res.status(400).json({ message: "Role tidak valid" });
      }

      const roleId = roleResult.rows[0].id;

      // 🔒 SITE RULE
      let finalSiteId;

      if (req.user.role === "superadmin") {
        if (!site_id) {
          return res.status(400).json({ message: "Site wajib diisi" });
        }
        finalSiteId = site_id;
      } else {
        // ADMIN → PAKSA SITE SENDIRI
        finalSiteId = req.user.site_id;
      }

      // 🔐 HASH PASSWORD
      const hashed = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `
        INSERT INTO users
          (name, password, role_id, site_id, department_id, created_by)
        VALUES
          ($1,$2,$3,$4,$5,$6)
        RETURNING id, name, site_id, department_id
        `,
        [
          name,
          hashed,
          roleId,
          finalSiteId,
          department_id,
          req.user.id,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("ADD USER ERROR:", err);
      res.status(500).json({ message: "Gagal menambahkan user" });
    }
  }
);

router.put(
  "/:id/role",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { role } = req.body;

      const roleRes = await pool.query(
        `SELECT id FROM roles WHERE role_name = $1`,
        [role]
      );

      if (roleRes.rowCount === 0) {
        return res.status(400).json({ message: "Role tidak valid" });
      }

      let sql = `
        UPDATE users
        SET role_id = $1
        WHERE id = $2
          AND deleted_at IS NULL
      `;

      const params = [roleRes.rows[0].id, req.params.id];

      // 🔒 ADMIN → BATASI SITE
      if (req.user.role !== "superadmin") {
        sql += ` AND site_id = $3`;
        params.push(req.user.site_id);
      }

      const result = await pool.query(sql, params);

      if (result.rowCount === 0) {
        return res.status(403).json({ message: "Tidak punya akses" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Gagal update role" });
    }
  }
);

router.get(
  "/profile",
  authMiddleware,
  userController.getProfile
);

router.get(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { site_id, department_id, search = "", limit = 50, offset = 0 } = req.query;

      if (!department_id) {
        return res.status(400).json({ message: "Department wajib dipilih" });
      }

      let sql = `
        SELECT id, name 
        FROM users 
        WHERE department_id = $1 
          AND deleted_at IS NULL
      `;
      const params = [department_id];

      // 🔒 Site filtering
      if (req.user.role === "superadmin") {
        if (site_id) {
          sql += " AND site_id = $2";
          params.push(site_id);
        }
      } else {
        sql += " AND site_id = $2";
        params.push(req.user.site_id);
      }

      // 🔍 Search by name
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        sql += ` AND LOWER(name) LIKE $${params.length}`;
      }

      // Pagination
      sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit, 10), parseInt(offset, 10));

      const result = await pool.query(sql, params);
      res.json(result.rows);
    } catch (err) {
      console.error("LIST USERS ERROR:", err);
      res.status(500).json({ message: "Gagal mengambil daftar user" });
    }
  }
);




module.exports = router;
