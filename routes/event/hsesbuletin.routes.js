const {
  sendBuletinNotification,
} = require("../../services/notification.services");

const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const ExcelJS = require("exceljs");
const pool = require("../../config/db");

const authMiddleware = require("../../middlewares/auth.middleware");
const allowRoles = require("../../middlewares/role.middleware");

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "uploads/"),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

function ensureExcelDownloadAccess(feature) {
  return async (req, res, next) => {
    try {
      const { id: userId, role, site_id: siteId } = req.user;

      if (role === "admin" || role === "superadmin") return next();

      const q = `
        SELECT 1
        FROM excel_download_access
        WHERE user_id = $1
          AND site_id = $2
          AND feature = $3
          AND can_download = true
          AND revoked_at IS NULL
        LIMIT 1
      `;

      const r = await pool.query(q, [userId, siteId, feature]);

      if (r.rowCount === 0) {
        return res.status(403).json({
          message: `No Excel access for ${feature}`,
        });
      }

      return next();
    } catch (err) {
      console.error("EXCEL ACCESS CHECK ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  };
}

router.post(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  upload.single("gambar"),
  async (req, res) => {
    try {
      const { judul, subJudul, deskripsi, is_for_all_sites } = req.body;
      const isForAllSites = is_for_all_sites === "1" || is_for_all_sites === true;

      // ======== Handle sites =========
      let sites = req.body.site_ids;

      if (typeof sites === "string") {
        try { sites = JSON.parse(sites); }
        catch { sites = [sites]; }
      }

      if (!Array.isArray(sites)) sites = sites ? [sites] : [];

      sites = sites.map(Number).filter((id) => !isNaN(id));

      if (req.user.role === "superadmin" && sites.length === 0 && !isForAllSites) {
        return res.status(400).json({ message: "Minimal 1 site harus dipilih" });
      }

      if (req.user.role === "admin") {
        sites = [req.user.site_id];
      }

      const siteId = sites.length > 0 ? sites[0] : req.user.site_id;
      const departmentId = req.user.department_id ?? 1;

      const buletin = await pool.query(
        `
        INSERT INTO hses_buletin
        (judul, sub_judul, deskripsi, gambar, created_by, department_id, site_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          judul,
          subJudul,
          deskripsi,
          req.file ? req.file.filename : null,
          req.user.id,
          departmentId,
          siteId,
        ]
      );

      const buletinId = buletin.rows[0].id;

      for (const sId of sites) {
        await pool.query(
          `INSERT INTO hses_buletin_sites (buletin_id, site_id) VALUES ($1,$2)`,
          [buletinId, sId]
        );
      }

      await sendBuletinNotification({
        creatorRole: req.user.role,
        siteIds: sites,
        creatorId: req.user.id,
        title: judul,
        buletinId,
      });

      return res.status(201).json({
        ...buletin.rows[0],
        is_for_all_sites: isForAllSites,
      });
    } catch (err) {
      console.error("CREATE BULETIN ERROR:", err);
      return res.status(500).json({ message: "Insert failed" });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id, id: user_id } = req.user;
    const params = [user_id];
    let siteCondition = "";

    if (role !== "superadmin") {
      params.push(site_id);
      siteCondition = `AND EXISTS (
        SELECT 1 FROM hses_buletin_sites bs2
        WHERE bs2.buletin_id = b.id AND bs2.site_id = $${params.length}
      )`;
    }

    const query = `
      SELECT
        b.id,
        b.judul,
        b.sub_judul,
        b.deskripsi,
        b.gambar,
        b.created_at,
        b.created_by,
        u.site_id AS created_by_site_id,
        r.role_name AS created_by_role,
        lr.rating,
        lr.comment,
        ARRAY_AGG(s.site_name) AS sites,
        ARRAY_AGG(bs.site_id) FILTER (WHERE bs.site_id IS NOT NULL) AS site_ids
      FROM hses_buletin b
      LEFT JOIN hses_buletin_sites bs ON bs.buletin_id = b.id
      LEFT JOIN sites s ON s.id = bs.site_id
      LEFT JOIN users u ON u.id = b.created_by
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN LATERAL (
        SELECT rating, comment
        FROM hses_buletin_reviews
        WHERE buletin_id = b.id
          AND user_id = $1
        LIMIT 1
      ) lr ON true
      WHERE b.deleted_at IS NULL
      ${siteCondition}
      GROUP BY b.id, u.id, r.id, lr.rating, lr.comment
      ORDER BY b.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET BULETIN ERROR:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
});

router.put("/:id", authMiddleware, allowRoles("admin", "superadmin"), upload.single("gambar"), async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, subJudul, deskripsi, site_ids } = req.body;

    let query = `
      UPDATE hses_buletin
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

    if (req.user.role === "admin") {
      query += `
        AND created_by = $${params.length + 1}
        AND EXISTS (
          SELECT 1 FROM hses_buletin_sites bs
          WHERE bs.buletin_id = hses_buletin.id
            AND bs.site_id = $${params.length + 2}
        )
      `;
      params.push(req.user.id);
      params.push(req.user.site_id);
    }

    query += " RETURNING *";
    const result = await pool.query(query, params);

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Data tidak ditemukan atau tidak punya akses" });

    if (site_ids) {
      let sites = Array.isArray(site_ids) ? site_ids.map(Number) : [Number(site_ids)];
      if (req.user.role === "admin") sites = [req.user.site_id];

      await pool.query(`DELETE FROM hses_buletin_sites WHERE buletin_id = $1`, [id]);
      for (const sId of sites) {
        await pool.query(
          `INSERT INTO hses_buletin_sites (buletin_id, site_id) VALUES ($1,$2)`,
          [id, sId]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE BULETIN ERROR:", err);
    res.status(500).json({ message: "Update failed" });
  }
});

router.delete("/:id", authMiddleware, allowRoles("admin", "superadmin"), async (req, res) => {
  try {
    const { id } = req.params;
    let query = `
      UPDATE hses_buletin
      SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
    `;
    const params = [id];

    if (req.user.role === "admin") {
      query += `
        AND created_by = $${params.length + 1}
        AND EXISTS (
          SELECT 1 FROM hses_buletin_sites bs
          WHERE bs.buletin_id = hses_buletin.id
            AND bs.site_id = $${params.length + 2}
        )
      `;
      params.push(req.user.id);
      params.push(req.user.site_id);
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0)
      return res.status(404).json({ message: "Data tidak ditemukan atau tidak punya akses" });

    res.json({ message: "Deleted (soft)" });
  } catch (err) {
    console.error("DELETE BULETIN ERROR:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

router.post("/:id/review", authMiddleware, allowRoles("member", "admin"), async (req, res) => {
  try {
    const buletinId = req.params.id;
    const { rating, comment } = req.body;

    const buletin = await pool.query(
      `
      SELECT b.id, r.role_name AS created_by_role
      FROM hses_buletin b
      JOIN users u ON u.id = b.created_by
      JOIN roles r ON r.id = u.role_id
      JOIN hses_buletin_sites bs ON bs.buletin_id = b.id
      WHERE b.id = $1
        AND bs.site_id = $2
        AND b.deleted_at IS NULL
      `,
      [buletinId, req.user.site_id]
    );

    if (buletin.rowCount === 0)
      return res.status(403).json({ message: "Anda tidak berhak mereview buletin ini" });

    const createdByRole = buletin.rows[0].created_by_role;
    if (req.user.role === "admin" && createdByRole !== "superadmin")
      return res.status(403).json({ message: "Admin hanya boleh mereview buletin dari superadmin" });

    const exist = await pool.query(
      `SELECT 1 FROM hses_buletin_reviews WHERE buletin_id = $1 AND user_id = $2`,
      [buletinId, req.user.id]
    );

    if (exist.rowCount > 0)
      return res.status(400).json({ message: "Anda sudah review" });

    await pool.query(
      `INSERT INTO hses_buletin_reviews (buletin_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)`,
      [buletinId, req.user.id, rating, comment]
    );

    res.json({ message: "Review berhasil" });
  } catch (err) {
    console.error("POST BULETIN REVIEW ERROR:", err);
    res.status(500).json({ message: "Review gagal" });
  }
});

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
        b.judul AS buletin_title,
        COALESCE(cr.role_name, '-') AS creator_role
      FROM hses_buletin_reviews r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN roles ur ON ur.id = u.role_id
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN sites s ON s.id = u.site_id
      JOIN hses_buletin b ON b.id = r.buletin_id
      JOIN users cu ON cu.id = b.created_by
      LEFT JOIN roles cr ON cr.id = cu.role_id
      WHERE b.deleted_at IS NULL
      ${role === "admin" ? `AND s.id = $1` : ""}
      ORDER BY r.created_at DESC
    `;

    const params = role === "admin" ? [site_id] : [];
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("FETCH BULETIN TABLE ERROR:", err);
    res.status(500).json({ message: "Failed to fetch review table" });
  }
});

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
      FROM hses_buletin_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.buletin_id = $1
      ORDER BY r.created_at DESC
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET BULETIN REVIEW ERROR:", err);
    res.status(500).json({ message: "Fetch review failed" });
  }
});

router.get("/:id/rating", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ROUND(AVG(rating)::numeric,1) AS avg_rating,
        COUNT(*) AS total_review
      FROM hses_buletin_reviews
      WHERE buletin_id = $1
      `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("GET BULETIN RATING ERROR:", err);
    res.status(500).json({ message: "Fetch rating failed" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  ensureExcelDownloadAccess("buletin"),
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

      const lastExport = await pool.query(
        `
        SELECT exported_at
        FROM export_logs
        WHERE user_id = $1 AND feature = $2
        ORDER BY exported_at DESC
        LIMIT 1
        `,
        [req.user.id, "buletin"]
      );

      if (lastExport.rowCount > 0) {
        const lastTime = new Date(lastExport.rows[0].exported_at);
        const now = new Date();
        const diffSeconds = (now - lastTime) / 1000;

        if (diffSeconds < 10) {
          return res.status(429).json({
            message: `Tunggu ${Math.ceil(10 - diffSeconds)} detik sebelum export lagi.`,
          });
        }
      }

      const { start, end } = req.query;

      const params = [];
      let where = `WHERE b.deleted_at IS NULL`;

      if (role === "admin") {
        params.push(site_id);
        where += ` AND s.id = $${params.length}`;
      }

      if (start) {
        params.push(start);
        where += ` AND r.created_at >= $${params.length}`;
      }

      if (end) {
        params.push(end);
        where += ` AND r.created_at < $${params.length}`;
      }

      const query = `
        SELECT
          r.id AS review_id,
          r.rating,
          r.comment,
          r.created_at,
          u.name AS user_name,
          COALESCE(ur.role_name, '-') AS user_role,
          COALESCE(d.department_name, '-') AS department_name,
          COALESCE(s.site_name, '-') AS site_name,
          b.judul AS buletin_title,
          COALESCE(cr.role_name, '-') AS creator_role
        FROM hses_buletin_reviews r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN roles ur ON ur.id = u.role_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN sites s ON s.id = u.site_id
        JOIN hses_buletin b ON b.id = r.buletin_id
        JOIN users cu ON cu.id = b.created_by
        LEFT JOIN roles cr ON cr.id = cu.role_id
        ${where}
        ORDER BY r.created_at DESC
      `;

      const result = await pool.query(query, params);

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      });

      const ws = workbook.addWorksheet("Buletin Export");
      ws.views = [{ state: "frozen", ySplit: 4 }];

      // ====== COLUMN ======
      ws.columns = [
        { width: 8 },
        { width: 28 },
        { width: 16 },
        { width: 22 },
        { width: 24 },
        { width: 40 },
        { width: 18 },
        { width: 14 },
        { width: 40 },
        { width: 20 },
      ];

      // ====== TITLE ======
      ws.mergeCells("A1:J1");
      const title = ws.getCell("A1");
      title.value = "LAPORAN EXPORT BULETIN";
      title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D63FF" } };
      title.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 28;

      // ====== HEADER ======
      const header = ws.addRow([
        "No",
        "Reviewer",
        "Role",
        "Site",
        "Department",
        "Buletin",
        "Creator Role",
        "Rating",
        "Komentar",
        "Tanggal",
      ]);

      header.height = 50;

      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });

      // ====== HELPER ======
      const roleStyle = (cell, role) => {
        const r = String(role).toLowerCase();

        if (r === "superadmin") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { bold: true, color: { argb: "FF166534" } };
        } else if (r === "admin") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          cell.font = { bold: true, color: { argb: "FF92400E" } };
        } else if (r === "member") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
          cell.font = { bold: true, color: { argb: "FF1D4ED8" } };
        }

        cell.alignment = { horizontal: "center", vertical: "middle" };
      };

      const ratingStyle = (cell, val) => {
        const r = Number(val);

        if (r >= 1 && r <= 2) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          cell.font = { bold: true, color: { argb: "FF991B1B" } };
        } else if (r >= 3) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          cell.font = { bold: true, color: { argb: "FF92400E" } };
        }

        cell.alignment = { horizontal: "center", vertical: "middle" };
      };

      // ====== DATA ======
      result.rows.forEach((row, i) => {
        const r = ws.addRow([
          i + 1,
          row.user_name,
          row.user_role,
          row.site_name,
          row.department_name,
          row.buletin_title,
          row.creator_role,
          row.rating,
          row.comment,
          new Date(row.created_at).toLocaleDateString("id-ID"),
        ]);

        r.height = 35;

        if (i % 2 === 0) {
          r.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          });
        }

        roleStyle(r.getCell(3), row.user_role);
        roleStyle(r.getCell(7), row.creator_role);
        ratingStyle(r.getCell(8), row.rating);

        r.commit();
      });

      ws.commit();
      await workbook.commit();

      await pool.query(
        `INSERT INTO export_logs (user_id, site_id, feature) VALUES ($1,$2,$3)`,
        [req.user.id, req.user.site_id, "buletin"]
      );
    } catch (err) {
      console.error("EXPORT BULETIN ERROR:", err);
      res.status(500).json({ message: "Export gagal" });
    }
  }
);

module.exports = router;
