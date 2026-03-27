const pool = require("../config/db");
const {
  sendExcelAccessRequestCreatedNotification,
  sendExcelAccessDecisionNotification,
} = require("../services/notification.services"); 
const { EXCEL_FEATURES } = require("../constants/excel.features");

async function grantExcelAccess(client, { userId, siteId, feature, grantedBy, seenByAdmin }) {
  // revoke record aktif sebelumnya (kalau ada)
  await client.query(
    `
    UPDATE excel_download_access
SET revoked_at = NOW(),
    updated_at = NOW(),
    can_download = false
WHERE user_id = $1
  AND site_id = $2
  AND feature = $3
  AND revoked_at IS NULL
    `,
    [userId, siteId, feature]
  );

  // insert record baru (aktif)
  await client.query(
    `
    INSERT INTO excel_download_access
  (user_id, site_id, feature, can_download, granted_by, created_at, updated_at, seen_by_admin, revoked_at)
VALUES
  ($1, $2, $3, true, $4, NOW(), NOW(), $5, NULL)
    `,
    [userId, siteId, feature, grantedBy, Boolean(seenByAdmin)]
  );
}

exports.createRequest = async (req, res) => {
  const requesterId = req.user.id;
  const siteId = req.user.site_id;

  const feature = String(req.body?.feature || "").toLowerCase().trim();

if (!feature || !EXCEL_FEATURES.includes(feature)) {
  return res.status(400).json({ message: "Feature tidak valid" });
}

  try {
    const insert = await pool.query(
      `
      INSERT INTO excel_access_requests (requester_user_id, site_id, feature)
VALUES ($1, $2, $3)
RETURNING id, requester_user_id, site_id, feature, status, requested_at
      `,
      [requesterId, siteId, feature]
    );

    const row = insert.rows[0];

    await sendExcelAccessRequestCreatedNotification({
  requesterId,
  requesterName: req.user.name,
  siteId,
  requestId: row.id,
  feature: row.feature,
});
    return res.status(201).json(row);
  } catch (err) {
    if (String(err?.code) === "23505") {
      return res.status(409).json({ message: "Masih ada permintaan pending untuk fitur ini di site kamu." });
    }
    console.error("CREATE EXCEL ACCESS REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMyLatestRequest = async (req, res) => {
  try {
    const { id: requesterUserId, site_id: siteId, role } = req.user;

    if (role !== "member") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const feature = String(req.query.feature || "").toLowerCase().trim();

    if (!feature || !EXCEL_FEATURES.includes(feature)) {
      return res.status(400).json({ message: "Feature tidak valid" });
    }

    const r = await pool.query(
      `
      SELECT
        r.id,
        r.requester_user_id,
        r.site_id,
        r.feature,
        r.status,
        r.requested_at,
        r.decided_at,
        r.decided_by_user_id,
        r.reject_reason,
        EXISTS (
          SELECT 1
          FROM excel_download_access a
          WHERE a.user_id = r.requester_user_id
            AND a.site_id = r.site_id
            AND a.feature = r.feature
            AND a.can_download = true
            AND a.revoked_at IS NULL
        ) AS still_has_access
      FROM excel_access_requests r
      WHERE r.requester_user_id = $1
        AND r.site_id = $2
        AND r.feature = $3
      ORDER BY r.requested_at DESC
      LIMIT 1
      `,
      [requesterUserId, siteId, feature]
    );

    if (r.rowCount === 0) {
      return res.json(null);
    }

    const row = r.rows[0];

    return res.json({
      id: row.id,
      requester_user_id: row.requester_user_id,
      site_id: row.site_id,
      feature: row.feature,
      status: row.status,
      requested_at: row.requested_at,
      decided_at: row.decided_at,
      decided_by_user_id: row.decided_by_user_id,
      reject_reason: row.reject_reason,
      revoked: row.status === "approved" && row.still_has_access !== true,
    });
  } catch (err) {
    console.error("GET MY EXCEL ACCESS REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.listRequests = async (req, res) => {
  try {
    const { role, site_id: mySiteId } = req.user;
    const status = (req.query.status || "pending").toString().trim();
    const q = (req.query.q || "").toString().trim();
    const feature = (req.query.feature || "").toString().toLowerCase().trim();

    const params = [status];
    let where = `WHERE r.status = $1`;
    let idx = 1;

    if (role === "admin") {
      idx++;
      params.push(mySiteId);
      where += ` AND r.site_id = $${idx}`;
    }

    if (feature) {
      if (!EXCEL_FEATURES.includes(feature)) {
        return res.status(400).json({ message: "Feature tidak valid" });
      }

      idx++;
      params.push(feature);
      where += ` AND LOWER(r.feature) = $${idx}`;
    }

    if (q) {
      idx++;
      params.push(`%${q.toLowerCase()}%`);
      where += `
        AND (
          LOWER(u.name) LIKE $${idx}
          OR LOWER(COALESCE(d.department_name, '')) LIKE $${idx}
          OR LOWER(COALESCE(s.site_name, '')) LIKE $${idx}
          OR LOWER(COALESCE(r.feature, '')) LIKE $${idx}
        )
      `;
    }

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.requester_user_id,
        r.site_id,
        r.feature,
        r.status,
        r.requested_at,
        r.decided_at,
        r.reject_reason,
        u.name AS requester_name,
        d.department_name,
        s.site_name,
        r.decided_by_user_id,
        decider.name AS decided_by_name,
        decider_role.role_name AS decided_by_role
      FROM excel_access_requests r
      JOIN users u ON u.id = r.requester_user_id
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN sites s ON s.id = r.site_id
      LEFT JOIN users decider ON decider.id = r.decided_by_user_id
      LEFT JOIN roles decider_role ON decider_role.id = decider.role_id
      ${where}
      ORDER BY r.requested_at DESC
      `,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("LIST EXCEL REQUESTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.approveRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  const actorId = req.user.id;
  const actorRole = req.user.role;
  const actorSiteId = req.user.site_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reqRes = await client.query(
      `
      SELECT id, requester_user_id, site_id, feature, status
FROM excel_access_requests
WHERE id = $1
FOR UPDATE
      `,
      [requestId]
    );

    if (reqRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Request tidak ditemukan" });
    }

    const r = reqRes.rows[0];

    if (actorRole === "admin" && Number(r.site_id) !== Number(actorSiteId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Admin hanya bisa approve site sendiri" });
    }

    if (r.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Request sudah diproses" });
    }

    // Grant akses (seen_by_admin: admin=true, superadmin=false)
    await grantExcelAccess(client, {
  userId: r.requester_user_id,
  siteId: r.site_id,
  feature: r.feature,
  grantedBy: actorId,
  seenByAdmin: actorRole === "admin",
});

    const upd = await client.query(
      `
      UPDATE excel_access_requests
      SET status = 'approved',
          decided_at = NOW(),
          decided_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [requestId, actorId]
    );

    await client.query("COMMIT");

 await sendExcelAccessDecisionNotification({
  requesterId: r.requester_user_id,
  siteId: r.site_id,
  requestId,
  approved: true,
  feature: r.feature,
  decidedByName: req.user.name,
  rejectReason: null,
});
    return res.json(upd.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("APPROVE EXCEL REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};

exports.rejectRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  const actorId = req.user.id;
  const actorRole = req.user.role;
  const actorSiteId = req.user.site_id;
  const rejectReason = (req.body?.reject_reason || "").toString().trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reqRes = await client.query(
      `
      SELECT id, requester_user_id, site_id, feature, status
FROM excel_access_requests
WHERE id = $1
FOR UPDATE
      `,
      [requestId]
    );

    if (reqRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Request tidak ditemukan" });
    }

    const r = reqRes.rows[0];

    if (actorRole === "admin" && Number(r.site_id) !== Number(actorSiteId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Admin hanya bisa reject site sendiri" });
    }

    if (r.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Request sudah diproses" });
    }

    const upd = await client.query(
      `
      UPDATE excel_access_requests
      SET status = 'rejected',
          decided_at = NOW(),
          decided_by_user_id = $2,
          reject_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [requestId, actorId, rejectReason || null]
    );

    await client.query("COMMIT");

    await sendExcelAccessDecisionNotification({
      requesterId: r.requester_user_id,
      siteId: r.site_id,
      requestId,
      approved: false,
      feature: r.feature,
      decidedByName: req.user.name,
      rejectReason: rejectReason || null,
    });

    return res.json(upd.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("REJECT EXCEL REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};