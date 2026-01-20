const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

    req.user = {
      id: userQuery.rows[0].id,
      site_id: userQuery.rows[0].site_id,
      department_id: userQuery.rows[0].department_id,
      role: userQuery.rows[0].role_name.toLowerCase(), // 🔥 penting
    };

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

