const express = require("express");
const router = express.Router();
const pool = require("../../config/db");
const multer = require("multer");
const authMiddleware = require("../../middlewares/auth.middleware");
const fs = require("fs");

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

        hm_unit,
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

        alat_keselamatan_air1,
        alat_keselamatan_air2,
        alat_keselamatan_air3,
        alat_keselamatan_air4,

        unit_aman,
      } = req.body;

      const site_id = parseInt(req.user.site_id);
      
      const files = req.files.map(f => f.filename);

      const query = `
        INSERT INTO p2h_water_pump (
          nama, jabatan, department, perusahaan, tanggal,
          hm_unit, no_lambung_unit, shift_kerja,

          opsi_item1, opsi_item2, opsi_item3, opsi_item4, opsi_item5,
          opsi_item6, opsi_item7, opsi_item8, opsi_item9, opsi_item10,
          opsi_item11, opsi_item12, opsi_item13, opsi_item14, opsi_item15,
          opsi_item16, opsi_item17, opsi_item18, opsi_item19, opsi_item20,

          alat_keselamatan_air1,
          alat_keselamatan_air2,
          alat_keselamatan_air3,
          alat_keselamatan_air4,

          unit_aman,
          files,
          site_id
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,

          $9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,
          $24,$25,$26,$27,$28,

          $29,$30,$31,$32,

          $33,
          $34,
          $35
        )
      `;

      await pool.query(query, [
        nama,
        jabatan,
        department,
        perusahaan,
        tanggal,

        hm_unit,
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

        alat_keselamatan_air1,
        alat_keselamatan_air2,
        alat_keselamatan_air3,
        alat_keselamatan_air4,

        unit_aman,
        JSON.stringify(files),
        site_id,
      ]);

    return res.status(201).json({
          success: true,
          uploaded_files: files.length,
        });

      } catch (e) {
        console.error("P2H WATER PUMP POST ERROR:", e);
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

    let query = `SELECT * FROM p2h_water_pump`;
    const params = [];

    if (role === "admin") {
      query += " WHERE site_id = $1";
      params.push(site_id);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("P2H WATER PUMP GET ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
