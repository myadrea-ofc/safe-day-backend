require("dotenv").config();
const pool = require("./config/db");

const authMiddleware = require("./middlewares/auth.middleware");
const allowRoles = require("./middlewares/role.middleware");

const siteDepartmentMiddleware = require(
  "./middlewares/siteDepartmentMiddleware"
);

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
const multer = require("multer");
const bcrypt = require("bcryptjs");


const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ping endpoint untuk health check
app.get("/ping", (req, res) => {
  res.json({ message: "pong123" });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const eventRoutes = require("./routes/event.routes");
const userRoutes = require("./routes/user.routes");

const lpiRoutes = require("./routes/lpi.routes");
const hazardRoutes = require("./routes/hazard.routes");
const p5mRoutes = require("./routes/p5m.routes");

const inspeksiJalanTambangRoutes = require ("./routes/inspeksi/inspeksijalantambang.routes");
const inspeksikantor = require ("./routes/inspeksi/inspeksikantor.routes");
const inspeksimtd = require ("./routes/inspeksi/inspeksimtd.routes");
const inspeksiplant = require ("./routes/inspeksi/inspeksiplant.routes");
const inspeksichp = require ("./routes/inspeksi/inspeksichp.routes");
const inspeksifasilitasbbm = require ("./routes/inspeksi/inspeksifasilitasbbm.routes");

const p2hlv = require ("./routes/p2h/p2hlv.routes");
const p2hbus = require ("./routes/p2h/p2hbus.routes");
const p2hdt = require ("./routes/p2h/p2hdt.routes");
const p2hexca = require ("./routes/p2h/p2hexca.routes");
const p2hdozer = require ("./routes/p2h/p2hdozer.routes");
const p2hgrader = require ("./routes/p2h/p2hgrader.routes");
const p2htowerlamp = require ("./routes/p2h/p2htowerlamp.routes");
const p2hcrane = require ("./routes/p2h/p2hcrane.routes");
const p2hforklift = require ("./routes/p2h/p2hforklift.routes");
const p2htruck = require ("./routes/p2h/p2htruck.routes");
const p2hwheelloader = require ("./routes/p2h/p2hwheelloader.routes");
const p2hwatertruck = require ("./routes/p2h/p2hwatertruck.routes");
const p2hwaterpump = require ("./routes/p2h/p2hwaterpump.routes");
const p2hservicetruck = require ("./routes/p2h/p2hservicetruck.routes");
const p2hcompactor = require ("./routes/p2h/p2hcompactor.routes");
const p2hfueltruck = require ("./routes/p2h/p2hfueltruck.routes");

const dailyPlanRoutes = require("./routes/event/hsesdailyplan.routes");
const buletinRoutes = require("./routes/event/hsesbuletin.routes");

const authRoutes = require("./routes/auth.routes");

app.use("/auth", authRoutes);

app.use("/api/events", eventRoutes);
app.use("/users", userRoutes);

app.use("/lpi", lpiRoutes);
app.use("/hazard", hazardRoutes);
app.use("/p5m", p5mRoutes);

app.use("/inspeksi_jalan_tambang", inspeksiJalanTambangRoutes);
app.use("/inspeksi_kantor", inspeksikantor);
app.use("/inspeksi_mtd", inspeksimtd);
app.use("/inspeksi_plant", inspeksiplant);
app.use("/inspeksi_chp", inspeksichp);
app.use("/inspeksi_fasilitas_bbm", inspeksifasilitasbbm);

app.use("/p2h_lv", p2hlv);
app.use("/p2h_bus", p2hbus);
app.use("/p2h_dt", p2hdt);
app.use("/p2h_exca", p2hexca);
app.use("/p2h_dozer", p2hdozer);
app.use("/p2h_grader", p2hgrader);
app.use("/p2h_towerlamp", p2htowerlamp);
app.use("/p2h_crane", p2hcrane);
app.use("/p2h_forklift", p2hforklift);
app.use("/p2h_truck", p2htruck);
app.use("/p2h_wheelloader", p2hwheelloader);
app.use("/p2h_water_truck", p2hwatertruck);
app.use("/p2h_water_pump", p2hwaterpump);
app.use("/p2h_service_truck", p2hservicetruck);
app.use("/p2h_compactor", p2hcompactor);
app.use("/p2h_fuel_truck", p2hfueltruck);


app.use("/hses_daily_plan", dailyPlanRoutes);
app.use("/hses_buletin", buletinRoutes);


app.post("/login", async (req, res) => {
  try {
    const { name, password, site_id, department_id, device_id } = req.body;

    if (!name || !password || !site_id || !department_id || !device_id) {
      return res.status(400).json({ message: "Data login tidak lengkap" });
    }

    // Cari user
    const result = await pool.query(
      `
      SELECT u.id, u.name, u.password,
             u.role_id, r.role_name,
             u.site_id, u.department_id
      FROM users u
      JOIN roles r ON r.id = u.role_id
       WHERE trim(upper(u.name)) = trim(upper($1))
        AND u.site_id = $2
        AND u.department_id = $3
        AND u.deleted_at IS NULL
      `,
      [name, site_id, department_id]
    );

    console.log("LOGIN CHECK:", {
  name,
  site_id,
  department_id,
});


    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "User / site / department tidak cocok",
      });
    }

    const user = result.rows[0];

    // Cek password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah" });
    }

    await pool.query(
      `
      UPDATE user_sessions
      SET is_active = false,
          logout_at = NOW(),
          expired_at = NOW()
      WHERE user_id = $1
        AND is_active = true
      `,
      [user.id]
    );

    // Generate token baru
    const token = jwt.sign(
      {
        id: user.id,
        role_id: user.role_id,
        role: user.role_name,
        site_id: user.site_id,
        department_id: user.department_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "3d" }
    );

    // Simpan session baru
    await pool.query(
  `
  INSERT INTO user_sessions
  (user_id, token, device_id, is_active, expired_at, last_seen)
  VALUES ($1, $2, $3, true, NOW() + INTERVAL '3 days', NOW())
  `,
  [user.id, token, device_id]
);


    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role_name,
        site_id: user.site_id,
        department_id: user.department_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login gagal" });
  }
});

app.post("/logout", authMiddleware, async (req, res) => {
  try {
    const token = req.token; // ambil dari middleware

    const result = await pool.query(`
      UPDATE user_sessions
      SET is_active = false,
          logout_at = NOW(),
          expired_at = NOW()
      WHERE token = $1
        AND is_active = true
    `, [token]);

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "Session tidak ditemukan / sudah logout"
      });
    }

    return res.json({ message: "Logout berhasil" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Logout gagal" });
  }
});


app.get("/sites", async (req, res) => {
  try {
    console.log("🔥 HIT /sites");

    const result = await pool.query(
      `SELECT id, site_name
       FROM sites
       WHERE deleted_at IS NULL
       ORDER BY site_name ASC`
    );

    res.json(result.rows.map(r => ({ id: r.id, name: r.site_name })));
  } catch (err) {
    console.error("ERROR GET /sites:", err);
    res.status(500).json({ message: "Gagal mengambil sites", error: err.message });
  }
});

app.get("/departments", async (req, res) => {
  const { site_id } = req.query;

  if (!site_id) {
    return res.status(400).json({ message: "site_id wajib diisi" });
  }

  try {
    const result = await pool.query(
      `SELECT id, department_name
       FROM departments
       WHERE site_id = $1
       ORDER BY department_name ASC`,
      [site_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ERROR GET /departments:", err);
    res.status(500).json({ message: "Gagal mengambil department" });
  }
});



setInterval(async () => {
  try {
    await pool.query(`
      UPDATE user_sessions
      SET is_active = false,
          logout_at = NOW(),
          logout_reason = 'inactive'
      WHERE is_active = true
        AND last_seen < NOW() - INTERVAL '3 days'
    `);

    console.log("🛑 Session inactive dimatikan");
  } catch (err) {
    console.error("Auto logout error:", err);
  }
}, 1000 * 60 * 5); 



const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


