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
try{

      const {
        nama,
        jabatan,
        department,
        perusahaan,
        tanggal,

        no_lambung_unit,
        hm_unit,
        waktu,
        shift_kerja,

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
        opsi_item20,
        opsi_item21,
        opsi_item22,
        opsi_item23,
        opsi_item24,
        opsi_item25,
        opsi_item26,
        opsi_item27,
        opsi_item28,
        opsi_item29,
        opsi_item30,

        opsi_standar_keselamatan1,
        opsi_standar_keselamatan2,
        opsi_standar_keselamatan3,

        penjelasan_kondisi_unit,
        jam_operasi,

        status_keadaan1,
        status_keadaan2,
        status_keadaan3,
        status_keadaan4,
        status_keadaan5,
        status_keadaan6,

        unit_aman,
      } = req.body;

      const site_id = parseInt(req.user.site_id);
      const files = req.files.map(f => f.filename);

      const query = `
        INSERT INTO p2h_service_truck (
          nama, jabatan, department, perusahaan,
          hm_unit, waktu, no_lambung_unit, shift_kerja,

          opsi_item1, opsi_item2, opsi_item3, opsi_item4, opsi_item5,
          opsi_item6, opsi_item7, opsi_item8, opsi_item9, opsi_item10,
          opsi_item11, opsi_item12, opsi_item13, opsi_item14, opsi_item15,
          opsi_item16, opsi_item17, opsi_item18, opsi_item19, opsi_item20,
          opsi_item21, opsi_item22, opsi_item23, opsi_item24, opsi_item25,
          opsi_item26, opsi_item27, opsi_item28, opsi_item29, opsi_item30,

          opsi_standar_keselamatan1,
          opsi_standar_keselamatan2,
          opsi_standar_keselamatan3,

          penjelasan_kondisi_unit,
          jam_operasi,

          status_keadaan1, status_keadaan2, status_keadaan3,
          status_keadaan4, status_keadaan5, status_keadaan6,

          unit_aman,
          files,
          site_id,
          tanggal
        )
        VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,$8,

          $9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,
          $24,$25,$26,$27,$28,
          $29,$30,$31,$32,$33,
          $34,$35,$36,$37,$38,
          $39,

          $40,$41,$42,

          $43,$44,

          $45,$46,$47,
          $48,$49,$50,

          $51,
          $52,
          $53
        )
      `;

      await pool.query(query, [
        nama,
        jabatan,
        department,
        perusahaan,

        hm_unit,
        waktu,
        no_lambung_unit,
        shift_kerja,

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
        opsi_item20,
        opsi_item21,
        opsi_item22,
        opsi_item23,
        opsi_item24,
        opsi_item25,
        opsi_item26,
        opsi_item27,
        opsi_item28,
        opsi_item29,
        opsi_item30,

        opsi_standar_keselamatan1,
        opsi_standar_keselamatan2,
        opsi_standar_keselamatan3,

        penjelasan_kondisi_unit,
        jam_operasi,

        status_keadaan1,
        status_keadaan2,
        status_keadaan3,
        status_keadaan4,
        status_keadaan5,
        status_keadaan6,

        unit_aman,
        JSON.stringify(files),
        site_id,
        tanggal,
      ]);

    return res.status(201).json({
          success: true,
          uploaded_files: files.length,
        });

      } catch (e) {
        console.error("P2H SERVICE TRUCK POST ERROR:", e);
        return res.status(500).json({
          success: false,
          error: e.message,
        });
      }
    });
  }
)

// ===================== GET =====================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `SELECT * FROM p2h_service_truck`;
    const params = [];

    if (role === "admin") {
      query += " WHERE site_id = $1";
      params.push(site_id);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("P2H SERVICE TRUCK GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  ensureExcelDownloadAccess("p2h_service_truck"),
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
        [req.user.id, "p2h_service_truck"],
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
          p.jabatan,
          p.department,
          p.perusahaan,
          p.tanggal,
          p.no_lambung_unit,
          p.hm_unit,
          p.waktu,
          p.shift_kerja,

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
          p.opsi_item20,
          p.opsi_item21,
          p.opsi_item22,
          p.opsi_item23,
          p.opsi_item24,
          p.opsi_item25,
          p.opsi_item26,
          p.opsi_item27,
          p.opsi_item28,
          p.opsi_item29,
          p.opsi_item30,

          p.opsi_standar_keselamatan1,
          p.opsi_standar_keselamatan2,
          p.opsi_standar_keselamatan3,

          p.penjelasan_kondisi_unit,
          p.jam_operasi,

          p.status_keadaan1,
          p.status_keadaan2,
          p.status_keadaan3,
          p.status_keadaan4,
          p.status_keadaan5,
          p.status_keadaan6,

          p.unit_aman,
          p.files,
          p.site_id,
          p.created_at,
          s.site_name
        FROM p2h_service_truck p
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

      const exportFileName = `P2H_SERVICE_TRUCK_${formattedDate}.xlsx`;

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

      const worksheet = workbook.addWorksheet("P2H Service Truck Export");
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
        const yellowValues = ["tidak berfungsi", "n/a"];

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
        { key: "nama", width: 35 },
        { key: "jabatan", width: 25 },
        { key: "department", width: 25 },
        { key: "perusahaan", width: 30 },
        { key: "hm_unit", width: 20 },
        { key: "waktu", width: 20 },
        { key: "no_lambung_unit", width: 25 },
        { key: "shift_kerja", width: 20 },
        { key: "tanggal", width: 20 },

        { key: "opsi_item1", width: 45 },
        { key: "opsi_item2", width: 45 },
        { key: "opsi_item3", width: 45 },
        { key: "opsi_item4", width: 45 },
        { key: "opsi_item5", width: 45 },
        { key: "opsi_item6", width: 45 },
        { key: "opsi_item7", width: 45 },
        { key: "opsi_item8", width: 45 },
        { key: "opsi_item9", width: 45 },
        { key: "opsi_item10", width: 45 },
        { key: "opsi_item11", width: 45 },
        { key: "opsi_item12", width: 45 },
        { key: "opsi_item13", width: 45 },
        { key: "opsi_item14", width: 45 },
        { key: "opsi_item15", width: 45 },
        { key: "opsi_item16", width: 45 },
        { key: "opsi_item17", width: 45 },
        { key: "opsi_item18", width: 45 },
        { key: "opsi_item19", width: 45 },
        { key: "opsi_item20", width: 45 },
        { key: "opsi_item21", width: 45 },
        { key: "opsi_item22", width: 45 },
        { key: "opsi_item23", width: 45 },
        { key: "opsi_item24", width: 45 },
        { key: "opsi_item25", width: 45 },
        { key: "opsi_item26", width: 45 },
        { key: "opsi_item27", width: 45 },
        { key: "opsi_item28", width: 45 },
        { key: "opsi_item29", width: 45 },
        { key: "opsi_item30", width: 45 },

        { key: "opsi_standar_keselamatan1", width: 30 },
        { key: "opsi_standar_keselamatan2", width: 30 },
        { key: "opsi_standar_keselamatan3", width: 30 },

        { key: "penjelasan_kondisi_unit", width: 60 },
        { key: "jam_operasi", width: 16 },

        { key: "status_keadaan1", width: 50 },
        { key: "status_keadaan2", width: 50 },
        { key: "status_keadaan3", width: 50 },
        { key: "status_keadaan4", width: 50 },
        { key: "status_keadaan5", width: 50 },
        { key: "status_keadaan6", width: 50 },

        { key: "unit_aman", width: 24 },
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
      titleCell.value = "LAPORAN EXPORT P2H SERVICE TRUCK";
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
        "Jabatan",
        "Department",
        "Perusahaan",
        "HM Unit",
        "Waktu",
        "No Lambung Unit",
        "Shift Kerja",
        "Tanggal",

        "Level Oli Mesin",
        "Level Air Radiator",
        "Bocor Air Radiator",
        "Level Minyak Rem",
        "Oli Mesin",
        "Bahan Bakar",
        "Kondisi Wiper",
        "Kondisi Ban (Kondisi Fisik, Kelurusan, Tekanan & Sekrup)",
        "Kondisi Rem (Kaki, Parkir, & Emergency)",
        "Kondisi Lampu Rotary, Sen Kanan, Sen Kiri dan Bahaya",
        "Alarm Mundur",
        "Kondisi Kaca Depan, Belakang, Jendela & Spion",
        "Cermin Pandang Belakang & Sisi",
        "Keadaan Body, Kabin dan Kursi Operator & Penumpang",
        "Suhu Mesin",
        "Klakson",
        "Uji Rem Fisik",
        "Alat Pelambat / Retrader Control",
        "Pedal Rem Servis dan Modulasi Transmisi",
        "Reaksi Kemudi",
        "Kemudi Darurat",
        "Mesin",
        "Sistem Elektrik",
        "Load Indicator",
        "Instrumen Panel",
        "Alat Pemadam Api",
        "Kotak PK3",
        "Sabuk Keselamatan",
        "Radio Komunikasi",
        "SIMPER tersedia & aktif",

        "Safety Cone / Segitiga",
        "APAR (alat pemadam api ringan)",
        "Kotak P3K",

        "Penjelasan kondisi Unit (Apabila ada kendala)",
        "Jam Operasi",

        "Apakah Anda sedang mengkonsumsi obat yang menyebabkan mengantuk",
        "Apakah jam tidur anda cukup hari ini minimal 6 jam",
        "Apakah Anda tidak ada permasalahan dengan keluarga yang mengganggu konsentrasi Anda",
        "Apakah Anda memiliki masalah dengan atasan Anda",
        "Apakah Anda merasa kurang konsentrasi hari ini",
        "Apakah Anda merasa pandangan mata Anda letih",

        "Unit Aman",
        "Tanggal Dibuat",
        "Site",
        "File 1",
        "File 2",
        "File 3",
        "File 4",
        "File 5",
      ]);

      headerRow.height = 50;

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
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
      ];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];
        const parsedFiles = parseFiles(row.files);

        const excelRow = worksheet.addRow([
          i + 1,
          row.nama ?? "-",
          row.jabatan ?? "-",
          row.department ?? "-",
          row.perusahaan ?? "-",
          row.hm_unit ?? "-",
          row.waktu ?? "-",
          row.no_lambung_unit ?? "-",
          row.shift_kerja ?? "-",
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
          row.opsi_item20 ?? "-",
          row.opsi_item21 ?? "-",
          row.opsi_item22 ?? "-",
          row.opsi_item23 ?? "-",
          row.opsi_item24 ?? "-",
          row.opsi_item25 ?? "-",
          row.opsi_item26 ?? "-",
          row.opsi_item27 ?? "-",
          row.opsi_item28 ?? "-",
          row.opsi_item29 ?? "-",
          row.opsi_item30 ?? "-",

          row.opsi_standar_keselamatan1 ?? "-",
          row.opsi_standar_keselamatan2 ?? "-",
          row.opsi_standar_keselamatan3 ?? "-",

          row.penjelasan_kondisi_unit ?? "-",
          row.jam_operasi ?? "-",

          row.status_keadaan1 ?? "-",
          row.status_keadaan2 ?? "-",
          row.status_keadaan3 ?? "-",
          row.status_keadaan4 ?? "-",
          row.status_keadaan5 ?? "-",
          row.status_keadaan6 ?? "-",

          row.unit_aman ?? "-",
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
            vertical: "middle",
            horizontal:
              colNumber === 1 ||
              colNumber === 6 ||
              colNumber === 7 ||
              colNumber === 9 ||
              colNumber === 10 ||
              colNumber === 44 ||
              colNumber === 45 ||
              colNumber === 52 ||
              colNumber === 53
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

        excelRow.height = 35;

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
          const fileCell = excelRow.getCell(55 + j);

          const baseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

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
        [req.user.id, req.user.site_id, "p2h_service_truck"],
      );
    } catch (err) {
      console.error("P2H SERVICE TRUCK EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      } else {
        return res.end();
      }
    }
  },
);

module.exports = router;
