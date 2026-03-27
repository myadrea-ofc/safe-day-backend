const pool = require("../config/db");
const {
  sendExcelAccessRevokedNotification,
  sendExcelAccessGrantedNotification,
} = require("../services/notification.services");
const { EXCEL_FEATURES } = require("../constants/excel.features");

// ==============================
// GET LIST ACCESS
// ==============================
exports.getAccessList = async (req, res) => {
  try {
    const { role, site_id } = req.user;
    const feature = String(req.query.feature || "").toLowerCase().trim();

    let query = `
      SELECT 
        e.user_id,
        u.name as user_name,
        r.role_name,
        e.site_id,
        s.site_name,
        e.can_download,
        e.feature,
        e.seen_by_admin,
        e.created_at
      FROM excel_download_access e
      JOIN users u ON u.id = e.user_id
      JOIN roles r ON r.id = u.role_id
      JOIN sites s ON s.id = e.site_id
      WHERE e.revoked_at IS NULL
    `;

    const params = [];

    if (role === "admin") {
      params.push(site_id);
      query += ` AND e.site_id = $${params.length}`;
    }

    if (feature) {
      params.push(feature);
      query += ` AND LOWER(e.feature) = $${params.length}`;
    }

    query += ` ORDER BY e.created_at DESC`;

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
const feature = String(req.body?.feature || "").toLowerCase().trim();

    

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (role === "admin" && Number(site_id) !== Number(adminSiteId)) {
      return res.status(403).json({ message: "Admin only for own site" });
    }

    if (!feature || !EXCEL_FEATURES.includes(feature)) {
  return res.status(400).json({ message: "Feature tidak valid" });
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
  AND feature = $3
  AND revoked_at IS NULL
LIMIT 1
      `,
      [user_id, site_id, feature]
    );

    if (existing.rowCount > 0) {
      await pool.query(
        `
        UPDATE excel_download_access
SET can_download = true,
    granted_by = $4,
    updated_at = NOW(),
    seen_by_admin = $5
WHERE user_id = $1
  AND site_id = $2
  AND feature = $3
  AND revoked_at IS NULL
        `,
        [user_id, site_id, feature, grantedBy, role === "superadmin" ? false : true]
      );
    } else {
      await pool.query(
        `
        INSERT INTO excel_download_access
  (user_id, site_id, feature, can_download, granted_by, created_at, updated_at, seen_by_admin, revoked_at)
VALUES
  ($1, $2, $3, true, $4, NOW(), NOW(), $5, NULL)
        `,
        [user_id, site_id, feature, grantedBy, role === "superadmin" ? false : true]
      );
    }

    await sendExcelAccessGrantedNotification({
      requesterId: user_id,
      siteId: site_id,
      grantedByName,
      feature
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

    const feature = String(req.body?.feature || "").toLowerCase().trim();

if (!feature || !EXCEL_FEATURES.includes(feature)) {
  return res.status(400).json({ message: "Feature tidak valid" });
}

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
  AND feature = $3
  AND revoked_at IS NULL
      RETURNING user_id, site_id
      `,
      [user_id, site_id, feature]
    );

    if (revokeRes.rowCount === 0) {
      return res.status(404).json({ message: "Access not found" });
    }

    await sendExcelAccessRevokedNotification({
      requesterId: user_id,
      siteId: site_id,
      revokedByName,
      feature
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
    const feature = String(req.body?.feature || "").toLowerCase().trim();

    if (!feature || !EXCEL_FEATURES.includes(feature)) {
  return res.status(400).json({ message: "Feature tidak valid" });
}

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
  AND feature = $3
  AND revoked_at IS NULL
      RETURNING id
      `,
      [user_id, site_id, feature]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: "Access not found" });
    }

    // 🔔 KIRIM NOTIF REVOKE
    await sendExcelAccessRevokedNotification({
      requesterId: user_id,
      siteId: site_id,
      revokedByName: name || "Admin",
      feature
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
    const feature = String(req.query.feature || "").toLowerCase().trim();

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    let query = `
      SELECT COUNT(*) 
      FROM excel_download_access
      WHERE site_id = $1
      AND seen_by_admin = false
      AND revoked_at IS NULL
    `;

    const params = [site_id];

    if (feature) {
      params.push(feature);
      query += ` AND LOWER(feature) = $${params.length}`;
    }

    const { rows } = await pool.query(query, params);

    res.json({ count: parseInt(rows[0].count, 10) });
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
    const feature = String(req.query.feature || "").toLowerCase().trim();

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    let query = `
      UPDATE excel_download_access
      SET seen_by_admin = true
      WHERE site_id = $1
      AND revoked_at IS NULL
    `;

    const params = [site_id];

    if (feature) {
      params.push(feature);
      query += ` AND LOWER(feature) = $${params.length}`;
    }

    await pool.query(query, params);

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

const feature = String(req.query.feature || "").toLowerCase().trim();

if (!feature || !EXCEL_FEATURES.includes(feature)) {
  return res.status(400).json({ message: "Feature tidak valid" });
}

    const r = await pool.query(
      `
      SELECT can_download
FROM excel_download_access
WHERE user_id = $1
  AND site_id = $2
  AND feature = $3
  AND revoked_at IS NULL
ORDER BY created_at DESC
LIMIT 1
      `,
      [userId, siteId, feature]
    );

    const can = r.rowCount > 0 ? r.rows[0].can_download === true : false;
    return res.json({ can_download: can });
  } catch (err) {
    console.error("GET MY EXCEL ACCESS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};