const { sendLpiNotification } = require("../services/notification.services"); 

const express = require("express");
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

const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const ExcelJS = require("exceljs");

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
    { name: "file", maxCount: 1 },
    { name: "foto", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const {
        nama,
        perusahaan,
        department,
        tanggal,
        waktu,
        nama_korban,
        jabatan_korban,
        nama_spv,
        department_spv,
        jenis_aset_perusahaan,
        nama_saksi,
        jabatan_saksi,
        department_saksi,
        klasifikasi_insiden,
        kronologi,
        status_lokasi,
      } = req.body;

      const site_id = req.user.site_id;

      const file_path = req.files?.file?.[0]?.filename || null;
      const foto_paths = req.files?.foto ? req.files.foto.map((f) => f.filename) : [];

      const insertRes = await pool.query(
        `
        INSERT INTO lpi (
          nama, perusahaan, department, tanggal, waktu,
          nama_korban, jabatan_korban, nama_spv, department_spv,
          jenis_aset_perusahaan, nama_saksi, jabatan_saksi,
          department_saksi, klasifikasi_insiden, kronologi,
          file_path, foto_paths, status_lokasi, site_id
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,
          $10,$11,$12,
          $13,$14,$15,
          $16,$17,$18,$19
        )
        RETURNING id
        `,
        [
          nama,
          perusahaan,
          department,
          tanggal,
          waktu,
          nama_korban,
          jabatan_korban,
          nama_spv,
          department_spv,
          jenis_aset_perusahaan,
          nama_saksi,
          jabatan_saksi,
          department_saksi,
          klasifikasi_insiden,
          kronologi,
          file_path,
          JSON.stringify(foto_paths),
          status_lokasi,
          site_id,
        ]
      );

      const lpiId = insertRes.rows?.[0]?.id;

      // notif tidak boleh menggagalkan submit
      if (lpiId) {
        try {
          const senderName =
            req.user.name || req.user.full_name || req.user.username || nama || "User";

          await sendLpiNotification({
            creatorId: req.user.id,
            siteId: site_id,
            senderName,
            lpiId,
          });
        } catch (notifErr) {
          console.error("⚠️ LPI notif error (ignored):", notifErr);
        }
      } else {
        console.error("❌ LPI inserted but lpiId is null");
      }

      return res.status(200).json({
        message: "LPI berhasil disimpan",
        id: lpiId,
      });
    } catch (err) {
      console.error("LPI POST ERROR:", err);
      return res.status(500).json({ message: "Server error" });
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
        tanggal,
        waktu,
        nama_korban,
        jabatan_korban,
        nama_spv,
        department_spv,
        jenis_aset_perusahaan,
        nama_saksi,
        jabatan_saksi,
        department_saksi,
        klasifikasi_insiden,
        kronologi,
        file_path,
        foto_paths,
        status_lokasi,
        created_at,
        site_id
      FROM lpi
    `;

    const params = [];

    // 🔐 ADMIN → FILTER SITE
    if (role === "admin") {
      query += " WHERE site_id = $1";
      params.push(site_id);
    }


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
  ensureExcelDownloadAccess("lpi"),
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
        [req.user.id, "lpi"]
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
          l.id,
          l.nama,
          l.perusahaan,
          l.department,
          l.tanggal,
          l.waktu,
          l.nama_korban,
          l.jabatan_korban,
          l.nama_spv,
          l.department_spv,
          l.jenis_aset_perusahaan,
          l.nama_saksi,
          l.jabatan_saksi,
          l.department_saksi,
          l.klasifikasi_insiden,
          l.kronologi,
          l.file_path,
          l.foto_paths,
          l.status_lokasi,
          l.created_at,
          l.site_id,
          s.site_name
        FROM lpi l
        LEFT JOIN sites s ON s.id = l.site_id
      `;

      const params = [];
      const where = [];

      if (role === "admin") {
        where.push(`l.site_id = $${params.length + 1}`);
        params.push(site_id);
      }

      if (start) {
        where.push(`l.created_at >= $${params.length + 1}`);
        params.push(start);
      }

      if (end) {
        where.push(`l.created_at < $${params.length + 1}`);
        params.push(end);
      }

      if (where.length) {
        query += ` WHERE ${where.join(" AND ")}`;
      }

      query += ` ORDER BY l.created_at DESC`;

      const result = await pool.query(query, params);

      const MAX_EXPORT_ROWS = 50000;
      if (result.rows.length > MAX_EXPORT_ROWS) {
        return res.status(400).json({
          message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
        });
      }

      const now = new Date();
      const fileName = `LPI_${Date.now()}.xlsx`;

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

      const worksheet = workbook.addWorksheet("LPI Export");
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

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

          // kalau format jam dari DB sudah string, pakai langsung
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

      worksheet.columns = [
        { key: "no", width: 8 },
        { key: "nama", width: 22 },
        { key: "perusahaan", width: 24 },
        { key: "department", width: 20 },
        { key: "tanggal", width: 16 },
        { key: "waktu", width: 14 },
        { key: "nama_korban", width: 24 },
        { key: "jabatan_korban", width: 20 },
        { key: "nama_spv", width: 24 },
        { key: "department_spv", width: 20 },
        { key: "jenis_aset_perusahaan", width: 28 },
        { key: "nama_saksi", width: 24 },
        { key: "jabatan_saksi", width: 20 },
        { key: "department_saksi", width: 20 },
        { key: "klasifikasi_insiden", width: 24 },
        { key: "kronologi", width: 40 },
        { key: "status_lokasi", width: 18 },
        { key: "created_at", width: 22 },
        { key: "site_name", width: 18 },
        { key: "file_path", width: 20 },
        { key: "foto_1", width: 18 },
        { key: "foto_2", width: 18 },
        { key: "foto_3", width: 18 },
        { key: "foto_4", width: 18 },
        { key: "foto_5", width: 18 },
      ];

      // ===== TITLE ROW =====
      worksheet.mergeCells("A1:Y1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "LAPORAN EXPORT LPI";
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
      worksheet.mergeCells("A2:Y2");
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
        "Perusahaan",
        "Department",
        "Tanggal",
        "Waktu",
        "Nama Korban",
        "Jabatan Korban",
        "Nama SPV",
        "Department SPV",
        "Jenis Aset Perusahaan",
        "Nama Saksi",
        "Jabatan Saksi",
        "Department Saksi",
        "Klasifikasi Insiden",
        "Kronologi",
        "Status Lokasi",
        "Tanggal Dibuat",
        "Site",
        "File",
        "Foto 1",
        "Foto 2",
        "Foto 3",
        "Foto 4",
        "Foto 5",
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

        const fileUrl = row.file_path
          ? `http://safety.borneo.co.id/uploads/${encodeURIComponent(
              row.file_path
            )}`
          : null;

        let fotoList = [];
        try {
          fotoList = row.foto_paths
            ? Array.isArray(row.foto_paths)
              ? row.foto_paths
              : JSON.parse(row.foto_paths)
            : [];
        } catch (_) {
          fotoList = [];
        }

        const excelRow = worksheet.addRow([
          i + 1,
          row.nama ?? "-",
          row.perusahaan ?? "-",
          row.department ?? "-",
          formatDateOnly(row.tanggal),
          formatTimeOnly(row.waktu),
          row.nama_korban ?? "-",
          row.jabatan_korban ?? "-",
          row.nama_spv ?? "-",
          row.department_spv ?? "-",
          row.jenis_aset_perusahaan ?? "-",
          row.nama_saksi ?? "-",
          row.jabatan_saksi ?? "-",
          row.department_saksi ?? "-",
          row.klasifikasi_insiden ?? "-",
          row.kronologi ?? "-",
          row.status_lokasi ?? "-",
          formatDateTime(row.created_at),
          row.site_name ?? "-",
          "",
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
              colNumber === 5 ||
              colNumber === 6 ||
              colNumber === 17 ||
              colNumber === 18
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

        // hyperlink file
        const fileCell = excelRow.getCell(20);
        if (fileUrl) {
          fileCell.value = {
            text: "Lihat File",
            hyperlink: fileUrl,
            tooltip: "Buka file",
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

        // hyperlink foto 1..10
        for (let j = 0; j < 5; j++) {
          const foto = fotoList[j];
          const fotoCell = excelRow.getCell(21 + j);

          if (foto) {
            const fotoUrl = `http://safety.borneo.co.id/uploads/${encodeURIComponent(
              foto
            )}`;

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

        // conditional color: Status Lokasi
        const statusLokasiCell = excelRow.getCell(17);
        const statusLokasiValue = (row.status_lokasi || "")
          .toString()
          .toLowerCase()
          .trim();

        if (
          statusLokasiValue.includes("tidak aman") ||
          statusLokasiValue.includes("bahaya") ||
          statusLokasiValue.includes("darurat") ||
          statusLokasiValue.includes("rusak")
        ) {
          statusLokasiCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          statusLokasiCell.font = {
            bold: true,
            color: { argb: "FF991B1B" },
            size: 10,
          };
          statusLokasiCell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        } else if (
          statusLokasiValue.includes("aman") ||
          statusLokasiValue.includes("normal") ||
          statusLokasiValue.includes("baik")
        ) {
          statusLokasiCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          };
          statusLokasiCell.font = {
            bold: true,
            color: { argb: "FF166534" },
            size: 10,
          };
          statusLokasiCell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        }

        excelRow.commit();
      }

      worksheet.commit();

      await workbook.commit();

await pool.query(`
  INSERT INTO export_logs (user_id, site_id, feature)
  VALUES ($1, $2, $3)
`, [req.user.id, req.user.site_id, "lpi"]);

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
