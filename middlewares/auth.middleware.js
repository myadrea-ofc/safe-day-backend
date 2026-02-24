const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const deviceId = req.headers["x-device-id"];

  if (!authHeader) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  // 🔥 Tambahan: validasi format Bearer
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Format token tidak valid" });
  }

  if (!deviceId) {
    return res.status(401).json({
      message: "Device ID tidak ditemukan",
    });
  }

  try {
    // AMBIL TOKEN
    const token = authHeader.split(" ")[1];

    // VERIFY JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SIMPAN TOKEN KE REQUEST
    req.token = token;

    // CEK SESSION AKTIF + VALID + HEARTBEAT WINDOW
    const sessionCheck = await pool.query(
      `
      SELECT id
      FROM user_sessions
      WHERE user_id = $1
        AND token = $2
        AND device_id = $3
        AND is_active = true
        AND expired_at > NOW()
        AND (
          last_seen IS NULL
          OR last_seen > NOW() - INTERVAL '3 days'
        )
      `,
      [decoded.id, token, deviceId]
    );

    if (sessionCheck.rowCount === 0) {

      // 🔥 Optimasi: reason lebih aman
      let reason = "invalid_session";

      const reasonRes = await pool.query(
        `
        SELECT logout_reason
        FROM user_sessions
        WHERE token = $1
        ORDER BY logout_at DESC
        LIMIT 1
        `,
        [token]
      );

      if (reasonRes.rowCount > 0) {
        reason = reasonRes.rows[0].logout_reason ?? "invalid_session";
      }

      return res.status(401).json({
        message: "Session tidak aktif",
        reason: reason,
      });
    }

    // 🔥 Optimasi: Update heartbeat hanya jika lebih dari 5 menit
    await pool.query(
      `
      UPDATE user_sessions
      SET last_seen = NOW()
      WHERE user_id = $1
        AND token = $2
        AND device_id = $3
        AND is_active = true
        AND (
          last_seen IS NULL
          OR last_seen < NOW() - INTERVAL '5 minutes'
        )
      `,
      [decoded.id, token, deviceId]
    );

    // CEK USER MASIH ADA
    const userQuery = await pool.query(
      `
      SELECT
  u.id,
  u.name,
  u.role_id,
  u.site_id,
  u.department_id,
  u.must_change_password,
  r.role_name
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.id = $1
  AND u.deleted_at IS NULL
      `,
      [decoded.id]
    );

    if (userQuery.rowCount === 0) {
      return res.status(401).json({ message: "User tidak ditemukan" });
    }

    const currentRoleId = userQuery.rows[0].role_id;

    // 🔥 FIX: Type-safe role comparison
    if (Number(currentRoleId) !== Number(decoded.role_id)) {

      // matikan session sekarang juga
      await pool.query(
        `
        UPDATE user_sessions
        SET is_active = false,
            logout_at = NOW(),
            logout_reason = 'role_changed'
        WHERE token = $1
        `,
        [token]
      );

      return res.status(401).json({
        message: "Role berubah",
        reason: "role_changed",
      });
    }

    // PASS KE REQUEST
    req.user = {
  id: userQuery.rows[0].id,
  name: userQuery.rows[0].name,
  site_id: userQuery.rows[0].site_id,
  department_id: userQuery.rows[0].department_id,
  role: userQuery.rows[0].role_name.toLowerCase(),
  must_change_password: userQuery.rows[0].must_change_password === true,
};

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    // TOKEN EXPIRED → MATIKAN SESSION
    if (err.name === "TokenExpiredError") {
      try {
        const token = authHeader.split(" ")[1];

        await pool.query(
          `
          UPDATE user_sessions
          SET is_active = false,
              logout_at = NOW(),
              logout_reason = 'token_expired'
          WHERE token = $1
          `,
          [token]
        );
      } catch (e) {
        console.error("FAILED TO UPDATE EXPIRED SESSION:", e.message);
      }
    }

    return res.status(401).json({ message: "Unauthorized" });
  }
};
