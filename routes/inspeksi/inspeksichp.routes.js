const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const multer = require("multer");
const authMiddleware = require("../../middlewares/auth.middleware");
const fs = require("fs");

// === MULTER ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "foto1" },
    { name: "foto2" },
    { name: "foto3" },
    { name: "foto4" },
  ]),
  async (req, res) => {
    try {
        console.log("===== INSPEKSI CHP REQUEST MASUK =====");
        console.log("BODY:", req.body);
        console.log("FILES:", req.files);
        console.log("USER:", req.user);

      const {
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

        ket_hasil,
        saran_masuk,
        status_inspeksi,
      } = req.body;

      const site_id = parseInt(req.user.site_id);

      const foto1 = req.files?.foto1?.[0]?.filename || null;
      const foto2 = req.files?.foto2?.[0]?.filename || null;
      const foto3 = req.files?.foto3?.[0]?.filename || null;
      const foto4 = req.files?.foto3?.[0]?.filename || null;


      const query = `
INSERT INTO inspeksi_chp (
  nama, nrp, department, perusahaan, tanggal, jumlah_inspektor,

  opsi1, opsi2, opsi3, opsi4, opsi5,
  opsi6, opsi7, opsi8, opsi9, opsi10,
  opsi11, opsi12, opsi13, opsi14, opsi15,
  opsi16, opsi17, opsi18, opsi19, opsi20,

  ket_hasil, saran_masuk, status_inspeksi,

  foto1, foto2, foto3, foto4,
  site_id
)
VALUES (
  $1,$2,$3,$4,$5,$6,

  $7,$8,$9,$10,$11,
  $12,$13,$14,$15,$16,
  $17,$18,$19,$20,$21,
  $22,$23,$24,$25,$26,

  $27,$28,$29,

  $30,$31,$32,$33,
  $34
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

        opsi1, opsi2, opsi3, opsi4, opsi5,
        opsi6, opsi7, opsi8, opsi9, opsi10,
        opsi11, opsi12, opsi13, opsi14, opsi15,
        opsi16, opsi17, opsi18, opsi19, opsi20,

        ket_hasil,
        saran_masuk,
        status_inspeksi,

        foto1,
        foto2,
        foto3,
        foto4,

        site_id
      ];

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: "Data Inspeksi CHP berhasil disimpan",
        id: result.rows[0].id,
      });
    } catch (error) {
      console.error("INSPEKSI CHP ERROR:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT *
      FROM inspeksi_chp
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
    console.error("INSPEKSI CHP GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
