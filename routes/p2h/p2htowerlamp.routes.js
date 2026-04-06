const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const multer = require("multer");
const authMiddleware = require("../../middlewares/auth.middleware");
const fs = require("fs");
const ExcelJS = require("exceljs");

// ===================== MULTER =====================
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

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
  (req, res) => {
    upload.array("files", 5)(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(413).json({
          success: false,
          message: "Ukuran file maksimal 5MB, maksimal 5 file",
        });
      }

      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
      try {
        const {
          nama,
          nrp,
          jabatan,
          department,
          perusahaan,
          lokasi_kerja,
          hm_unit,

          opsi_item1,
          opsi_item2,
          opsi_item3,
          opsi_item4,
          opsi_item5,
          opsi_item6,
          opsi_item7,
          opsi_item8,
          opsi_item9,
          opsi_item10,
          opsi_item11,
          opsi_item12,
          opsi_item13,
          opsi_item14,
          opsi_item15,
          opsi_item16,
          opsi_item17,
          opsi_item18,
          opsi_item19,

          status_siap,
          tanggal,
        } = req.body;

        const site_id = parseInt(req.user.site_id);
        const files = (req.files || []).map((f) => f.filename);

        const query = `
        INSERT INTO p2h_towerlamp (
          nama, nrp, jabatan, department, perusahaan,
          lokasi_kerja, hm_unit,

          opsi_item1, opsi_item2, opsi_item3, opsi_item4, opsi_item5,
          opsi_item6, opsi_item7, opsi_item8, opsi_item9, opsi_item10,
          opsi_item11, opsi_item12, opsi_item13, opsi_item14, opsi_item15,
          opsi_item16, opsi_item17, opsi_item18, opsi_item19,

          status_siap,
          files,
          site_id,
          tanggal
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,

          $8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,
          $23,$24,$25,$26,

          $27,
          $28,
          $29,
          $30
        )
        RETURNING id
      `;

        const result = await pool.query(query, [
          nama,
          nrp,
          jabatan,
          department,
          perusahaan,
          lokasi_kerja,
          hm_unit,

          opsi_item1,
          opsi_item2,
          opsi_item3,
          opsi_item4,
          opsi_item5,
          opsi_item6,
          opsi_item7,
          opsi_item8,
          opsi_item9,
          opsi_item10,
          opsi_item11,
          opsi_item12,
          opsi_item13,
          opsi_item14,
          opsi_item15,
          opsi_item16,
          opsi_item17,
          opsi_item18,
          opsi_item19,

          status_siap,
          JSON.stringify(files),
          site_id,
          tanggal,
        ]);

        return res.status(201).json({
          success: true,
          uploaded_files: files.length,
          id: result.rows[0].id,
        });
      } catch (e) {
        console.error("P2H TOWER LAMP POST ERROR:", e);
        return res.status(500).json({
          success: false,
          error: e.message,
        });
      }
    });
  }
);

// ===================== GET =====================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT
        p.id,
        p.nama,
        p.nrp,
        p.jabatan,
        p.department,
        p.perusahaan,
        p.lokasi_kerja,
        p.hm_unit,

        p.opsi_item1,
        p.opsi_item2,
        p.opsi_item3,
        p.opsi_item4,
        p.opsi_item5,
        p.opsi_item6,
        p.opsi_item7,
        p.opsi_item8,
        p.opsi_item9,
        p.opsi_item10,
        p.opsi_item11,
        p.opsi_item12,
        p.opsi_item13,
        p.opsi_item14,
        p.opsi_item15,
        p.opsi_item16,
        p.opsi_item17,
        p.opsi_item18,
        p.opsi_item19,

        p.status_siap,
        p.files,
        p.site_id,
        p.tanggal,
        p.created_at
      FROM p2h_towerlamp p
    `;
    const params = [];

    if (role === "admin") {
      query += " WHERE p.site_id = $1";
      params.push(site_id);
    }

    query += " ORDER BY p.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("P2H TOWERLAMP GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  ensureExcelDownloadAccess("p2h_towerlamp"),
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
        [req.user.id, "p2h_towerlamp"],
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
          p.id,
          p.nama,
          p.nrp,
          p.jabatan,
          p.department,
          p.perusahaan,
          p.lokasi_kerja,
          p.hm_unit,

          p.opsi_item1,
          p.opsi_item2,
          p.opsi_item3,
          p.opsi_item4,
          p.opsi_item5,
          p.opsi_item6,
          p.opsi_item7,
          p.opsi_item8,
          p.opsi_item9,
          p.opsi_item10,
          p.opsi_item11,
          p.opsi_item12,
          p.opsi_item13,
          p.opsi_item14,
          p.opsi_item15,
          p.opsi_item16,
          p.opsi_item17,
          p.opsi_item18,
          p.opsi_item19,

          p.status_siap,
          p.files,
          p.site_id,
          p.tanggal,
          p.created_at,
          s.site_name
        FROM p2h_towerlamp p
        LEFT JOIN sites s ON s.id = p.site_id
      `;

      const params = [];
      const where = [];

      if (role === "admin") {
        where.push(`p.site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      if (start) {
        where.push(`p.created_at >= $${params.length + 1}`);
        params.push(start);
      }

      if (end) {
        where.push(`p.created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      query += ` ORDER BY p.created_at DESC`;

      const result = await pool.query(query, params);

      const MAX_EXPORT_ROWS = 50000;
      if (result.rows.length > MAX_EXPORT_ROWS) {
        return res.status(400).json({
          message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
        });
      }

      const now = new Date();

      const formattedDate = now
        .toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
        })
        .replace(/\//g, "-");

      const exportFileName = `P2H_TOWERLAMP_${formattedDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFileName}"`,
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      });

      const worksheet = workbook.addWorksheet("P2H Tower Lamp Export");
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

      function formatDateOnly(value) {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
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

      function parseFiles(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.filter(Boolean);

        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (_) {
          return [];
        }
      }

      function normalizeCellValue(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      }

      function applyStatusColor(cell, rawValue) {
        const value = normalizeCellValue(rawValue);

        const greenValues = ["iya", "ya", "layak", "ada & layak"];
        const redValues = ["tidak", "tidak ada"];
        const yellowValues = ["tidak berfungsi"];

        if (greenValues.includes(value)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          };
          cell.font = {
            bold: true,
            size: 10,
            color: { argb: "FF166534" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          return;
        }

        if (redValues.includes(value)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          cell.font = {
            bold: true,
            size: 10,
            color: { argb: "FF991B1B" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          return;
        }

        if (yellowValues.includes(value)) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
          cell.font = {
            bold: true,
            size: 10,
            color: { argb: "FF92400E" },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
        }
      }

      worksheet.columns = [
        { key: "no", width: 8 },
        { key: "nama", width: 24 },
        { key: "nrp", width: 16 },
        { key: "jabatan", width: 20 },
        { key: "department", width: 20 },
        { key: "perusahaan", width: 24 },
        { key: "lokasi_kerja", width: 22 },
        { key: "hm_unit", width: 16 },
        { key: "tanggal", width: 16 },

        { key: "opsi_item1", width: 20 },
        { key: "opsi_item2", width: 20 },
        { key: "opsi_item3", width: 20 },
        { key: "opsi_item4", width: 20 },
        { key: "opsi_item5", width: 20 },
        { key: "opsi_item6", width: 20 },
        { key: "opsi_item7", width: 24 },
        { key: "opsi_item8", width: 18 },
        { key: "opsi_item9", width: 18 },
        { key: "opsi_item10", width: 18 },
        { key: "opsi_item11", width: 22 },
        { key: "opsi_item12", width: 18 },
        { key: "opsi_item13", width: 18 },
        { key: "opsi_item14", width: 18 },
        { key: "opsi_item15", width: 18 },
        { key: "opsi_item16", width: 18 },
        { key: "opsi_item17", width: 18 },
        { key: "opsi_item18", width: 18 },
        { key: "opsi_item19", width: 20 },

        { key: "status_siap", width: 24 },
        { key: "created_at", width: 22 },
        { key: "site_name", width: 18 },
        { key: "file_1", width: 18 },
        { key: "file_2", width: 18 },
        { key: "file_3", width: 18 },
        { key: "file_4", width: 18 },
        { key: "file_5", width: 18 },
      ];

      function getExcelColumnName(columnNumber) {
        let dividend = columnNumber;
        let columnName = "";

        while (dividend > 0) {
          const modulo = (dividend - 1) % 26;
          columnName = String.fromCharCode(65 + modulo) + columnName;
          dividend = Math.floor((dividend - modulo) / 26);
        }

        return columnName;
      }

      const lastColumnLetter = getExcelColumnName(worksheet.columns.length);

      worksheet.mergeCells(`A1:${lastColumnLetter}1`);
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "LAPORAN EXPORT P2H TOWER LAMP";
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

      worksheet.mergeCells(`A2:${lastColumnLetter}2`);
      const infoCell = worksheet.getCell("A2");
      let currentUserSiteName = "-";

      if (req.user.site_id) {
        const siteRes = await pool.query(
          `SELECT site_name FROM sites WHERE id = $1 LIMIT 1`,
          [req.user.site_id],
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

      const headerRow = worksheet.addRow([
        "No",
        "Nama",
        "NRP",
        "Jabatan",
        "Department",
        "Perusahaan",
        "Lokasi Kerja",
        "HM Unit",
        "Tanggal",

        "Level Oli Mesin",
        "Temperatur Oli",
        "Kondisi Hose",
        "Kondisi Lampu",
        "Filter Udara",
        "Sling Condition",
        "Alat Pemadam Api Ringan",
        "Suhu Mesin",
        "Mesin",
        "Putaran Mesin",
        "Kondisi Lampu Menara",
        "Level Air Aki",
        "Sistem Alarm",
        "Level Air Radiator",
        "Skidding",
        "Level BBM",
        "Gandengan",
        "Penutup Mesin",
        "Kondisi Mur / Baut",

        "Status Siap",
        "Tanggal Dibuat",
        "Site",
        "File 1",
        "File 2",
        "File 3",
        "File 4",
        "File 5",
      ]);

      headerRow.height = 40;

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

      const colorableColumns = [
        10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29
      ];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];
        const parsedFiles = parseFiles(row.files);

        const excelRow = worksheet.addRow([
          i + 1,
          row.nama ?? "-",
          row.nrp ?? "-",
          row.jabatan ?? "-",
          row.department ?? "-",
          row.perusahaan ?? "-",
          row.lokasi_kerja ?? "-",
          row.hm_unit ?? "-",
          formatDateOnly(row.tanggal),

          row.opsi_item1 ?? "-",
          row.opsi_item2 ?? "-",
          row.opsi_item3 ?? "-",
          row.opsi_item4 ?? "-",
          row.opsi_item5 ?? "-",
          row.opsi_item6 ?? "-",
          row.opsi_item7 ?? "-",
          row.opsi_item8 ?? "-",
          row.opsi_item9 ?? "-",
          row.opsi_item10 ?? "-",
          row.opsi_item11 ?? "-",
          row.opsi_item12 ?? "-",
          row.opsi_item13 ?? "-",
          row.opsi_item14 ?? "-",
          row.opsi_item15 ?? "-",
          row.opsi_item16 ?? "-",
          row.opsi_item17 ?? "-",
          row.opsi_item18 ?? "-",
          row.opsi_item19 ?? "-",

          row.status_siap ?? "-",
          formatDateTime(row.created_at),
          row.site_name ?? "-",
          "",
          "",
          "",
          "",
          "",
        ]);

        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "top",
            horizontal:
              colNumber === 1 ||
              colNumber === 3 ||
              colNumber === 8 ||
              colNumber === 9 ||
              colNumber === 29 ||
              colNumber === 30
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

        colorableColumns.forEach((colNumber) => {
          const cell = excelRow.getCell(colNumber);
          applyStatusColor(cell, cell.value);
        });

        excelRow.height = 22;

        if (i % 2 === 0) {
          excelRow.eachCell((cell) => {
            if (!cell.fill) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF9FAFB" },
              };
            }
          });
        }

        for (let j = 0; j < 5; j++) {
          const uploadedFileName = parsedFiles[j];
          const fileCell = excelRow.getCell(32 + j);

          const baseUrl = (process.env.PUBLIC_BASE_URL || "").replace(
            /\/$/,
            "",
          );

          if (uploadedFileName) {
            const fileUrl = `${baseUrl}/uploads/${encodeURIComponent(uploadedFileName)}`;

            fileCell.value = {
              text: `Lihat File ${j + 1}`,
              hyperlink: fileUrl,
              tooltip: `Buka file ${j + 1}`,
            };
            fileCell.font = {
              color: { argb: "FF2563EB" },
              underline: true,
              size: 10,
            };
            fileCell.alignment = {
              vertical: "middle",
              horizontal: "center",
            };
          } else {
            fileCell.value = "-";
            fileCell.alignment = {
              vertical: "middle",
              horizontal: "center",
            };
          }
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
        [req.user.id, req.user.site_id, "p2h_towerlamp"],
      );
    } catch (err) {
      console.error("P2H TOWERLAMP EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      } else {
        return res.end();
      }
    }
  },
);

module.exports = router;