const {
  sendRoleChangedNotification,
} = require("../path/to/your/notification/module"); 
const express = require("express");
const router = express.Router();

const jwtOnly = require("../middlewares/jwtOnly");
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

      // 🔒 VALIDASI TAMBAHAN DI SINI
      if (req.user.role !== "superadmin") {
        const target = await pool.query(
          `
          SELECT r.role_name
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.id = $1
          `,
          [req.params.id]
        );

        if (target.rowCount === 0) {
          return res.status(404).json({ message: "User tidak ditemukan" });
        }

        if (target.rows[0].role_name === "superadmin") {
          return res.status(403).json({ message: "Tidak boleh mengubah Superadmin" });
        }

        if (role === "superadmin") {
          return res.status(403).json({ message: "Tidak boleh menjadikan Superadmin" });
        }
      }

      let sql = `
        UPDATE users
        SET role_id = $1
        WHERE id = $2
          AND deleted_at IS NULL
      `;

      const params = [roleRes.rows[0].id, req.params.id];

      if (req.user.role !== "superadmin") {
        sql += ` AND site_id = $3`;
        params.push(req.user.site_id);
      }

      const result = await pool.query(sql, params);

      if (result.rowCount === 0) {
        return res.status(403).json({ message: "Tidak punya akses" });
      }

   await pool.query(
  `
  UPDATE user_sessions
  SET is_active = false,
      logout_at = NOW(),
      logout_reason = 'role_changed'
  WHERE user_id = $1
    AND is_active = true
  `,
  [req.params.id]
);

//  Kirim notif 
const newRoleName = role;
await sendRoleChangedNotification({
  userId: req.params.id,
  newRoleName,
});

//  respon
return res.json({ success: true });

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
        SELECT u.id, u.name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.department_id = $1
          AND u.deleted_at IS NULL
      `;

      const params = [department_id];

      // 🔒 Site filtering
      if (req.user.role === "superadmin") {
        if (site_id) {
          params.push(site_id);
          sql += ` AND u.site_id = $${params.length}`;
        }
      } else {
        params.push(req.user.site_id);
        sql += ` AND u.site_id = $${params.length}`;
      }

      // 🔒 ADMIN tidak boleh lihat superadmin
      if (req.user.role !== "superadmin") {
        params.push("superadmin");
        sql += ` AND r.role_name != $${params.length}`;
      }

      // 🔍 Search
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        sql += ` AND LOWER(u.name) LIKE $${params.length}`;
      }

      // Pagination
      params.push(parseInt(limit, 10));
      params.push(parseInt(offset, 10));

      sql += ` ORDER BY u.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await pool.query(sql, params);
      res.json(result.rows);

    } catch (err) {
      console.error("LIST USERS ERROR:", err);
      res.status(500).json({ message: "Gagal mengambil daftar user" });
    }
  }
);


router.post("/fcm-token", authMiddleware, async (req, res) => {
  const { fcm_token } = req.body;
  const deviceId = req.headers["x-device-id"];

  if (!fcm_token) return res.status(400).json({ message: "Token required" });
  if (!deviceId) return res.status(400).json({ message: "Device ID required" });

  try {
    // pastikan token tidak nyangkut di user/device lain
    await pool.query(
      `DELETE FROM user_devices WHERE fcm_token = $1`,
      [fcm_token]
    );

    // upsert token untuk user+device sekarang
    await pool.query(
      `
      INSERT INTO user_devices (user_id, device_id, fcm_token, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, device_id)
      DO UPDATE SET
        fcm_token = EXCLUDED.fcm_token,
        updated_at = NOW()
      `,
      [req.user.id, deviceId, fcm_token]
    );

    return res.json({ message: "Token saved (user_devices)" });
  } catch (err) {
    console.error("FCM TOKEN SAVE ERROR:", err);
    return res.status(500).json({ message: "Failed save token" });
  }
});





module.exports = router;
