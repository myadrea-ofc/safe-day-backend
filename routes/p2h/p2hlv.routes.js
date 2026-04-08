const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const multer = require("multer");
const authMiddleware = require("../../middlewares/auth.middleware");
const fs = require("fs");
const ExcelJS = require("exceljs");

// === MULTER ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

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
        brand_unit,
        no_lambung_unit,
        lv_sekarang,
        shift_kerja,
        opsiitem1,
        opsiitem2,
        opsiitem3,
        opsiitem4,
        opsiitem5,
        opsiitem6,
        opsiitem7,
        opsiitem8,
        opsiitem9,
        opsiitem10,
        opsiitem11,
        opsiitem12,
        opsiitem13,
        opsiitem14,
        opsiitem15,
        opsiitem16,
        opsiitem17,
        opsiitem18,
        opsiitem19,
        opsistandardkeselamatan1,
        opsistandardkeselamatan2,
        opsistandardkeselamatan3,
        opsistandardkeselamatan4,
        opsistandardkeselamatan5,
        opsistandardmasuktambang1,
        opsistandardmasuktambang2,
        opsistandardmasuktambang3,
        opsistandardmasuktambang4,
        opsistandardmasuktambang5,
        opsistandardmasuktambang6,
        opsistandardmasuktambang7,
        laporan_temuan,
        jam_tidur,
        status_keadaan1,
        status_keadaan2,
        status_keadaan3,
        status_keadaan4,
        status_keadaan5,
        status_keadaan6,
        status_siap,
        tanggal
      } = req.body;

      const site_id = parseInt(req.user.site_id);     
      const files = req.files.map(f => f.filename);

const query = `
  INSERT INTO p2h_lv (
    nama, jabatan, department, perusahaan,
    brand_unit, no_lambung_unit, lv_sekarang, shift_kerja,
    opsiitem1, opsiitem2, opsiitem3, opsiitem4, opsiitem5,
    opsiitem6, opsiitem7, opsiitem8, opsiitem9, opsiitem10,
    opsiitem11, opsiitem12, opsiitem13, opsiitem14, opsiitem15,
    opsiitem16, opsiitem17, opsiitem18, opsiitem19,
    opsistandardkeselamatan1, opsistandardkeselamatan2,
    opsistandardkeselamatan3, opsistandardkeselamatan4,
    opsistandardkeselamatan5,
    opsistandardmasuktambang1, opsistandardmasuktambang2,
    opsistandardmasuktambang3, opsistandardmasuktambang4,
    opsistandardmasuktambang5, opsistandardmasuktambang6,
    opsistandardmasuktambang7,
    laporan_temuan, jam_tidur,
    status_keadaan1, status_keadaan2, status_keadaan3,
    status_keadaan4, status_keadaan5, status_keadaan6,
    status_siap,
    files,
    site_id,
    tanggal
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,
    $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
    $19,$20,$21,$22,$23,$24,$25,$26,$27,
    $28,$29,$30,$31,$32,
    $33,$34,$35,$36,$37,$38,$39,
    $40,$41,
    $42,$43,$44,$45,$46,$47,
    $48,
    $49,
    $50,
    $51
  )
`;


      const result = await pool.query(query, [
        nama,
        jabatan,
        department,
        perusahaan,
        brand_unit,
        no_lambung_unit,
        lv_sekarang,
        shift_kerja,
        opsiitem1,
        opsiitem2,
        opsiitem3,
        opsiitem4,
        opsiitem5,
        opsiitem6,
        opsiitem7,
        opsiitem8,
        opsiitem9,
        opsiitem10,
        opsiitem11,
        opsiitem12,
        opsiitem13,
        opsiitem14,
        opsiitem15,
        opsiitem16,
        opsiitem17,
        opsiitem18,
        opsiitem19,
        opsistandardkeselamatan1,
        opsistandardkeselamatan2,
        opsistandardkeselamatan3,
        opsistandardkeselamatan4,
        opsistandardkeselamatan5,
        opsistandardmasuktambang1,
        opsistandardmasuktambang2,
        opsistandardmasuktambang3,
        opsistandardmasuktambang4,
        opsistandardmasuktambang5,
        opsistandardmasuktambang6,
        opsistandardmasuktambang7,
        laporan_temuan,
        jam_tidur,
        status_keadaan1,
        status_keadaan2,
        status_keadaan3,
        status_keadaan4,
        status_keadaan5,
        status_keadaan6,
        status_siap,
        JSON.stringify(files),      
        site_id,
        tanggal
      ]);

    return res.status(201).json({
          success: true,
          uploaded_files: files.length,
        });

      } catch (e) {
        console.error("P2H LV POST ERROR:", e);
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

    let query = `
      SELECT *
      FROM p2h_lv
    `;

    const params = [];

    if (role === "admin") {
      query += " WHERE site_id = $1";
      params.push(site_id);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("P2H LV GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  ensureExcelDownloadAccess("p2h_lv"),
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
        [req.user.id, "p2h_lv"],
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
          p.brand_unit,
          p.no_lambung_unit,
          p.lv_sekarang,
          p.shift_kerja,

          p.opsiitem1,
          p.opsiitem2,
          p.opsiitem3,
          p.opsiitem4,
          p.opsiitem5,
          p.opsiitem6,
          p.opsiitem7,
          p.opsiitem8,
          p.opsiitem9,
          p.opsiitem10,
          p.opsiitem11,
          p.opsiitem12,
          p.opsiitem13,
          p.opsiitem14,
          p.opsiitem15,
          p.opsiitem16,
          p.opsiitem17,
          p.opsiitem18,
          p.opsiitem19,

          p.opsistandardkeselamatan1,
          p.opsistandardkeselamatan2,
          p.opsistandardkeselamatan3,
          p.opsistandardkeselamatan4,
          p.opsistandardkeselamatan5,

          p.opsistandardmasuktambang1,
          p.opsistandardmasuktambang2,
          p.opsistandardmasuktambang3,
          p.opsistandardmasuktambang4,
          p.opsistandardmasuktambang5,
          p.opsistandardmasuktambang6,
          p.opsistandardmasuktambang7,

          p.laporan_temuan,
          p.jam_tidur,

          p.status_keadaan1,
          p.status_keadaan2,
          p.status_keadaan3,
          p.status_keadaan4,
          p.status_keadaan5,
          p.status_keadaan6,

          p.status_siap,
          p.files,
          p.site_id,
          p.tanggal,
          p.created_at,
          s.site_name
        FROM p2h_lv p
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

      const exportFileName = `P2H_LV_${formattedDate}.xlsx`;

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

      const worksheet = workbook.addWorksheet("P2H LV Export");
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
        { key: "brand_unit", width: 20 },
        { key: "no_lambung_unit", width: 25 },
        { key: "lv_sekarang", width: 20 },
        { key: "shift_kerja", width: 20 },
        { key: "tanggal", width: 20 },

        { key: "opsiitem1", width: 45 },
        { key: "opsiitem2", width: 45 },
        { key: "opsiitem3", width: 45 },
        { key: "opsiitem4", width: 45 },
        { key: "opsiitem5", width: 45 },
        { key: "opsiitem6", width: 45 },
        { key: "opsiitem7", width: 45 },
        { key: "opsiitem8", width: 45 },
        { key: "opsiitem9", width: 45 },
        { key: "opsiitem10", width: 45 },
        { key: "opsiitem11", width: 45 },
        { key: "opsiitem12", width: 45 },
        { key: "opsiitem13", width: 45 },
        { key: "opsiitem14", width: 45 },
        { key: "opsiitem15", width: 45 },
        { key: "opsiitem16", width: 45 },
        { key: "opsiitem17", width: 45 },
        { key: "opsiitem18", width: 45 },
        { key: "opsiitem19", width: 45 },

        { key: "opsistandardkeselamatan1", width: 30 },
        { key: "opsistandardkeselamatan2", width: 30 },
        { key: "opsistandardkeselamatan3", width: 30 },
        { key: "opsistandardkeselamatan4", width: 30 },
        { key: "opsistandardkeselamatan5", width: 30 },

        { key: "opsistandardmasuktambang1", width: 30 },
        { key: "opsistandardmasuktambang2", width: 30 },
        { key: "opsistandardmasuktambang3", width: 30 },
        { key: "opsistandardmasuktambang4", width: 30 },
        { key: "opsistandardmasuktambang5", width: 30 },
        { key: "opsistandardmasuktambang6", width: 30 },
        { key: "opsistandardmasuktambang7", width: 30 },

        { key: "laporan_temuan", width: 60 },
        { key: "jam_tidur", width: 16 },

        { key: "status_keadaan1", width: 50 },
        { key: "status_keadaan2", width: 50 },
        { key: "status_keadaan3", width: 50 },
        { key: "status_keadaan4", width: 50 },
        { key: "status_keadaan5", width: 50 },
        { key: "status_keadaan6", width: 50 },

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
      titleCell.value = "LAPORAN EXPORT P2H LV";
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
        "Brand Unit",
        "No Lambung Unit",
        "LV Sekarang",
        "Shift Kerja",
        "Tanggal",

        "Level Oil Engine",
        "Level Air Radiator",
        "Level Minyak Rem",
        "Kondisi Aki",
        "Air Wiper dan Kondisi Wiper",
        "Kondisi Ban",
        "Ban Serap",
        "Skrup Ban",
        "Rem Kaki",
        "Rem Tangan",
        "Lampu Kerja (Depan & Belakang)",
        "Lampu Sein (Kiri & Kanan)",
        "Lampu Hazard",
        "Alarm Mundur",
        "Klakson",
        "Keadaan Body Mobil",
        "Kaca Spion",
        "Panel Engine",
        "Kondisi AC",

        "Safety Cone / Segitiga",
        "APAR (alat pemadam api ringan)",
        "Jack",
        "Kotak P3K",
        "Seat Belt / Sabuk Pengaman",

        "Lampu Atap Kabin",
        "Lampu Rotari",
        "Scotlight Reflector",
        "No Lambung Unit",
        "Radio Komunikasi",
        "Buggy Whip 4 Mtr",
        "4WD",

        "Laporan Temuan Hasil P2H",
        "Jam Tidur",

        "Apakah Anda sedang mengkonsumsi obat yang menyebabkan mengantuk",
        "Apakah jam tidur anda cukup hari ini minimal 6 jam",
        "Apakah Anda tidak ada permasalahan dengan keluarga yang mengganggu konsentrasi Anda",
        "Apakah Anda memiliki masalah dengan atasan Anda",
        "Apakah Anda merasa kurang konsentrasi hari ini",
        "Apakah Anda merasa pandangan mata Anda letih",

        "Status Siap",
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
        21, 22, 23, 24, 25, 26, 27, 28, 29,
        30, 31, 32, 33, 34,
        35, 36, 37, 38, 39, 40, 41,
        45, 46, 47, 48, 49, 50, 51,
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
          row.brand_unit ?? "-",
          row.no_lambung_unit ?? "-",
          row.lv_sekarang ?? "-",
          row.shift_kerja ?? "-",
          formatDateOnly(row.tanggal),

          row.opsiitem1 ?? "-",
          row.opsiitem2 ?? "-",
          row.opsiitem3 ?? "-",
          row.opsiitem4 ?? "-",
          row.opsiitem5 ?? "-",
          row.opsiitem6 ?? "-",
          row.opsiitem7 ?? "-",
          row.opsiitem8 ?? "-",
          row.opsiitem9 ?? "-",
          row.opsiitem10 ?? "-",
          row.opsiitem11 ?? "-",
          row.opsiitem12 ?? "-",
          row.opsiitem13 ?? "-",
          row.opsiitem14 ?? "-",
          row.opsiitem15 ?? "-",
          row.opsiitem16 ?? "-",
          row.opsiitem17 ?? "-",
          row.opsiitem18 ?? "-",
          row.opsiitem19 ?? "-",

          row.opsistandardkeselamatan1 ?? "-",
          row.opsistandardkeselamatan2 ?? "-",
          row.opsistandardkeselamatan3 ?? "-",
          row.opsistandardkeselamatan4 ?? "-",
          row.opsistandardkeselamatan5 ?? "-",

          row.opsistandardmasuktambang1 ?? "-",
          row.opsistandardmasuktambang2 ?? "-",
          row.opsistandardmasuktambang3 ?? "-",
          row.opsistandardmasuktambang4 ?? "-",
          row.opsistandardmasuktambang5 ?? "-",
          row.opsistandardmasuktambang6 ?? "-",
          row.opsistandardmasuktambang7 ?? "-",

          row.laporan_temuan ?? "-",
          row.jam_tidur ?? "-",

          row.status_keadaan1 ?? "-",
          row.status_keadaan2 ?? "-",
          row.status_keadaan3 ?? "-",
          row.status_keadaan4 ?? "-",
          row.status_keadaan5 ?? "-",
          row.status_keadaan6 ?? "-",

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
            vertical: "middle",
            horizontal:
              colNumber === 1 ||
              colNumber === 8 ||
              colNumber === 9 ||
              colNumber === 10 ||
              colNumber === 43 ||
              colNumber === 44 ||
              colNumber === 51 ||
              colNumber === 52
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
          const fileCell = excelRow.getCell(54 + j);

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
        [req.user.id, req.user.site_id, "p2h_lv"],
      );
    } catch (err) {
      console.error("P2H LV EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      } else {
        return res.end();
      }
    }
  },
);

module.exports = router;
