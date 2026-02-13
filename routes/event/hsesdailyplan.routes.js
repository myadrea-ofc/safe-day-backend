const {
  getTargetUsers,
  sendDailyPlanNotification,
} = require("../../services/notification.services");

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const pool = require("../../config/db");

const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

/* ===================== MULTER ===================== */
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

router.post(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  upload.single("gambar"),
  async (req, res) => {
    try {
      const { judul, subJudul, deskripsi } = req.body;

      let sites = req.body.site_ids;

      if (typeof sites === "string") {
        try {
          sites = JSON.parse(sites);
        } catch {
          sites = [sites];
        }
      }

      if (!Array.isArray(sites)) {
        sites = sites ? [sites] : [];
      }

      sites = sites
        .map(Number)
        .filter((id) => !isNaN(id));

      if (req.user.role === "superadmin" && sites.length === 0) {
        return res.status(400).json({ message: "Minimal 1 site harus dipilih" });
      }

      if (req.user.role === "admin") {
        sites = [req.user.site_id];
      }

      console.log("===== DEBUG DAILY PLAN CREATE =====");
      console.log("CREATOR ID:", req.user.id);
      console.log("CREATOR ROLE:", req.user.role);
      console.log("CREATOR SITE:", req.user.site_id);
      console.log("FINAL TARGET SITES:", sites);

      const plan = await pool.query(
        `
        INSERT INTO hses_daily_plan
        (judul, sub_judul, deskripsi, gambar, created_by)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [judul, subJudul, deskripsi, req.file ? req.file.filename : null, req.user.id]
      );

      const planId = plan.rows[0].id;

      for (const siteId of sites) {
        await pool.query(
          `
          INSERT INTO hses_daily_plan_sites (daily_plan_id, site_id)
          VALUES ($1,$2)
          `,
          [planId, siteId]
        );
      }

      await sendDailyPlanNotification({
        creatorRole: req.user.role,
        siteIds: sites,
        creatorId: req.user.id,
        title: judul,
        planId,
      });

      return res.status(201).json(plan.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Insert failed" });
    }
  }
);


router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id, id: user_id } = req.user;

    // parameter untuk LATERAL join rating/comment user
    const params = [user_id]; 
    let siteCondition = "";

    // jika bukan superadmin, filter sesuai site
    if (role !== "superadmin") {
      params.push(site_id);
      siteCondition = "AND ps.site_id = $" + params.length;
    }

    const query = `
      SELECT
  p.id,
  p.judul,
  p.sub_judul,
  p.deskripsi,
  p.gambar,
  p.created_at,
  p.created_by,
  u.site_id AS created_by_site_id,
  r.role_name AS created_by_role,
  lr.rating,
  lr.comment,
  ARRAY_AGG(ps.site_id) AS site_ids
FROM hses_daily_plan p
LEFT JOIN hses_daily_plan_sites ps
  ON ps.daily_plan_id = p.id
LEFT JOIN users u
  ON u.id = p.created_by
LEFT JOIN roles r
  ON r.id = u.role_id
LEFT JOIN LATERAL (
  SELECT rating, comment
  FROM hses_daily_plan_reviews
  WHERE daily_plan_id = p.id
    AND user_id = $1
  LIMIT 1
) lr ON true
WHERE p.deleted_at IS NULL
${siteCondition}
GROUP BY p.id, u.id, r.id, lr.rating, lr.comment
ORDER BY p.created_at DESC

    `;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (err) {
    console.error("GET DAILY PLAN ERROR:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
});

router.put(
  "/:id",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  upload.single("gambar"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { judul, subJudul, deskripsi, site_ids } = req.body;

        let sites = req.body.site_ids;

        // HANDLE FORMAT JSON STRING
        if (typeof sites === "string") {
          try {
            sites = JSON.parse(sites);
          } catch (err) {
            sites = [sites];
          }
        }

        // HANDLE FORMAT ARRAY / SINGLE VALUE
        if (!Array.isArray(sites)) {
          sites = sites ? [sites] : [];
        }

        sites = sites.map(Number);

      // admin hanya boleh 1 site
      if (req.user.role === "admin") {
        sites = [req.user.site_id];
      }

      if (sites.length === 0) {
        return res.status(400).json({
          message: "Minimal 1 site harus dipilih",
        });
      }

      /* ================== UPDATE DAILY PLAN ================== */
      let query = `
        UPDATE hses_daily_plan
        SET
          judul = $1,
          sub_judul = $2,
          deskripsi = $3
          ${req.file ? ", gambar = $4" : ""}
        WHERE id = $${req.file ? 5 : 4}
          AND deleted_at IS NULL
      `;

      const params = req.file
        ? [judul, subJudul, deskripsi, req.file.filename, id]
        : [judul, subJudul, deskripsi, id];

      // admin hanya boleh update miliknya
      if (req.user.role === "admin") {
        query += ` AND created_by = $${params.length + 1}`;
        params.push(req.user.id);
      }

      query += " RETURNING *";

      const result = await pool.query(query, params);

      if (result.rowCount === 0) {
        return res.status(404).json({
          message: "Data tidak ditemukan atau tidak punya akses",
        });
      }

      /* ================== UPDATE RELASI SITE ================== */
      // hapus relasi lama
      await pool.query(
        `DELETE FROM hses_daily_plan_sites WHERE daily_plan_id = $1`,
        [id]
      );

      // insert relasi baru
      for (const siteId of sites) {
        await pool.query(
          `
          INSERT INTO hses_daily_plan_sites (daily_plan_id, site_id)
          VALUES ($1,$2)
          `,
          [id, siteId]
        );
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPDATE DAILY PLAN ERROR:", err);
      res.status(500).json({ message: "Update failed" });
    }
  }
);

// DELETE (SOFT)
router.delete("/:id", authMiddleware, allowRoles("admin", "superadmin"), async (req, res) => {
  try {
    const { id } = req.params;

    let query = `
      UPDATE hses_daily_plan
      SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
    `;
    const params = [id];

    if (req.user.role === "admin") {
      // Admin hanya bisa delete plan mereka sendiri
      query += ` AND created_by = $2`;
      params.push(req.user.id);
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Data tidak ditemukan atau tidak punya akses" });
    }

    res.json({ message: "Deleted (soft)" });
  } catch (err) {
    console.error("DELETE DAILY PLAN ERROR:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

/* REVIEW (RATING & COMMENT) */

// POST REVIEW (MEMBER)
router.post(
  "/:id/review",
  authMiddleware,
  allowRoles("member", "admin"),
  async (req, res) => {
    try {
      const dailyPlanId = req.params.id;
      const { rating, comment } = req.body;

      // 1. CEK SITE
      const plan = await pool.query(
        `
        SELECT
          p.id,
          r.role_name AS created_by_role
        FROM hses_daily_plan p
        JOIN users u ON u.id = p.created_by
        JOIN roles r ON r.id = u.role_id
        JOIN hses_daily_plan_sites ps ON ps.daily_plan_id = p.id
        WHERE p.id = $1
          AND ps.site_id = $2
          AND p.deleted_at IS NULL
        `,
        [dailyPlanId, req.user.site_id]
      );

      if (plan.rowCount === 0) {
        return res.status(403).json({
          message: "Anda tidak berhak mereview daily plan ini",
        });
      }

      const createdByRole = plan.rows[0].created_by_role;

      // 2. VALIDASI ADMIN
      if (req.user.role === "admin" && createdByRole !== "superadmin") {
        return res.status(403).json({
          message: "Admin hanya boleh mereview daily plan dari superadmin",
        });
      }

      // 3. CEK SUDAH REVIEW
      const exist = await pool.query(
        `
        SELECT 1 FROM hses_daily_plan_reviews
        WHERE daily_plan_id = $1 AND user_id = $2
        `,
        [dailyPlanId, req.user.id]
      );

      if (exist.rowCount > 0) {
        return res.status(400).json({ message: "Anda sudah review" });
      }

      // 4. INSERT REVIEW
      await pool.query(
        `
        INSERT INTO hses_daily_plan_reviews
        (daily_plan_id, user_id, rating, comment)
        VALUES ($1,$2,$3,$4)
        `,
        [dailyPlanId, req.user.id, rating, comment]
      );

      res.json({ message: "Review berhasil" });
    } catch (err) {
      console.error("POST REVIEW ERROR:", err);
      res.status(500).json({ message: "Review gagal" });
    }
  }
);

/* TABEL KOMENTAR & RATING (ADMIN / SUPERADMIN) */
router.get("/table", authMiddleware, allowRoles("admin", "superadmin"), async (req, res) => {
  try {
    const { role, site_id } = req.user;

    const sql = `
      SELECT
  r.id AS review_id,
  r.rating,
  r.comment,
  r.created_at,

  u.name AS user_name,
  COALESCE(ur.role_name, '-') AS user_role,
  COALESCE(d.department_name, '-') AS department_name,
  COALESCE(s.site_name, '-') AS site_name,

  p.judul AS daily_plan_title,
  COALESCE(cr.role_name, '-') AS creator_role

FROM hses_daily_plan_reviews r
JOIN users u ON u.id = r.user_id
LEFT JOIN roles ur ON ur.id = u.role_id
LEFT JOIN departments d ON d.id = u.department_id
LEFT JOIN sites s ON s.id = u.site_id

JOIN hses_daily_plan p ON p.id = r.daily_plan_id
JOIN users cu ON cu.id = p.created_by
LEFT JOIN roles cr ON cr.id = cu.role_id

WHERE p.deleted_at IS NULL
${role === "admin" ? `AND s.id = $1` : ""}
ORDER BY r.created_at DESC;

    `;

    const params = role === "admin" ? [site_id] : [];

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH REVIEW TABLE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch review table" });
  }
});

/*  GET REVIEW PER DAILY PLAN (DETAIL PAGE) */
router.get("/:id/review", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS user_name
      FROM hses_daily_plan_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.daily_plan_id = $1
      ORDER BY r.created_at DESC
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET REVIEW ERROR:", err);
    res.status(500).json({ message: "Fetch review failed" });
  }
});

/*  GET RATING SUMMARY (CARD / DETAIL) */
router.get("/:id/rating", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ROUND(AVG(rating)::numeric,1) AS avg_rating,
        COUNT(*) AS total_review
      FROM hses_daily_plan_reviews
      WHERE daily_plan_id = $1
      `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET RATING ERROR:", err);
    res.status(500).json({ message: "Fetch rating failed" });
  }
});

module.exports = router;
