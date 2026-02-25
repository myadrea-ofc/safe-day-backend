const bcrypt = require("bcryptjs");
const pool = require("../config/db");

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: "Password minimal 8 karakter" });
  }

  try {
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const oldHash = userResult.rows[0].password;

    const validOld = await bcrypt.compare(oldPassword, oldHash);
    if (!validOld) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const sameAsOld = await bcrypt.compare(newPassword, oldHash);
    if (sameAsOld) {
      return res.status(400).json({
        message: "Password baru tidak boleh sama dengan password lama",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
  `
  UPDATE users
  SET password = $1,
      must_change_password = false,
      updated_at = NOW()
  WHERE id = $2
    AND deleted_at IS NULL
  `,
  [hashedPassword, userId]
);

// ✅ MATIKAN SESSION
await pool.query(`
  UPDATE user_sessions
  SET is_active = false,
      logout_at = NOW(),
      logout_reason = 'password_changed'
  WHERE user_id = $1
    AND is_active = true
`, [userId]);

return res.json({
  success: true,
  message: "Password berhasil diganti, silakan login ulang",
});
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, password, role, site_id, department_id, email } = req.body;

    if (!name || !password || !role || !department_id || !email) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const emailNormalized = String(email).trim().toLowerCase();

    const allowedRoles = {
      superadmin: ["superadmin", "admin", "member"],
      admin: ["admin", "member"],
    };

    if (!allowedRoles[req.user.role]?.includes(role)) {
      return res.status(403).json({
        message: "Anda tidak berhak membuat user dengan role ini",
      });
    }

    const finalSiteId =
      req.user.role === "superadmin" ? site_id : req.user.site_id;

    if (!finalSiteId) {
      return res.status(400).json({ message: "Site wajib diisi" });
    }

    if (
      req.user.role === "admin" &&
      role === "admin" &&
      finalSiteId !== req.user.site_id
    ) {
      return res.status(403).json({
        message: "Admin hanya boleh membuat admin di site sendiri",
      });
    }

    const roleRes = await pool.query(
      "SELECT id FROM roles WHERE role_name=$1",
      [role]
    );
    if (roleRes.rowCount === 0) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    const deptCheck = await pool.query(
      "SELECT 1 FROM departments WHERE id=$1 AND site_id=$2",
      [department_id, finalSiteId]
    );
    if (deptCheck.rowCount === 0) {
      return res.status(400).json({ message: "Department tidak valid" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users
        (name, password, role_id, site_id, department_id, created_by, email)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, name, email
      `,
      [
        name,
        hashed,
        roleRes.rows[0].id,
        finalSiteId,
        department_id,
        req.user.id,
        emailNormalized,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);

    if (err.code === "23505") {
      return res.status(409).json({ message: "Email sudah digunakan" });
    }

    res.status(500).json({ message: "Gagal menambahkan user" });
  }
};


exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    const allowedRoles = {
      superadmin: ["superadmin", "admin", "member"],
      admin: ["admin", "member"],
    };

    if (!allowedRoles[req.user.role]?.includes(role)) {
      return res.status(403).json({ message: "Tidak berhak mengubah role ini" });
    }

    const roleRes = await pool.query(
      "SELECT id FROM roles WHERE role_name=$1",
      [role]
    );
    if (roleRes.rowCount === 0) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    let sql = `
      UPDATE users
      SET role_id=$1
      WHERE id=$2 AND deleted_at IS NULL
    `;
    const params = [roleRes.rows[0].id, req.params.id];

    if (req.user.role !== "superadmin") {
      sql += " AND site_id=$3";
      params.push(req.user.site_id);
    }

    const result = await pool.query(sql, params);

    if (result.rowCount === 0) {
      return res.status(403).json({ message: "Tidak punya akses" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE ROLE ERROR:", err);
    res.status(500).json({ message: "Gagal update role" });
  }
};

exports.getProfile = async (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    role: req.user.role,
    site_id: req.user.site_id,
  });
};


