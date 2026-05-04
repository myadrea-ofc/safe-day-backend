const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { sendNewPasswordEmail } = require("../config/mailer");
const { enqueueEmailJob } = require("../utils/emailQueue");
const {
  createAuditLog,
  sanitizePayload,
} = require("../helpers/auditLog.helper");

const router = express.Router();

function generateNewPassword() {
  const templates = [
    "Pass123!",
    "Pass321!",
    "Safety1234",
    "SafeDay7878",
    "Borneo789",
  ];

  const base = templates[Math.floor(Math.random() * templates.length)];
  const suffix = String(Math.floor(Math.random() * 9000) + 1000); 
  return `${base}${suffix}`;
}

router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { site_id, department_id, name, email } = req.body;

    if (!site_id || !department_id || !name || !email) {
      await createAuditLog(client, {
        userName: name || null,
        siteId: site_id || null,
        departmentId: department_id || null,
        action: "FORGOT_PASSWORD_FAILED",
        module: "Auth",
        method: req.method,
        endpoint: req.originalUrl,
        description: "Forgot password gagal: data tidak lengkap",
        requestPayload: sanitizePayload(req.body),
        responseStatus: 400,
        ipAddress: req.ip,
        deviceId: req.headers["x-device-id"],
        userAgent: req.headers["user-agent"],
      });

      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    // 1) Cari user yang cocok (site+dept+name+email)
    const userRes = await client.query(
      `
      SELECT u.id, u.name, u.email,
             s.site_name, d.department_name
      FROM public.users u
      JOIN public.sites s ON s.id = u.site_id
      JOIN public.departments d ON d.id = u.department_id
      WHERE u.site_id = $1
        AND u.department_id = $2
        AND trim(upper(u.name)) = trim(upper($3))
        AND lower(u.email) = lower(trim($4))
        AND u.deleted_at IS NULL
      LIMIT 1
      `,
      [site_id, department_id, name, email]
    );

    if (userRes.rowCount === 0) {
      await createAuditLog(client, {
        userName: name,
        siteId: site_id,
        departmentId: department_id,
        action: "FORGOT_PASSWORD_FAILED",
        module: "Auth",
        method: req.method,
        endpoint: req.originalUrl,
        description: "Forgot password gagal: data tidak cocok",
        requestPayload: sanitizePayload(req.body),
        responseStatus: 400,
        ipAddress: req.ip,
        deviceId: req.headers["x-device-id"],
        userAgent: req.headers["user-agent"],
      });

      return res.status(400).json({
        message: "Data tidak valid. Mohon cek Site, Department, Nama, dan Email."
      });
    }

    const user = userRes.rows[0];

    // 2) Cooldown per user (default 60 detik)
    const cooldownSeconds = Number(process.env.FORGOT_PASSWORD_COOLDOWN_SECONDS || 60);

    const recentReq = await client.query(
      `
      SELECT 1
      FROM public.forgot_password_logs
      WHERE user_id = $1
        AND requested_at > NOW() - ($2 || ' seconds')::interval
      LIMIT 1
      `,
      [user.id, String(cooldownSeconds)]
    );

    if (recentReq.rowCount > 0) {
      await createAuditLog(client, {
        userId: user.id,
        userName: user.name,
        siteId: site_id,
        departmentId: department_id,
        action: "FORGOT_PASSWORD_COOLDOWN",
        module: "Auth",
        method: req.method,
        endpoint: req.originalUrl,
        description: `${user.name} mencoba forgot password terlalu cepat`,
        requestPayload: sanitizePayload(req.body),
        responseStatus: 200,
        ipAddress: req.ip,
        deviceId: req.headers["x-device-id"],
        userAgent: req.headers["user-agent"],
      });

      return res.status(200).json({ message: "Permintaan terlalu cepat. Coba lagi sebentar." });
    }

    // 3) Generate password baru + hash
    const newPassword = generateNewPassword();
    const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
    const hashed = bcrypt.hashSync(newPassword, rounds);

    // 4) Update password + set must_change_password = true (pakai transaksi + lock)
    await client.query("BEGIN");

    await client.query(`SELECT id FROM public.users WHERE id = $1 FOR UPDATE`, [user.id]);

    await client.query(
      `
      UPDATE public.users
      SET password = $1,
          must_change_password = true,
          updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      `,
      [hashed, user.id]
    );

    await client.query(
      `
      INSERT INTO public.forgot_password_logs (user_id, request_ip, user_agent)
      VALUES ($1, $2, $3)
      `,
      [user.id, req.ip || null, req.headers["user-agent"] || null]
    );

    await client.query("COMMIT");

    await createAuditLog(client, {
      userId: user.id,
      userName: user.name,
      siteId: site_id,
      departmentId: department_id,
      action: "FORGOT_PASSWORD",
      module: "Auth",
      method: req.method,
      endpoint: req.originalUrl,
      description: `${user.name} berhasil request forgot password`,
      requestPayload: sanitizePayload(req.body),
      responseStatus: 200,
      ipAddress: req.ip,
      deviceId: req.headers["x-device-id"],
      userAgent: req.headers["user-agent"],
    });

    // 5) Kirim email lewat queue (tanpa Redis)
    await enqueueEmailJob(() =>
      sendNewPasswordEmail({
        to: user.email,
        name: user.name,
        siteName: user.site_name,
        departmentName: user.department_name,
        newPassword,
      })
    );

    return res.status(200).json({ message: "Email terkirim" });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("forgot-password error:", err);
    return res.status(500).json({ message: "Gagal memproses forgot password" });
  } finally {
    client.release();
  }
});

module.exports = router;