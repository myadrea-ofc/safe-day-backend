const bcrypt = require("bcryptjs");
const pool = require("../config/db");

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  try {
    // 1️⃣ ambil password lama
    const userResult = await pool.query(
      "SELECT password FROM users WHERE id = $1 AND deleted_at IS NULL",
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // 2️⃣ compare password lama
    const valid = await bcrypt.compare(
      oldPassword,
      userResult.rows[0].password
    );

    if (!valid) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    // 3️⃣ hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4️⃣ update password
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, userId]
    );

    // 5️⃣ response → Flutter logout
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
    const { name, password, role, site_id, department_id } = req.body;

    if (!name || !password || !role || !department_id) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    // 🔐 ROLE PERMISSION
    const allowedRoles = {
      superadmin: ["superadmin", "admin", "member"],
      admin: ["admin", "member"],
    };

    if (!allowedRoles[req.user.role]?.includes(role)) {
      return res.status(403).json({
        message: "Anda tidak berhak membuat user dengan role ini",
      });
    }

    // 🔒 SITE RULE
    const finalSiteId =
      req.user.role === "superadmin" ? site_id : req.user.site_id;

    if (!finalSiteId) {
      return res.status(400).json({ message: "Site wajib diisi" });
    }

    // ❗ ADMIN hanya boleh buat ADMIN di site sendiri
    if (
      req.user.role === "admin" &&
      role === "admin" &&
      finalSiteId !== req.user.site_id
    ) {
      return res.status(403).json({
        message: "Admin hanya boleh membuat admin di site sendiri",
      });
    }

    // ROLE ID
    const roleRes = await pool.query(
      "SELECT id FROM roles WHERE role_name=$1",
      [role]
    );
    if (roleRes.rowCount === 0) {
      return res.status(400).json({ message: "Role tidak valid" });
    }

    // DEPARTMENT CHECK
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
        (name, password, role_id, site_id, department_id, created_by)
      VALUES
        ($1,$2,$3,$4,$5,$6)
      RETURNING id, name
      `,
      [
        name,
        hashed,
        roleRes.rows[0].id,
        finalSiteId,
        department_id,
        req.user.id,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
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


