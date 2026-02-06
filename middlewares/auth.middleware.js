const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const deviceId = req.headers["x-device-id"];

  if (!authHeader) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
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

    // CEK SESSION AKTIF + HEARTBEAT
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

  return res.status(401).json({
    message: "Session tidak aktif",
    reason: reasonRes.rows[0]?.logout_reason ?? "invalid_session",
  });
}


    //  UPDATE HEARTBEAT 
    await pool.query(
  `
  UPDATE user_sessions
  SET last_seen = NOW()
  WHERE user_id = $1
    AND token = $2
    AND device_id = $3
    AND is_active = true
  `,
  [decoded.id, token, deviceId]
);


    // CEK USER MASIH ADA
    const userQuery = await pool.query(
      `
      SELECT
        u.id,
        u.site_id,
        u.department_id,
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

    // PASS KE REQUEST
    req.user = {
      id: userQuery.rows[0].id,
      site_id: userQuery.rows[0].site_id,
      department_id: userQuery.rows[0].department_id,
      role: userQuery.rows[0].role_name.toLowerCase(),
    };

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);

    // TOKEN EXPIRED → MATIKAN SESSION
    if (err.name === "TokenExpiredError") {
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
    }

    return res.status(401).json({ message: "Unauthorized" });
  }
};
