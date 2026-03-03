const express = require("express");
const ExcelJS = require("exceljs");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");

// === MULTER ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

async function ensureExcelDownloadAccess(req, res, next) {
  try {
    const { id: userId, role, site_id: siteId } = req.user;

    // admin/superadmin selalu boleh
    if (role === "admin" || role === "superadmin") return next();

    // member harus punya akses dari tabel excel_download_access
    const q = `
      SELECT 1
      FROM excel_download_access
      WHERE user_id = $1
        AND site_id = $2
        AND can_download = true
        AND revoked_at IS NULL
      LIMIT 1
    `;
    const r = await pool.query(q, [userId, siteId]);

    if (r.rowCount === 0) {
      return res.status(403).json({ message: "No Excel access" });
    }

    return next();
  } catch (err) {
    console.error("EXCEL ACCESS CHECK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "foto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {  
        nama,
        perusahaan,
        department,
        nama_pembicara,
        topik,
        jabatan,
        kondisi_kesehatan,
        jam_tidur,
        siap_kerja,
        status_hari_kerja,
        umpan_balik,
      } = req.body;

      // 🔐 AMBIL DARI TOKEN
      const site_id = req.user.site_id;
      const foto_path = req.files?.foto?.[0]?.filename || null;

      await pool.query(
        `
        INSERT INTO p5m (
          nama, perusahaan, department, nama_pembicara, topik,
          jabatan, kondisi_kesehatan, jam_tidur, siap_kerja,
          status_hari_kerja, umpan_balik, foto_path, site_id
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,
          $10,$11,$12,
          $13
        )
        `,
        [
          nama,
          perusahaan,
          department,
          nama_pembicara,
          topik,
          jabatan,
          kondisi_kesehatan,
          jam_tidur,
          siap_kerja,
          status_hari_kerja,
          umpan_balik,
          foto_path,
          site_id,
        ]
      );

      res.status(200).json({ message: "P5M berhasil disimpan" });
    } catch (err) {
      console.error("P5M POST ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT
        id,
        nama,
        perusahaan,
        department,
        nama_pembicara, topik,
        jabatan, kondisi_kesehatan, jam_tidur, siap_kerja,
        status_hari_kerja, umpan_balik,
        foto_path,
        created_at,
        site_id
      FROM p5m
    `;

    const params = [];

    // 🔐 ADMIN → FILTER SITE
    if (role === "admin") {
      query += " WHERE site_id = $1";
      params.push(site_id);
    }

    // SUPERADMIN → NO FILTER

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("LPI GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  ensureExcelDownloadAccess,
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

const lastExport = await pool.query(
  `
  SELECT exported_at
  FROM export_logs
  WHERE user_id = $1
  ORDER BY exported_at DESC
  LIMIT 1
  `,
  [req.user.id]
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

      let query = `
        SELECT
          id,
          nama,
          perusahaan,
          department,
          nama_pembicara,
          topik,
          jabatan,
          kondisi_kesehatan,
          jam_tidur,
          siap_kerja,
          status_hari_kerja,
          umpan_balik,
          foto_path,
          created_at,
          site_id
        FROM p5m
      `;

      const params = [];
      const where = [];

      // 🔐 admin filter site
      if (role === "admin") {
        where.push(`site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      // 🔎 filter tanggal (start inclusive, end exclusive)
      if (start) {
        where.push(`created_at >= $${params.length + 1}`);
        params.push(start);
      }
      if (end) {
        where.push(`created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) query += " WHERE " + where.join(" AND ");
      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);

const MAX_EXPORT_ROWS = 50000;

if (result.rows.length > MAX_EXPORT_ROWS) {
  return res.status(400).json({
    message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
  });
}

      const fileName = `P5M_${Date.now()}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );

const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
  stream: res,
  useStyles: true,
  useSharedStrings: true,
});

const worksheet = workbook.addWorksheet("P5M");

// WATERMARK
worksheet.mergeCells("A1:O1");
worksheet.getCell("A1").value =
  `Site: ${req.user.site_id} | Generated By: ${req.user.id} | ${new Date().toLocaleString()}`;
worksheet.getCell("A1").font = { bold: true, size: 12 };
worksheet.getCell("A1").alignment = { horizontal: "center" };

worksheet.addRow([]);

worksheet.columns = [
  { header: "No", key: "no", width: 6 },
  { header: "Nama", key: "nama", width: 20 },
  { header: "Perusahaan", key: "perusahaan", width: 20 },
  { header: "Department", key: "department", width: 20 },
  { header: "Nama Pembicara", key: "nama_pembicara", width: 20 },
  { header: "Topik", key: "topik", width: 25 },
  { header: "Jabatan", key: "jabatan", width: 18 },
  { header: "Kondisi Kesehatan", key: "kondisi_kesehatan", width: 20 },
  { header: "Jam Tidur", key: "jam_tidur", width: 12 },
  { header: "Siap Kerja", key: "siap_kerja", width: 14 },
  { header: "Status Hari Kerja", key: "status_hari_kerja", width: 18 },
  { header: "Umpan Balik", key: "umpan_balik", width: 30 },
  { header: "Tanggal", key: "created_at", width: 18 },
  { header: "Site", key: "site_id", width: 10 },
  { header: "Foto", key: "foto_path", width: 24 },
];

const headerRow = worksheet.getRow(3);
headerRow.font = { bold: true };
headerRow.alignment = { horizontal: "center" };
headerRow.commit();

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];
        const r = worksheet.addRow({
          no: i + 1,
          nama: row.nama,
          perusahaan: row.perusahaan,
          department: row.department,
          nama_pembicara: row.nama_pembicara,
          topik: row.topik,
          jabatan: row.jabatan,
          kondisi_kesehatan: row.kondisi_kesehatan,
          jam_tidur: row.jam_tidur,
          siap_kerja: row.siap_kerja,
          status_hari_kerja: row.status_hari_kerja,
          umpan_balik: row.umpan_balik,
          created_at: row.created_at,
          site_id: row.site_id,
          foto_path: row.foto_path,
        });

        r.commit(); 
      }

      worksheet.commit();

const summary = workbook.addWorksheet("Summary");

summary.addRow(["Total Data", result.rows.length]).commit();
summary.addRow(["Generated By", req.user.id]).commit();
summary.addRow(["Role", req.user.role]).commit();
summary.addRow(["Site", req.user.site_id]).commit();
summary.addRow(["Generated At", new Date()]).commit();

summary.commit();

await pool.query(
  `INSERT INTO export_logs (user_id, site_id)
   VALUES ($1, $2)`,
  [req.user.id, req.user.site_id]
);

      await workbook.commit();

    } catch (err) {
      console.error("EXPORT XLSX ERROR:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      } else {
        res.end();
      }
    }
  }
);

module.exports = router;
