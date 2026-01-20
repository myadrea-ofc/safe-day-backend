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
    { name: "foto1" },
    { name: "foto2" },
    { name: "foto3" },
  ]),
  async (req, res) => {
    try {
      console.log("Body:", req.body);
      console.log("User Site ID:", req.user.site_id);

      const {
        nama, id_karyawan, perusahaan, jabatan, department,
        lokasi_temuan, tanggal, waktu, jenis_temuan, 
        narasi_temuan, info_perbaikan, status_sesuai,
      } = req.body;

      // Ambil site_id dari token JWT melalui middleware
      const site_id = parseInt(req.user.site_id); 

      // Ambil nama file foto jika ada
      const foto1 = req.files?.foto1?.[0]?.filename || null;
      const foto2 = req.files?.foto2?.[0]?.filename || null;
      const foto3 = req.files?.foto3?.[0]?.filename || null;

      const query = `
        INSERT INTO hazard (
          nama,           -- $1
          id_karyawan,    -- $2
          perusahaan,     -- $3
          jabatan,        -- $4
          department,     -- $5
          lokasi_temuan,  -- $6
          tanggal,        -- $7
          waktu,          -- $8
          jenis_temuan,   -- $9
          narasi_temuan,  -- $10
          foto1_path,     -- $11
          foto2_path,     -- $12
          foto3_path,     -- $13
          info_perbaikan, -- $14
          status_sesuai,  -- $15
          site_id         -- $16
        ) VALUES (
          $1, $2, $3, $4, $5, 
          $6, $7, $8, $9, $10, 
          $11, $12, $13, $14, $15, $16
        ) RETURNING id
      `;

      const values = [
        nama || null,          
        id_karyawan || null,   
        perusahaan || null,    
        jabatan || null,       
        department || null,    
        lokasi_temuan || null, 
        tanggal || null,       
        waktu || null,         
        jenis_temuan || null,  
        narasi_temuan || null,  
        foto1,                  
        foto2,                  
        foto3,                  
        info_perbaikan || null, 
        status_sesuai || null,  
        site_id                
      ];

      const result = await pool.query(query, values);

      res.status(201).json({
        success: true,
        message: "Data Hazard berhasil disimpan",
        id: result.rows[0].id,
      });

    } catch (error) {
      console.error("HAZARD PG ERROR:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, site_id } = req.user;

    let query = `
      SELECT
        id, nama, id_karyawan, perusahaan, jabatan, department,
          lokasi_temuan, tanggal, waktu, jenis_temuan, narasi_temuan,
          foto1_path, foto2_path, foto3_path, info_perbaikan, site_id, status_sesuai
      FROM hazard
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
