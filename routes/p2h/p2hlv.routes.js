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

module.exports = router;
