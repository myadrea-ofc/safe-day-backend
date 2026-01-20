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


module.exports = router;
