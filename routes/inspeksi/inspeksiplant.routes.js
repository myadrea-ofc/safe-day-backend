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
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

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

// ===================== POST =====================
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "foto1", maxCount: 1 },
    { name: "foto2", maxCount: 1 },
    { name: "foto3", maxCount: 1 },
    { name: "foto4", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        nama,
        nrp,
        department,
        perusahaan,
        tanggal,
        jumlah_inspektor,

        opsi1,
        opsi2,
        opsi3,
        opsi4,
        opsi5,
        opsi6,
        opsi7,
        opsi8,
        opsi9,
        opsi10,
        opsi11,
        opsi12,
        opsi13,
        opsi14,
        opsi15,
        opsi16,
        opsi17,
        opsi18,
        opsi19,
        opsi20,
        opsi21,
        opsi22,
        opsi23,
        opsi24,
        opsi25,
        opsi26,

        ket_hasil,
        saran_masuk,
        status_inspeksi,
      } = req.body;

      const site_id = req.user.site_id;

      const foto1 = req.files?.foto1?.[0]?.filename || null;
      const foto2 = req.files?.foto2?.[0]?.filename || null;
      const foto3 = req.files?.foto3?.[0]?.filename || null;
      const foto4 = req.files?.foto4?.[0]?.filename || null;

      const query = `
        INSERT INTO inspeksi_plant (
          nama,
          nrp,
          department,
          perusahaan,
          tanggal,
          jumlah_inspektor,

          opsi1, opsi2, opsi3, opsi4, opsi5,
          opsi6, opsi7, opsi8, opsi9, opsi10,
          opsi11, opsi12, opsi13, opsi14, opsi15,
          opsi16, opsi17, opsi18, opsi19, opsi20,
          opsi21, opsi22, opsi23, opsi24, opsi25, opsi26,

          ket_hasil,
          saran_masuk,
          status_inspeksi,

          foto1,
          foto2,
          foto3,
          foto4,
          site_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31, $32,
          $33, $34, $35,
          $36, $37, $38, $39,
          $40
        )
        RETURNING id
      `;

      const values = [
        nama,
        nrp,
        department,
        perusahaan,
        tanggal,
        jumlah_inspektor,

        opsi1,
        opsi2,
        opsi3,
        opsi4,
        opsi5,
        opsi6,
        opsi7,
        opsi8,
        opsi9,
        opsi10,
        opsi11,
        opsi12,
        opsi13,
        opsi14,
        opsi15,
        opsi16,
        opsi17,
        opsi18,
        opsi19,
        opsi20,
        opsi21,
        opsi22,
        opsi23,
        opsi24,
        opsi25,
        opsi26,

        ket_hasil,
        saran_masuk,
        status_inspeksi,

        foto1,
        foto2,
        foto3,
        foto4,

        site_id,
      ];

      const result = await pool.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Data Inspeksi Plant berhasil disimpan",
        id: result.rows[0].id,
      });
    } catch (error) {
      console.error("INSPEKSI PLANT POST ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
);

// ===================== GET =====================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT
        i.id,
        i.nama,
        i.nrp,
        i.department,
        i.perusahaan,
        i.tanggal,
        i.jumlah_inspektor,

        i.opsi1,
        i.opsi2,
        i.opsi3,
        i.opsi4,
        i.opsi5,
        i.opsi6,
        i.opsi7,
        i.opsi8,
        i.opsi9,
        i.opsi10,
        i.opsi11,
        i.opsi12,
        i.opsi13,
        i.opsi14,
        i.opsi15,
        i.opsi16,
        i.opsi17,
        i.opsi18,
        i.opsi19,
        i.opsi20,
        i.opsi21,
        i.opsi22,
        i.opsi23,
        i.opsi24,
        i.opsi25,
        i.opsi26,

        i.ket_hasil,
        i.saran_masuk,
        i.status_inspeksi,

        i.foto1,
        i.foto2,
        i.foto3,
        i.foto4,
        i.created_at,
        i.site_id
      FROM inspeksi_plant i
    `;

    const params = [];

    if (role === "admin") {
      query += ` WHERE i.site_id = $1`;
      params.push(site_id);
    }

    query += ` ORDER BY i.created_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error("INSPEKSI PLANT GET ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/export.xlsx",
  authMiddleware,
  ensureExcelDownloadAccess("inspeksi_plant"),
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
        [req.user.id, "inspeksi_plant"],
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
          i.id,
          i.nama,
          i.nrp,
          i.department,
          i.perusahaan,
          i.tanggal,
          i.jumlah_inspektor,

          i.opsi1,
          i.opsi2,
          i.opsi3,
          i.opsi4,
          i.opsi5,
          i.opsi6,
          i.opsi7,
          i.opsi8,
          i.opsi9,
          i.opsi10,
          i.opsi11,
          i.opsi12,
          i.opsi13,
          i.opsi14,
          i.opsi15,
          i.opsi16,
          i.opsi17,
          i.opsi18,
          i.opsi19,
          i.opsi20,
          i.opsi21,
          i.opsi22,
          i.opsi23,
          i.opsi24,
          i.opsi25,
          i.opsi26,

          i.ket_hasil,
          i.saran_masuk,
          i.status_inspeksi,

          i.foto1,
          i.foto2,
          i.foto3,
          i.foto4,
          i.created_at,
          i.site_id,
          s.site_name
        FROM inspeksi_plant i
        LEFT JOIN sites s ON s.id = i.site_id
      `;

      const params = [];
      const where = [];

      if (role === "admin") {
        where.push(`i.site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      if (start) {
        where.push(`i.created_at >= $${params.length + 1}`);
        params.push(start);
      }

      if (end) {
        where.push(`i.created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      query += ` ORDER BY i.created_at DESC`;

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

      const fileName = `INSPEKSI_PLANT_${formattedDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      });

      const worksheet = workbook.addWorksheet("Inspeksi Plant Export");
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

      function normalizeCellValue(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      }

      function applyStatusColor(cell, rawValue) {
        const value = normalizeCellValue(rawValue);

        const greenValues = [
          "iya",
          "ya",
          "yes",
          "sesuai",
          "aman",
          "baik",
          "ada & layak",
          "layak",
        ];

        const redValues = ["tidak", "no", "tidak ada", "belum", "tidak sesuai"];

        const yellowValues = ["n/a", "na", "n.a", "tidak berfungsi"];

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
        { key: "nrp", width: 24 },
        { key: "department", width: 24 },
        { key: "perusahaan", width: 24 },
        { key: "tanggal", width: 24 },
        { key: "jumlah_inspektor", width: 24 },

        { key: "opsi1", width: 55 },
        { key: "opsi2", width: 55 },
        { key: "opsi3", width: 55 },
        { key: "opsi4", width: 55 },
        { key: "opsi5", width: 55 },
        { key: "opsi6", width: 55 },
        { key: "opsi7", width: 55 },
        { key: "opsi8", width: 55 },
        { key: "opsi9", width: 55 },
        { key: "opsi10", width: 55 },
        { key: "opsi11", width: 55 },
        { key: "opsi12", width: 55 },
        { key: "opsi13", width: 55 },
        { key: "opsi14", width: 55 },
        { key: "opsi15", width: 55 },
        { key: "opsi16", width: 55 },
        { key: "opsi17", width: 55 },
        { key: "opsi18", width: 55 },
        { key: "opsi19", width: 55 },
        { key: "opsi20", width: 55 },
        { key: "opsi21", width: 55 },
        { key: "opsi22", width: 55 },
        { key: "opsi23", width: 55 },
        { key: "opsi24", width: 55 },
        { key: "opsi25", width: 55 },
        { key: "opsi26", width: 55 },

        { key: "ket_hasil", width: 60 },
        { key: "saran_masuk", width: 60 },
        { key: "status_inspeksi", width: 24 },
        { key: "created_at", width: 24 },
        { key: "site_name", width: 24 },
        { key: "foto_1", width: 24 },
        { key: "foto_2", width: 24 },
        { key: "foto_3", width: 24 },
        { key: "foto_4", width: 24 },
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
      titleCell.value = "LAPORAN EXPORT INSPEKSI PLANT";
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
        "Department",
        "Perusahaan",
        "Tanggal Inspeksi",
        "Jumlah Inspektor",

        "Praktek penumpukan & penyimpangan tertata dengan baik",
        "Furnitur Kantor & Ergonomi dalam kondisi baik",
        "Struktur : Atap, dinding, pintu, jendela, lantai, dll dalam kondisi baik",
        "Daerah berjalan / daerah bekerja tersedia demarkasi",
        "Toilet & kamar ganti bersih dan dilakukan perawatan",
        "Penerangan / ventilasi / Sistem Ekstraksi memadai dan cukup",
        "Housekeeping dilakukan dengan baik & kebersihan umum dilakukan secara rutin",
        "Rambu-rambu tanda & kode warna tersedia dan dipasang diarea kerja",
        "Jalan dan parkir mencukupi / kondisi baik dan rapi (Parkir Mundur)",
        "Pengamanan mesin dan penutup dilaksanakan",
        "Alat-alat lock out / Danger Tag tersedia dan karyawan melakukan LOTO setiap servis",
        "Pengaturan peralatan listrik termasuk Grounding sistem tersedia",
        "Pipa, Keran dan katup (Tidak ada kebocoran)",
        "Stairs / Platforms / Elevated Walkways / Handrails tersedia dan dilakukan pemeriksaan",
        "Overhead Cranes / Slings / Alat Angkat tersedia dan telah tersedia",
        "Penyimpanan silinder gas terkompresi / peralatan obor",
        "Penyimpanan dan Pengendalian bahan kimia berbahaya & beracun",
        "Perkakas tangan dan peralatan telah tersedia",
        "Inspeksi P2H & kondisi kendaraan dilaksanakan",
        "Alat Pelindung Diri digunakan ditempat kerja",
        "Tabir Las dipakai",
        "Tempat sampah mencukupi / dikosongkan secara berkala",
        "Sistem peringatan pergerakan (klakson / alarm) digunakan",
        "Perlindungan dan pencegahan kebakaran tersedia (APAR, Hydrant)",
        "Tempat berkumpul darurat dan alarm tersedia dan berfungsi",
        "Peralatan pertolongan pertama tersedia dan tercukupi",

        "Keterangan Hasil",
        "Saran Masuk",
        "Status Inspeksi",
        "Tanggal Dibuat",
        "Site",
        "Foto 1",
        "Foto 2",
        "Foto 3",
        "Foto 4",
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
        8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
        26, 27, 28, 29, 30, 31, 32, 33, 36,
      ];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];

        const excelRow = worksheet.addRow([
          i + 1,
          row.nama ?? "-",
          row.nrp ?? "-",
          row.department ?? "-",
          row.perusahaan ?? "-",
          formatDateOnly(row.tanggal),
          row.jumlah_inspektor ?? "-",

          row.opsi1 ?? "-",
          row.opsi2 ?? "-",
          row.opsi3 ?? "-",
          row.opsi4 ?? "-",
          row.opsi5 ?? "-",
          row.opsi6 ?? "-",
          row.opsi7 ?? "-",
          row.opsi8 ?? "-",
          row.opsi9 ?? "-",
          row.opsi10 ?? "-",
          row.opsi11 ?? "-",
          row.opsi12 ?? "-",
          row.opsi13 ?? "-",
          row.opsi14 ?? "-",
          row.opsi15 ?? "-",
          row.opsi16 ?? "-",
          row.opsi17 ?? "-",
          row.opsi18 ?? "-",
          row.opsi19 ?? "-",
          row.opsi20 ?? "-",
          row.opsi21 ?? "-",
          row.opsi22 ?? "-",
          row.opsi23 ?? "-",
          row.opsi24 ?? "-",
          row.opsi25 ?? "-",
          row.opsi26 ?? "-",

          row.ket_hasil ?? "-",
          row.saran_masuk ?? "-",
          row.status_inspeksi ?? "-",
          formatDateTime(row.created_at),
          row.site_name ?? "-",
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
              colNumber === 3 ||
              colNumber === 6 ||
              colNumber === 7 ||
              colNumber === 34 ||
              colNumber === 35
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

        const fotoFields = [row.foto1, row.foto2, row.foto3, row.foto4];

        for (let j = 0; j < 4; j++) {
          const foto = fotoFields[j];
          const fotoCell = excelRow.getCell(39 + j);

          const baseUrl = (process.env.PUBLIC_BASE_URL || "").replace(
            /\/$/,
            "",
          );

          if (foto) {
            const fotoUrl = `${baseUrl}/uploads/${encodeURIComponent(foto)}`;

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

        const statusCell = excelRow.getCell(36);
        const statusValue = (row.status_inspeksi || "")
          .toString()
          .toLowerCase()
          .trim();

        if (
          statusValue.includes("tidak") ||
          statusValue.includes("belum") ||
          statusValue.includes("tidak sesuai")
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
          statusValue.includes("iya")
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
        [req.user.id, req.user.site_id, "inspeksi_plant"],
      );
    } catch (err) {
      console.error("INSPEKSI PLANT EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      } else {
        return res.end();
      }
    }
  },
);

module.exports = router;