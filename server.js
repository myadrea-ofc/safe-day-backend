require("dotenv").config();
const pool = require("./config/db");

const rateLimit = require("express-rate-limit");
const forgotPasswordRoutes = require("./routes/forgotpassword.routes");
const mustChangePasswordGuard = require("./middlewares/mustChangePassword.middleware");

const authMiddleware = require("./middlewares/auth.middleware");
const { sendLoginOtpEmail } = require("../backend/config/mailer");

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

const forgotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 20,             // 20 request per IP per menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak request. Coba lagi sebentar." }
});

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

const notificationRoutes = require("./routes/notification.routes")



app.use("/auth", authRoutes);

app.use("/api/events", eventRoutes);
app.use("/forgot-password", forgotLimiter, forgotPasswordRoutes);
app.use("/users", authMiddleware, mustChangePasswordGuard, userRoutes);

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

app.use("/notifications", notificationRoutes);


app.post("/login", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, password, site_id, department_id, device_id, fcm_token, force } = req.body;

    if (!name || !password || !site_id || !department_id || !device_id) {
      return res.status(400).json({ message: "Data login tidak lengkap" });
    }

    /* ================= CARI USER ================= */
    const result = await client.query(
      `
      SELECT u.id, u.name, u.password,
       u.role_id, r.role_name,
       u.site_id, u.department_id,
       u.must_change_password
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE trim(upper(u.name)) = trim(upper($1))
        AND u.site_id = $2
        AND u.department_id = $3
        AND u.deleted_at IS NULL
      `,
      [name, site_id, department_id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "User / site / department tidak cocok" });
    }

    const user = result.rows[0];

    /* ================= CEK PASSWORD ================= */
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Password salah" });
    }

   const forceLogin =
  force === true || force === "true" || force === 1 || force === "1";

/* ================= CEK DEVICE LAIN (STILL ACTIVE & FRESH) ================= */
const activeSession = await client.query(
  `
  SELECT id
  FROM user_sessions
  WHERE user_id = $1
    AND is_active = true
    AND expired_at > NOW()
    AND device_id <> $2
    AND (last_seen IS NULL OR last_seen > NOW() - INTERVAL '15 minutes')
  `,
  [user.id, device_id]
);

if (activeSession.rowCount > 0 && !forceLogin) {
  return res.status(409).json({
  message: "Akun ini sedang login di device lain",
  requires_force: true,
  otp_required: true
});
}

    /* ================= MATIKAN SESSION LAMA ================= */
    await client.query(
      `
      UPDATE user_sessions
      SET is_active = false,
          expired_at = NOW(),
          logout_at = NOW(),
          logout_reason = 'relogin'
      WHERE user_id = $1
        AND is_active = true
      `,
      [user.id]
    );

    /* ================= GENERATE JWT ================= */
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

    /* ================= SIMPAN SESSION ================= */
    await client.query(
      `
      INSERT INTO user_sessions
      (user_id, token, device_id, is_active, expired_at, last_seen)
      VALUES ($1, $2, $3, true, NOW() + INTERVAL '3 days', NOW())
      `,
      [user.id, token, device_id]
    );

    /* ================= SIMPAN DEVICE + FCM ================= */
    const cleanToken = (fcm_token ?? "").toString().trim();

    if (cleanToken !== "") {
      await client.query("BEGIN");
      try {
        // Lepaskan token dari user lain
        await client.query(
          `
          DELETE FROM user_devices
          WHERE fcm_token = $1
            AND user_id <> $2
          `,
          [cleanToken, user.id]
        );

        // Upsert device -> token
        await client.query(
          `
          INSERT INTO user_devices (user_id, device_id, fcm_token, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, device_id)
          DO UPDATE SET
            fcm_token = EXCLUDED.fcm_token,
            updated_at = NOW()
          `,
          [user.id, device_id, cleanToken]
        );

        await client.query("COMMIT");
        console.log("✅ Device + FCM saved:", user.id);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ Save device token error:", e);
      }
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role_name,
        site_id: user.site_id,
        department_id: user.department_id,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login gagal" });
  } finally {
    client.release();
  }
});

app.post("/login-force/request-otp", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, password, site_id, department_id, device_id } = req.body;

    if (!name || !password || !site_id || !department_id || !device_id) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const userRes = await client.query(
      `
      SELECT u.id, u.name, u.password, u.email
      FROM users u
      WHERE trim(upper(u.name)) = trim(upper($1))
        AND u.site_id = $2
        AND u.department_id = $3
        AND u.deleted_at IS NULL
      `,
      [name, site_id, department_id]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({ message: "User / site / department tidak cocok" });
    }

    const user = userRes.rows[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Password salah" });
    }

    if (!user.email) {
      return res.status(400).json({ message: "Email belum terdaftar. Hubungi admin." });
    }

    // Pastikan konflik masih "fresh" (sesuai policy kamu)
    const activeSession = await client.query(
      `
      SELECT id
      FROM user_sessions
      WHERE user_id = $1
        AND is_active = true
        AND expired_at > NOW()
        AND device_id <> $2
        AND (last_seen IS NULL OR last_seen > NOW() - INTERVAL '15 minutes')
      `,
      [user.id, device_id]
    );

    if (activeSession.rowCount === 0) {
      return res.status(400).json({ message: "Tidak ada konflik session" });
    }

    // Rate limit resend: minimal 60 detik sekali (opsional tapi recommended)
    const recentOtp = await client.query(
      `
      SELECT id
      FROM login_takeover_otps
      WHERE user_id = $1
        AND device_id = $2
        AND used_at IS NULL
        AND created_at > NOW() - INTERVAL '60 seconds'
      LIMIT 1
      `,
      [user.id, device_id]
    );

    if (recentOtp.rowCount > 0) {
      return res.status(429).json({ message: "OTP baru saja dikirim. Coba lagi sebentar." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
    const otpHash = bcrypt.hashSync(otp, 10);

    // invalidate OTP lama untuk user+device ini
    await client.query(
      `
      UPDATE login_takeover_otps
      SET used_at = NOW()
      WHERE user_id = $1 AND device_id = $2 AND used_at IS NULL
      `,
      [user.id, device_id]
    );

    await client.query(
      `
      INSERT INTO login_takeover_otps (user_id, device_id, otp_hash, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
      `,
      [user.id, device_id, otpHash]
    );

    await sendLoginOtpEmail({
      to: user.email,
      name: user.name,
      otp,
      minutes: 5,
    });

    return res.json({ message: "OTP terkirim ke email terdaftar" });
  } catch (err) {
    console.error("request-otp error:", err);
    return res.status(500).json({ message: "Gagal mengirim OTP" });
  } finally {
    client.release();
  }
});

app.post("/login-force/confirm", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, password, site_id, department_id, device_id, otp, fcm_token } = req.body;

    if (!name || !password || !site_id || !department_id || !device_id || !otp) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const result = await client.query(
      `
      SELECT u.id, u.name, u.password,
             u.role_id, r.role_name,
             u.site_id, u.department_id,
             u.must_change_password,
             u.email
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE trim(upper(u.name)) = trim(upper($1))
        AND u.site_id = $2
        AND u.department_id = $3
        AND u.deleted_at IS NULL
      `,
      [name, site_id, department_id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "User / site / department tidak cocok" });
    }

    const user = result.rows[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Password salah" });
    }

    // Ambil OTP aktif terbaru
    const otpRes = await client.query(
      `
      SELECT id, otp_hash, attempts
      FROM login_takeover_otps
      WHERE user_id = $1
        AND device_id = $2
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id, device_id]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ message: "OTP tidak ditemukan / sudah kadaluarsa" });
    }

    const row = otpRes.rows[0];

    if (row.attempts >= 5) {
      return res.status(429).json({ message: "Terlalu banyak percobaan OTP" });
    }

    const ok = bcrypt.compareSync(String(otp), row.otp_hash);

    await client.query(`UPDATE login_takeover_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id]);

    if (!ok) {
      return res.status(400).json({ message: "OTP salah" });
    }

    await client.query(`UPDATE login_takeover_otps SET used_at = NOW() WHERE id = $1`, [row.id]);

    // Matikan session lama (force takeover)
    await client.query(
      `
      UPDATE user_sessions
      SET is_active = false,
          expired_at = NOW(),
          logout_at = NOW(),
          logout_reason = 'force_relogin'
      WHERE user_id = $1
        AND is_active = true
      `,
      [user.id]
    );

    // Generate token (sama seperti login)
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

    // Insert session baru
    await client.query(
      `
      INSERT INTO user_sessions
      (user_id, token, device_id, is_active, expired_at, last_seen)
      VALUES ($1, $2, $3, true, NOW() + INTERVAL '3 days', NOW())
      `,
      [user.id, token, device_id]
    );

    // (opsional) simpan device+fcm sama seperti di /login kamu
    // Kalau mau konsisten, copy blok simpan FCM dari /login ke sini juga.
    // Aku taruh versi ringkas yang sama patternnya:
    const cleanToken = (fcm_token ?? "").toString().trim();
    if (cleanToken !== "") {
      await client.query("BEGIN");
      try {
        await client.query(
          `
          DELETE FROM user_devices
          WHERE fcm_token = $1
            AND user_id <> $2
          `,
          [cleanToken, user.id]
        );

        await client.query(
          `
          INSERT INTO user_devices (user_id, device_id, fcm_token, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, device_id)
          DO UPDATE SET
            fcm_token = EXCLUDED.fcm_token,
            updated_at = NOW()
          `,
          [user.id, device_id, cleanToken]
        );

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
      }
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role_name,
        site_id: user.site_id,
        department_id: user.department_id,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    console.error("confirm takeover error:", err);
    return res.status(500).json({ message: "Gagal verifikasi OTP" });
  } finally {
    client.release();
  }
});

app.post("/logout", authMiddleware, async (req, res) => {
  try {
    const token = req.token; 

    const result = await pool.query(`
      UPDATE user_sessions
SET is_active = false,
    expired_at = NOW(),
    logout_at = NOW(),
    logout_reason = 'manual'
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

app.get("/validate-session", authMiddleware, async (req, res) => {
  return res.json({
    valid: true,
    user: req.user
  });
});

setInterval(async () => {
  try {
    // TOKEN EXPIRED
    await pool.query(`
      UPDATE user_sessions
      SET is_active = false,
          logout_at = NOW(),
          logout_reason = 'token_expired'
      WHERE is_active = true
        AND expired_at < NOW()
    `);

    // INACTIVE USER
    await pool.query(`
      UPDATE user_sessions
      SET is_active = false,
          logout_at = NOW(),
          logout_reason = 'inactive'
      WHERE is_active = true
        AND last_seen < NOW() - INTERVAL '3 days'
    `);

    console.log("🛑 Auto logout berjalan normal");
  } catch (err) {
    console.error("Auto logout error:", err);
  }
}, 1000 * 60 * 5);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});