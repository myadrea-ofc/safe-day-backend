const { sendHazardNotification } = require("../services/notification.services");

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const ExcelJS = require("exceljs");

// === MULTER ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

function ensureExcelDownloadAccess(feature) {
  return async (req, res, next) => {
    try {
      const { id: userId, role, site_id: siteId } = req.user;

      // admin/superadmin selalu boleh
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
  upload.fields([
    { name: "foto1" },
    { name: "foto2" },
    { name: "foto3" },
  ]),
  async (req, res) => {
    try {
      console.log("Body:", req.body);
      console.log("User Site ID:", req.user.site_id);

      const {
        nama, id_karyawan, perusahaan, jabatan, department,
        lokasi_temuan, tanggal, waktu, jenis_temuan,
        narasi_temuan, info_perbaikan, status_sesuai,
      } = req.body;

      // Ambil site_id dari token JWT melalui middleware
      const site_id = parseInt(req.user.site_id);

      // Ambil nama file foto jika ada
      const foto1 = req.files?.foto1?.[0]?.filename || null;
      const foto2 = req.files?.foto2?.[0]?.filename || null;
      const foto3 = req.files?.foto3?.[0]?.filename || null;

      const query = `
        INSERT INTO hazard (
          nama,           -- $1
          id_karyawan,    -- $2
          perusahaan,     -- $3
          jabatan,        -- $4
          department,     -- $5
          lokasi_temuan,  -- $6
          tanggal,        -- $7
          waktu,          -- $8
          jenis_temuan,   -- $9
          narasi_temuan,  -- $10
          foto1_path,     -- $11
          foto2_path,     -- $12
          foto3_path,     -- $13
          info_perbaikan, -- $14
          status_sesuai,  -- $15
          site_id         -- $16
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16
        ) RETURNING id
      `;

      const values = [
        nama || null,
        id_karyawan || null,
        perusahaan || null,
        jabatan || null,
        department || null,
        lokasi_temuan || null,
        tanggal || null,
        waktu || null,
        jenis_temuan || null,
        narasi_temuan || null,
        foto1,
        foto2,
        foto3,
        info_perbaikan || null,
        status_sesuai || null,
        site_id
      ];

      const result = await pool.query(query, values);
      const hazardId = result.rows?.[0]?.id;

      // notif tidak boleh menggagalkan submit
      if (hazardId) {
        try {
          const senderName =
            req.user.name || req.user.full_name || req.user.username || nama || "User";

          await sendHazardNotification({
            creatorId: req.user.id,
            siteId: site_id,
            senderName,
            hazardId,
          });
        } catch (notifErr) {
          console.error("⚠️ HAZARD notif error (ignored):", notifErr);
        }
      } else {
        console.error("❌ HAZARD inserted but hazardId is null");
      }

      res.status(201).json({
        success: true,
        message: "Data Hazard berhasil disimpan",
        id: result.rows[0].id,
      });

    } catch (error) {
      console.error("HAZARD PG ERROR:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT
        id, nama, id_karyawan, perusahaan, jabatan, department,
          lokasi_temuan, tanggal, waktu, jenis_temuan, narasi_temuan,
          foto1_path, foto2_path, foto3_path, info_perbaikan, site_id, status_sesuai,
          created_at
      FROM hazard
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
  ensureExcelDownloadAccess("hazard"),
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

      // ===== EXPORT THROTTLE =====
      const lastExport = await pool.query(
        `
        SELECT exported_at
        FROM export_logs
        WHERE user_id = $1 AND feature = $2
        ORDER BY exported_at DESC
        LIMIT 1
        `,
        [req.user.id, "hazard"]
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

      // ===== QUERY DATA =====
      let query = `
        SELECT
          h.id,
          h.nama,
          h.id_karyawan,
          h.perusahaan,
          h.jabatan,
          h.department,
          h.lokasi_temuan,
          h.tanggal,
          h.waktu,
          h.jenis_temuan,
          h.narasi_temuan,
          h.foto1_path,
          h.foto2_path,
          h.foto3_path,
          h.info_perbaikan,
          h.status_sesuai,
          h.created_at,
          h.site_id,
          s.site_name
        FROM hazard h
        LEFT JOIN sites s ON s.id = h.site_id
      `;

      const params = [];
      const where = [];

      if (role === "admin") {
        where.push(`h.site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      if (start) {
        where.push(`h.created_at >= $${params.length + 1}`);
        params.push(start);
      }

      if (end) {
        where.push(`h.created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      query += ` ORDER BY h.created_at DESC`;

      const result = await pool.query(query, params);

      const MAX_EXPORT_ROWS = 50000;
      if (result.rows.length > MAX_EXPORT_ROWS) {
        return res.status(400).json({
          message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
        });
      }

      // ===== FILE RESPONSE =====
      const now = new Date();
      const fileName = `Hazard_${Date.now()}.xlsx`;

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

      const worksheet = workbook.addWorksheet("Hazard Export");
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

      // ===== FORMAT HELPERS =====
      function formatDateOnly(value) {
        if (!value) return "-";

        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);

        return d.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
        });
      }

      function formatTimeOnly(value) {
        if (!value) return "-";

        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return "-";

          if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed;

          const d = new Date(trimmed);
          if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
          }

          return trimmed;
        }

        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);

        return d.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      }

      function formatDateTime(value) {
        if (!value) return "-";

        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);

        return d.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      }

      function buildUploadUrl(filePath) {
        if (!filePath) return null;
        return `http://safety.borneo.co.id/uploads/${encodeURIComponent(
          filePath
        )}`;
      }

      // ===== COLUMNS =====
      worksheet.columns = [
        { key: "no", width: 8 },
        { key: "nama", width: 22 },
        { key: "id_karyawan", width: 18 },
        { key: "perusahaan", width: 24 },
        { key: "jabatan", width: 20 },
        { key: "department", width: 20 },
        { key: "lokasi_temuan", width: 24 },
        { key: "tanggal", width: 16 },
        { key: "waktu", width: 14 },
        { key: "jenis_temuan", width: 24 },
        { key: "narasi_temuan", width: 40 },
        { key: "info_perbaikan", width: 32 },
        { key: "status_sesuai", width: 18 },
        { key: "created_at", width: 22 },
        { key: "site_name", width: 18 },
        { key: "foto_1", width: 18 },
        { key: "foto_2", width: 18 },
        { key: "foto_3", width: 18 },
      ];

      // ===== TITLE ROW =====
      worksheet.mergeCells("A1:R1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "LAPORAN EXPORT HAZARD";
      titleCell.font = {
        bold: true,
        size: 16,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D63FF" },
      };
      worksheet.getRow(1).height = 28;

      // ===== INFO ROW =====
      worksheet.mergeCells("A2:R2");
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

      const generatedAtText = now.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      infoCell.value = `Generated By: ${req.user.name || req.user.id} | Role: ${
        req.user.role
      } | Site: ${currentUserSiteName} | Generated At: ${generatedAtText}`;
      infoCell.font = {
        italic: true,
        size: 11,
        color: { argb: "FF374151" },
      };
      infoCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      infoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      worksheet.getRow(2).height = 22;

      worksheet.addRow([]).commit();

      // ===== HEADER ROW =====
      const headerRow = worksheet.addRow([
        "No",
        "Nama",
        "ID Karyawan",
        "Perusahaan",
        "Jabatan",
        "Department",
        "Lokasi Temuan",
        "Tanggal",
        "Waktu",
        "Jenis Temuan",
        "Narasi Temuan",
        "Info Tindak Lanjut Perbaikan",
        "Status Sesuai",
        "Tanggal Dibuat",
        "Site",
        "Foto 1",
        "Foto 2",
        "Foto 3",
      ]);

      headerRow.height = 24;

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

        const fotoList = [row.foto1_path, row.foto2_path, row.foto3_path];

        const excelRow = worksheet.addRow([
          i + 1,
          row.nama ?? "-",
          row.id_karyawan ?? "-",
          row.perusahaan ?? "-",
          row.jabatan ?? "-",
          row.department ?? "-",
          row.lokasi_temuan ?? "-",
          formatDateOnly(row.tanggal),
          formatTimeOnly(row.waktu),
          row.jenis_temuan ?? "-",
          row.narasi_temuan ?? "-",
          row.info_perbaikan ?? "-",
          row.status_sesuai ?? "-",
          formatDateTime(row.created_at),
          row.site_name ?? "-",
          "",
          "",
          "",
        ]);

        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "top",
            horizontal:
              colNumber === 1 ||
              colNumber === 8 ||
              colNumber === 9 ||
              colNumber === 13 ||
              colNumber === 14
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

        excelRow.height = 22;

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

        // hyperlink foto 1..3
        for (let j = 0; j < 3; j++) {
          const fotoPath = fotoList[j];
          const fotoCell = excelRow.getCell(16 + j);
          const fotoUrl = buildUploadUrl(fotoPath);

          if (fotoUrl) {
            fotoCell.value = {
              text: `Lihat Foto ${j + 1}`,
              hyperlink: fotoUrl,
              tooltip: `Buka foto ${j + 1}`,
            };
            fotoCell.font = {
              color: { argb: "FF2563EB" },
              underline: true,
              size: 10,
            };
            fotoCell.alignment = {
              vertical: "middle",
              horizontal: "center",
            };
          } else {
            fotoCell.value = "-";
            fotoCell.alignment = {
              vertical: "middle",
              horizontal: "center",
            };
          }
        }

        // conditional color: Status Sesuai
        const statusCell = excelRow.getCell(13);
        const statusValue = (row.status_sesuai || "")
          .toString()
          .toLowerCase()
          .trim();

        if (
          statusValue.includes("tidak") ||
          statusValue.includes("unsafe") ||
          statusValue.includes("bahaya") ||
          statusValue.includes("rusak")
        ) {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          statusCell.font = {
            bold: true,
            color: { argb: "FF991B1B" },
            size: 10,
          };
          statusCell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        } else if (
          statusValue.includes("sesuai") ||
          statusValue.includes("aman") ||
          statusValue.includes("baik") ||
          statusValue.includes("ok")
        ) {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          };
          statusCell.font = {
            bold: true,
            color: { argb: "FF166534" },
            size: 10,
          };
          statusCell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        }

        excelRow.commit();
      }

      worksheet.commit();
      await workbook.commit();

      await pool.query(
        `
        INSERT INTO export_logs (user_id, site_id, feature)
        VALUES ($1, $2, $3)
        `,
        [req.user.id, req.user.site_id, "hazard"]
      );
    } catch (err) {
      console.error("EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      }

      res.end();
    }
  }
);

module.exports = router;