const pool = require("../config/db");
const {
  sendExcelAccessRevokedNotification,
  sendExcelAccessGrantedNotification,
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
    const {
      role,
      site_id: adminSiteId,
      id: grantedBy,
      name: grantedByName,
    } = req.user;

    const { user_id, site_id } = req.body;

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (role === "admin" && Number(site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "Admin only for own site" });
    }

    const userCheck = await pool.query(
      `
      SELECT id, site_id
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      `,
      [user_id]
    );

    if (userCheck.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = userCheck.rows[0];

    if (
      role === "admin" &&
      Number(targetUser.site_id) !== Number(adminSiteId)
    ) {
      return res.status(403).json({ message: "User not in your site" });
    }

    // kalau pernah ada row revoked lama, biarkan.
    // kita fokus ke row aktif/nonaktif (revoked_at IS NULL)
    const existing = await pool.query(
      `
      SELECT id, can_download
      FROM excel_download_access
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      LIMIT 1
      `,
      [user_id, site_id]
    );

    if (existing.rowCount > 0) {
      await pool.query(
        `
        UPDATE excel_download_access
        SET can_download = true,
            granted_by = $3,
            updated_at = NOW(),
            seen_by_admin = $4
        WHERE user_id = $1
          AND site_id = $2
          AND revoked_at IS NULL
        `,
        [user_id, site_id, grantedBy, role === "superadmin" ? false : true]
      );
    } else {
      await pool.query(
        `
        INSERT INTO excel_download_access
          (user_id, site_id, can_download, granted_by, created_at, updated_at, seen_by_admin, revoked_at)
        VALUES
          ($1, $2, true, $3, NOW(), NOW(), $4, NULL)
        `,
        [user_id, site_id, grantedBy, role === "superadmin" ? false : true]
      );
    }

    await sendExcelAccessGrantedNotification({
      requesterId: user_id,
      siteId: site_id,
      grantedByName,
    });

    return res.json({ message: "Access granted" });
  } catch (err) {
    console.error("GRANT ACCESS ERROR:", err);
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
      SET can_download = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      RETURNING user_id, site_id
      `,
      [user_id, site_id]
    );

    if (revokeRes.rowCount === 0) {
      return res.status(404).json({ message: "Access not found" });
    }

    await sendExcelAccessRevokedNotification({
      requesterId: user_id,
      siteId: site_id,
      revokedByName,
    });

    return res.json({ message: "Access disabled" });
  } catch (err) {
    console.error("REVOKE ACCESS ERROR:", err);
    return res.status(500).json({ message: "Revoke failed" });
  }
};

// ==============================
// DELETE ACCESS (HAPUS RECORD)
// ==============================
exports.deleteAccess = async (req, res) => {
  try {
    const { role, site_id: adminSiteId, name } = req.user;
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

    const delRes = await pool.query(
      `
      DELETE FROM excel_download_access
      WHERE user_id = $1
        AND site_id = $2
        AND revoked_at IS NULL
      RETURNING id
      `,
      [user_id, site_id]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: "Access not found" });
    }

    // 🔔 KIRIM NOTIF REVOKE
    await sendExcelAccessRevokedNotification({
      requesterId: user_id,
      siteId: site_id,
      revokedByName: name || "Admin",
    });

    return res.json({ message: "Access deleted" });

  } catch (err) {
    console.error("DELETE ACCESS ERROR:", err);
    return res.status(500).json({ message: "Delete failed" });
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