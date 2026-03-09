const pool = require("../config/db");
const {
  sendExcelAccessRevokedNotification,
} = require("../services/notification.services");

// ==============================
// GET LIST ACCESS
// ==============================
exports.getAccessList = async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT 
  e.user_id,
  u.name as user_name,
  r.role_name,
  e.site_id,
  s.site_name,
  e.can_download,
  e.seen_by_admin,
  e.created_at
FROM excel_download_access e
      JOIN users u ON u.id = e.user_id
      JOIN roles r ON r.id = u.role_id
      JOIN sites s ON s.id = e.site_id
      WHERE e.revoked_at IS NULL
    `;

    let params = [];

    if (role === "admin") {
      query += ` AND e.site_id = $1`;
      params.push(site_id);
    }

    const { rows } = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch access list" });
  }
};

// ==============================
// GRANT ACCESS
// ==============================
exports.grantAccess = async (req, res) => {
  try {
    const { role, site_id: adminSiteId, id: grantedBy } = req.user;
    const { user_id, site_id } = req.body;

    // 1️⃣ hanya admin / superadmin boleh
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 2️⃣ admin hanya boleh grant di site sendiri
    if (role === "admin" && Number(site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "Admin only for own site" });
    }

    // 3️⃣ cek user target
    const userCheck = await pool.query(
      "SELECT id, site_id FROM users WHERE id = $1 AND deleted_at IS NULL",
      [user_id]
    );

    if (userCheck.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = userCheck.rows[0];

    if (role === "admin" && Number(targetUser.site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "User not in your site" });
    }

    // 4️⃣ REVOKE ACTIVE DULU (biar aman dengan partial unique index)
    await pool.query(
      `
      UPDATE excel_download_access
      SET revoked_at = NOW(),
          updated_at = NOW(),
          can_download = false
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      `,
      [user_id, site_id]
    );

    // 5️⃣ INSERT BARU (aktif)
    await pool.query(
      `
      INSERT INTO excel_download_access
        (user_id, site_id, can_download, granted_by, created_at, updated_at, seen_by_admin, revoked_at)
      VALUES
        ($1, $2, true, $3, NOW(), NOW(), $4, NULL)
      `,
      [user_id, site_id, grantedBy, role === "superadmin" ? false : true]
    );

    return res.json({ message: "Access granted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Grant failed" });
  }
};

// ==============================
// REVOKE ACCESS
// ==============================
exports.revokeAccess = async (req, res) => {
  try {
    const { role, site_id: adminSiteId, name: revokedByName } = req.user;
    const { user_id, site_id } = req.body;

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (role === "admin" && Number(site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "Admin only for own site" });
    }

    const targetUserRes = await pool.query(
      `
      SELECT id, site_id
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [user_id]
    );

    if (targetUserRes.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = targetUserRes.rows[0];

    if (role === "admin" && Number(targetUser.site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "User not in your site" });
    }

    const revokeRes = await pool.query(
      `
      UPDATE excel_download_access
      SET revoked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          can_download = false
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      RETURNING user_id, site_id
      `,
      [user_id, site_id]
    );

    if (revokeRes.rowCount === 0) {
      return res.status(404).json({ message: "Access not found or already revoked" });
    }

    await sendExcelAccessRevokedNotification({
      requesterId: user_id,
      siteId: site_id,
      revokedByName,
    });

    res.json({ message: "Access revoked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Revoke failed" });
  }
};

// ==============================
// UNSEEN COUNT (ADMIN ONLY)
// ==============================
exports.getUnseenCount = async (req, res) => {
  try {
    const { role, site_id } = req.user;

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { rows } = await pool.query(
      `
      SELECT COUNT(*) 
      FROM excel_download_access
      WHERE site_id = $1
      AND seen_by_admin = false
      AND revoked_at IS NULL
      `,
      [site_id]
    );

    res.json({ count: parseInt(rows[0].count) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed" });
  }
};

// ==============================
// MARK AS SEEN
// ==============================
exports.markSeen = async (req, res) => {
  try {
    const { role, site_id } = req.user;

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await pool.query(
      `
      UPDATE excel_download_access
      SET seen_by_admin = true
      WHERE site_id = $1
      `,
      [site_id]
    );

    res.json({ message: "Marked as seen" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed" });
  }
};

// ==============================
// GET MY ACCESS (MEMBER)
// ==============================
exports.getMyAccess = async (req, res) => {
  try {
    const { id: userId, site_id: siteId } = req.user;

    const r = await pool.query(
      `
      SELECT can_download
      FROM excel_download_access
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId, siteId]
    );

    const can = r.rowCount > 0 ? r.rows[0].can_download === true : false;
    return res.json({ can_download: can });
  } catch (err) {
    console.error("GET MY EXCEL ACCESS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};