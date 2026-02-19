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

    // SUPERADMIN → NO FILTER

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("LPI GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
