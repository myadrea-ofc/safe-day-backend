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
            message: `Tunggu ${Math.ceil(
              10 - diffSeconds
            )} detik sebelum export lagi.`,
          });
        }
      }

      const { start, end } = req.query;

      let query = `
  SELECT
    p.id,
    p.nama,
    p.perusahaan,
    p.department,
    p.nama_pembicara,
    p.topik,
    p.jabatan,
    p.kondisi_kesehatan,
    p.jam_tidur,
    p.siap_kerja,
    p.status_hari_kerja,
    p.umpan_balik,
    p.foto_path,
    p.created_at,
    p.site_id,
    s.site_name
  FROM p5m p
  LEFT JOIN sites s ON s.id = p.site_id
`;

      const params = [];
      const where = [];

      // admin hanya site sendiri
      if (role === "admin") {
        where.push(`p.site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      // filter tanggal
      if (start) {
        where.push(`p.created_at >= $${params.length + 1}`);
        params.push(start);
      }

      if (end) {
        where.push(`p.created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) query += ` WHERE ${where.join(" AND ")}`;
      query += ` ORDER BY p.created_at DESC`;

      const result = await pool.query(query, params);

const publicBaseUrl =
  process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ||
  "http://safety.borneo.co.id";

const MAX_EXPORT_ROWS = 50000;
if (result.rows.length > MAX_EXPORT_ROWS) {
  return res.status(400).json({
    message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
  });
}

const now = new Date();
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

      const worksheet = workbook.addWorksheet("P5M Export");

      // Freeze header row
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

      // Lebar kolom
      worksheet.columns = [
        { key: "no", width: 8 },
        { key: "nama", width: 24 },
        { key: "perusahaan", width: 24 },
        { key: "department", width: 20 },
        { key: "nama_pembicara", width: 24 },
        { key: "topik", width: 28 },
        { key: "jabatan", width: 18 },
        { key: "kondisi_kesehatan", width: 20 },
        { key: "jam_tidur", width: 14 },
        { key: "siap_kerja", width: 14 },
        { key: "status_hari_kerja", width: 18 },
        { key: "umpan_balik", width: 30 },
        { key: "created_at", width: 22 },
        { key: "site_id", width: 10 },
        { key: "foto_path", width: 80 },
      ];

      // ===== TITLE ROW =====
      worksheet.mergeCells("A1:O1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "LAPORAN EXPORT P5M";
      titleCell.font = {
        bold: true,
        size: 16,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D63FF" },
      };

      // ===== INFO ROW =====
      worksheet.mergeCells("A2:O2");
      const infoCell = worksheet.getCell("A2");
      let currentUserSiteName = "-";

if (req.user.site_id) {
  const siteRes = await pool.query(
    `SELECT site_name FROM sites WHERE id = $1 LIMIT 1`,
    [req.user.site_id]
  );

  if (siteRes.rowCount > 0) {
    currentUserSiteName = siteRes.rows[0].site_name;
  }
}
infoCell.value =
  `Generated By: ${req.user.name || req.user.id} | Role: ${req.user.role} | Site: ${currentUserSiteName} | Generated At: ${now.toLocaleString("id-ID")}`;
      infoCell.font = {
        italic: true,
        size: 11,
        color: { argb: "FF374151" },
      };
      infoCell.alignment = {
        horizontal: "left",
        vertical: "middle",
      };
      infoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      // spacer
      worksheet.addRow([]).commit();

      // ===== HEADER ROW =====
      const headerRow = worksheet.addRow([
        "No",
        "Nama",
        "Perusahaan",
        "Department",
        "Nama Pembicara",
        "Topik",
        "Jabatan",
        "Kondisi Kesehatan",
        "Jam Tidur",
        "Siap Kerja",
        "Status Hari Kerja",
        "Umpan Balik",
        "Tanggal Dibuat",
        "Site",
        "Foto",
      ]);

      headerRow.height = 22;

      headerRow.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 11,
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
      headerRow.commit();

      // ===== DATA ROWS =====
      for (let i = 0; i < result.rows.length; i++) {
  const row = result.rows[i];

  const fotoUrl = row.foto_path
    ? `${publicBaseUrl}/uploads/${encodeURIComponent(row.foto_path)}`
    : null;

  const excelRow = worksheet.addRow([
    i + 1,
    row.nama ?? "-",
    row.perusahaan ?? "-",
    row.department ?? "-",
    row.nama_pembicara ?? "-",
    row.topik ?? "-",
    row.jabatan ?? "-",
    row.kondisi_kesehatan ?? "-",
    row.jam_tidur ?? "-",
    row.siap_kerja ?? "-",
    row.status_hari_kerja ?? "-",
    row.umpan_balik ?? "-",
    row.created_at
      ? new Date(row.created_at).toLocaleString("id-ID")
      : "-",
  row.site_name ?? "-",
    fotoUrl ?? "-",
  ]);

  excelRow.eachCell((cell, colNumber) => {
    cell.alignment = {
      vertical: "top",
      horizontal:
        colNumber === 1 || colNumber === 9 || colNumber === 10 || colNumber === 11
          ? "center"
          : "left",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };

    cell.font = {
      size: 10,
      color: { argb: "FF111827" },
    };
  });

  // zebra row
  if (i % 2 === 0) {
    excelRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
      };
    });
  }

  // conditional color: Siap Kerja (kolom J = 10)
  const siapKerjaCell = excelRow.getCell(10);
  const siapKerjaValue = (row.siap_kerja || "").toString().toLowerCase().trim();

  if (siapKerjaValue === "iya" || siapKerjaValue === "ya") {
    siapKerjaCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    siapKerjaCell.font = {
      bold: true,
      color: { argb: "FF166534" },
      size: 10,
    };
    siapKerjaCell.alignment = { horizontal: "center", vertical: "middle" };
  } else if (siapKerjaValue === "tidak") {
    siapKerjaCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };
    siapKerjaCell.font = {
      bold: true,
      color: { argb: "FF991B1B" },
      size: 10,
    };
    siapKerjaCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // conditional color: Status Hari Kerja (kolom K = 11)
  // conditional color: Status Hari Kerja (kolom K = 11)
const statusHariKerjaCell = excelRow.getCell(11);
const statusHariKerjaValue = (row.status_hari_kerja || "")
  .toString()
  .toLowerCase()
  .trim();

// cek kondisi negatif dulu supaya "tidak aman" tidak terbaca sebagai "aman"
if (
  statusHariKerjaValue.includes("tidak aman") ||
  statusHariKerjaValue.includes("buruk") ||
  statusHariKerjaValue.includes("kurang") ||
  statusHariKerjaValue.includes("tidak fit") ||
  statusHariKerjaValue.includes("bahaya")
) {
  statusHariKerjaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEE2E2" }, // merah muda
  };
  statusHariKerjaCell.font = {
    bold: true,
    color: { argb: "FF991B1B" }, // merah gelap
    size: 10,
  };
  statusHariKerjaCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
} else if (
  statusHariKerjaValue === "aman" ||
  statusHariKerjaValue.includes("baik") ||
  statusHariKerjaValue.includes("fit")
) {
  statusHariKerjaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCFCE7" }, // hijau muda
  };
  statusHariKerjaCell.font = {
    bold: true,
    color: { argb: "FF166534" }, // hijau gelap
    size: 10,
  };
  statusHariKerjaCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}
  excelRow.commit();
}

      worksheet.commit();

      // log export
      await pool.query(
        `
        INSERT INTO export_logs (user_id, site_id)
        VALUES ($1, $2)
        `,
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
