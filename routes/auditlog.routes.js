const express = require("express");
const router = express.Router();
const pool = require("../config/db");

const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/role.middleware");
const ExcelJS = require("exceljs");
const auditMiddleware = require("../middlewares/audit.middleware");

router.get(
  "/",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        100
      );
      const offset = (page - 1) * limit;

      const selectedSiteId = req.query.site_id
        ? parseInt(req.query.site_id, 10)
        : null;

      const search = (req.query.search || "").toString().trim();
      const dateFrom = req.query.date_from || null;
      const dateTo = req.query.date_to || null;

      const whereParts = [];
      const params = [];

      // Admin hanya boleh lihat site sendiri
      if (role === "admin") {
        params.push(site_id);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      // Superadmin boleh filter site tertentu
      if (role === "superadmin" && selectedSiteId) {
        params.push(selectedSiteId);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      // Search server-side
      if (search !== "") {
        params.push(`%${search.toLowerCase()}%`);
        const idx = params.length;

        whereParts.push(`
          (
            LOWER(COALESCE(al.user_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.user_role, '')) LIKE $${idx}
            OR LOWER(COALESCE(s.site_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(d.department_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.action, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.module, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.method, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.endpoint, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.description, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.ip_address, '')) LIKE $${idx}
          )
        `);
      }

      // Date filter
      if (dateFrom) {
        params.push(dateFrom);
        whereParts.push(`al.created_at >= $${params.length}`);
      }

      if (dateTo) {
        params.push(dateTo);
        whereParts.push(`al.created_at < $${params.length}`);
      }

      const where =
        whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

      // Query total data
      const countResult = await pool.query(
        `
        SELECT COUNT(*)::int AS total
        FROM audit_logs al
        LEFT JOIN sites s ON s.id = al.site_id
        LEFT JOIN departments d ON d.id = al.department_id
        ${where}
        `,
        params
      );

      const total = countResult.rows[0]?.total || 0;

      // Query data per halaman
      const dataParams = [...params];

      dataParams.push(limit);
      const limitIndex = dataParams.length;

      dataParams.push(offset);
      const offsetIndex = dataParams.length;

      const result = await pool.query(
        `
        SELECT
          al.id,
          al.user_id,
          al.user_name,
          al.user_role,
          al.site_id,
          COALESCE(s.site_name, '-') AS site_name,
          al.department_id,
          COALESCE(d.department_name, '-') AS department_name,
          al.action,
          al.module,
          al.method,
          al.endpoint,
          al.description,
          al.response_status,
          al.ip_address,
          al.device_id,
          al.user_agent,
          al.created_at
        FROM audit_logs al
        LEFT JOIN sites s ON s.id = al.site_id
        LEFT JOIN departments d ON d.id = al.department_id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
        `,
        dataParams
      );

      return res.json({
        data: result.rows,
        meta: {
          page,
          limit,
          total,
          total_page: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error("GET AUDIT LOG ERROR:", err);
      return res.status(500).json({ message: "Gagal mengambil audit log" });
    }
  }
);

router.get(
  "/export.xlsx",
  authMiddleware,
  allowRoles("admin", "superadmin"),
  auditMiddleware("Audit Log"),
  async (req, res) => {
    try {
      const { role, site_id } = req.user;

      // ===== Rate limit export seperti pola Buletin =====
      const lastExport = await pool.query(
        `
        SELECT exported_at
        FROM export_logs
        WHERE user_id = $1 AND feature = $2
        ORDER BY exported_at DESC
        LIMIT 1
        `,
        [req.user.id, "audit_log"]
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

      const selectedSiteId = req.query.site_id
        ? parseInt(req.query.site_id, 10)
        : null;

      const search = (req.query.search || "").toString().trim();
      const dateFrom = req.query.date_from || req.query.start || null;
      const dateTo = req.query.date_to || req.query.end || null;

      const whereParts = [];
      const params = [];

      // Admin hanya boleh export site sendiri
      if (role === "admin") {
        params.push(site_id);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      // Superadmin boleh export semua site atau site tertentu
      if (role === "superadmin" && selectedSiteId) {
        params.push(selectedSiteId);
        whereParts.push(`al.site_id = $${params.length}`);
      }

      if (search !== "") {
        params.push(`%${search.toLowerCase()}%`);
        const idx = params.length;

        whereParts.push(`
          (
            LOWER(COALESCE(al.user_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.user_role, '')) LIKE $${idx}
            OR LOWER(COALESCE(s.site_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(d.department_name, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.action, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.module, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.method, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.endpoint, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.description, '')) LIKE $${idx}
            OR LOWER(COALESCE(al.ip_address, '')) LIKE $${idx}
          )
        `);
      }

      if (dateFrom) {
        params.push(dateFrom);
        whereParts.push(`al.created_at >= $${params.length}`);
      }

      if (dateTo) {
        params.push(dateTo);
        whereParts.push(`al.created_at < $${params.length}`);
      }

      const where =
        whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

      const result = await pool.query(
        `
        SELECT
          al.id,
          al.user_id,
          al.user_name,
          al.user_role,
          al.site_id,
          COALESCE(s.site_name, '-') AS site_name,
          al.department_id,
          COALESCE(d.department_name, '-') AS department_name,
          al.action,
          al.module,
          al.method,
          al.endpoint,
          al.description,
          al.response_status,
          al.ip_address,
          al.device_id,
          al.user_agent,
          al.created_at
        FROM audit_logs al
        LEFT JOIN sites s ON s.id = al.site_id
        LEFT JOIN departments d ON d.id = al.department_id
        ${where}
        ORDER BY al.created_at DESC
        `,
        params
      );

      const MAX_EXPORT_ROWS = 50000;

      if (result.rows.length > MAX_EXPORT_ROWS) {
        return res.status(400).json({
          message: `Data terlalu besar (${result.rows.length} rows). Maksimal ${MAX_EXPORT_ROWS} rows.`,
        });
      }

      const now = new Date();
      const formattedDate = now
        .toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })
        .replace(/\//g, "-");

      const exportFileName = `AUDIT_LOG_${formattedDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${exportFileName}"`
      );

      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      });

      const worksheet = workbook.addWorksheet("Audit Log Export");
      worksheet.views = [{ state: "frozen", ySplit: 4 }];

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

      function applyRoleChip(cell, rawValue) {
        const value = normalizeCellValue(rawValue);

        const styles = {
          superadmin: {
            fill: "FFDCFCE7",
            font: "FF166534",
          },
          admin: {
            fill: "FFFEF3C7",
            font: "FF92400E",
          },
          member: {
            fill: "FFDBEAFE",
            font: "FF1D4ED8",
          },
        };

        const style = styles[value];
        if (!style) return;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: style.fill },
        };

        cell.font = {
          bold: true,
          size: 10,
          color: { argb: style.font },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      }

      function applyActionStyle(cell, rawValue) {
        const value = normalizeCellValue(rawValue);

        let fill = "FFF3F4F6";
        let font = "FF374151";

        if (value.includes("delete") || value.includes("failed")) {
          fill = "FFFEE2E2";
          font = "FF991B1B";
        } else if (value.includes("login") || value.includes("post")) {
          fill = "FFDCFCE7";
          font = "FF166534";
        } else if (value.includes("put")) {
          fill = "FFFFEDD5";
          font = "FFC2410C";
        } else if (value.includes("export")) {
          fill = "FFF3E8FF";
          font = "FF6B21A8";
        } else if (value.includes("get")) {
          fill = "FFDBEAFE";
          font = "FF1D4ED8";
        }

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fill },
        };

        cell.font = {
          bold: true,
          size: 10,
          color: { argb: font },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      }

      function applyStatusStyle(cell, rawValue) {
        const status = Number(rawValue);

        let fill = "FFF3F4F6";
        let font = "FF374151";

        if (!Number.isNaN(status)) {
          if (status >= 200 && status < 300) {
            fill = "FFDCFCE7";
            font = "FF166534";
          } else if (status >= 400) {
            fill = "FFFEE2E2";
            font = "FF991B1B";
          } else {
            fill = "FFFEF3C7";
            font = "FF92400E";
          }
        }

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fill },
        };

        cell.font = {
          bold: true,
          size: 10,
          color: { argb: font },
        };

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      }

      worksheet.columns = [
        { key: "no", width: 8 },
        { key: "created_at", width: 24 },
        { key: "user_name", width: 28 },
        { key: "user_role", width: 18 },
        { key: "site_name", width: 24 },
        { key: "department_name", width: 28 },
        { key: "action", width: 20 },
        { key: "module", width: 24 },
        { key: "method", width: 14 },
        { key: "endpoint", width: 38 },
        { key: "response_status", width: 16 },
        { key: "ip_address", width: 22 },
        { key: "device_id", width: 32 },
        { key: "user_agent", width: 55 },
        { key: "description", width: 60 },
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
      titleCell.value = "LAPORAN EXPORT AUDIT LOG";
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

      const headerRow = worksheet.addRow([
        "No",
        "Tanggal dan Waktu",
        "User",
        "Role",
        "Site",
        "Department",
        "Action",
        "Akses",
        "Method",
        "Endpoint",
        "Status",
        "IP Address",
        "Device ID",
        "User Agent",
        "Description",
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

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows[i];

        const excelRow = worksheet.addRow([
          i + 1,
          formatDateTime(row.created_at),
          row.user_name ?? "-",
          row.user_role ?? "-",
          row.site_name ?? "-",
          row.department_name ?? "-",
          row.action ?? "-",
          row.module ?? "-",
          row.method ?? "-",
          row.endpoint ?? "-",
          row.response_status ?? "-",
          row.ip_address ?? "-",
          row.device_id ?? "-",
          row.user_agent ?? "-",
          row.description ?? "-",
        ]);

        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "middle",
            horizontal:
              colNumber === 1 ||
              colNumber === 2 ||
              colNumber === 4 ||
              colNumber === 7 ||
              colNumber === 9 ||
              colNumber === 11
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

        applyRoleChip(excelRow.getCell(4), row.user_role);
        applyActionStyle(excelRow.getCell(7), row.action);
        applyStatusStyle(excelRow.getCell(11), row.response_status);

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

        excelRow.commit();
      }

      worksheet.commit();
      await workbook.commit();

      await pool.query(
        `
        INSERT INTO export_logs (user_id, site_id, feature)
        VALUES ($1, $2, $3)
        `,
        [req.user.id, req.user.site_id, "audit_log"]
      );
    } catch (err) {
      console.error("AUDIT LOG EXPORT XLSX ERROR:", err);

      if (!res.headersSent) {
        return res.status(500).json({ message: "Export failed" });
      }

      return res.end();
    }
  }
);

module.exports = router;