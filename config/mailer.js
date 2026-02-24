const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // biasanya 587 TLS (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify()
  .then(() => console.log("✅ SMTP ready"))
  .catch((e) => console.error("❌ SMTP verify failed:", e.message));

async function sendNewPasswordEmail({
  to,
  name,
  siteName,
  departmentName,
  newPassword,
}) {
  const subject = "SAFE DAY - Password Baru";

  // fallback plaintext (biar aman kalau client gak support HTML)
  const text =
    `Halo ${name},\n\n` +
    `Permintaan reset password Anda berhasil diproses.\n` +
    `Site: ${siteName}\n` +
    `Department: ${departmentName}\n\n` +
    `Password baru Anda: ${newPassword}\n\n` +
    `Silakan login menggunakan password tersebut.\n` +
    `Setelah login, Anda WAJIB ganti password.\n\n` +
    `Jika ini bukan Anda, segera hubungi Head Office.\n`;

  // HTML email (modern, responsive, inline style)
  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08);">
              
              <!-- Header -->
              <tr>
                <td style="padding:22px 24px;background:linear-gradient(135deg,#1d63ff,#4fa9ff);">
                  <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:.5px;">
                    SAFE DAY
                  </div>
                  <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:6px;">
                    HSES Management System
                  </div>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:22px 24px;">
                  <div style="font-size:16px;font-weight:800;margin-bottom:8px;">
                    Password Baru Anda
                  </div>

                  <div style="font-size:14px;line-height:1.6;color:#374151;">
                    Halo <b>${escapeHtml(name)}</b>,<br/>
                    Permintaan reset password Anda <b>berhasil</b> diproses. Berikut detail akun Anda:
                  </div>

                  <!-- Info card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;background:#f6f8fb;border-radius:14px;">
                    <tr>
                      <td style="padding:14px 14px;">
                        <div style="font-size:12px;color:#6b7280;">Site</div>
                        <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(siteName)}</div>
                      </td>
                      <td style="padding:14px 14px;">
                        <div style="font-size:12px;color:#6b7280;">Department</div>
                        <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(departmentName)}</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Password block -->
                  <div style="margin-top:16px;">
                    <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Password Baru</div>
                    <div style="font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
                                font-size:18px;font-weight:800;letter-spacing:.5px;
                                padding:14px 16px;border-radius:14px;background:#111827;color:#ffffff;display:inline-block;">
                      ${escapeHtml(newPassword)}
                    </div>
                  </div>

                  <!-- Steps -->
                  <div style="margin-top:18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px 14px;">
                    <div style="font-size:13px;font-weight:800;color:#9a3412;margin-bottom:6px;">
                      Penting
                    </div>
                    <div style="font-size:13px;line-height:1.6;color:#9a3412;">
                      Setelah login menggunakan password baru, Anda <b>WAJIB</b> mengganti password di menu <b>Change Password</b>.
                    </div>
                  </div>

                  <div style="margin-top:16px;font-size:13px;line-height:1.6;color:#6b7280;">
                    Jika Anda tidak merasa melakukan permintaan ini, segera hubungi <b>Head Office</b>.
                  </div>

                  <!-- Divider -->
                  <div style="height:1px;background:#e5e7eb;margin:18px 0;"></div>

                  <div style="font-size:12px;color:#9ca3af;line-height:1.6;">
                    Email ini dikirim otomatis oleh sistem SAFE DAY. Mohon jangan membalas email ini.
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:16px 24px;background:#f6f8fb;">
                  <div style="font-size:12px;color:#6b7280;">
                    © ${new Date().getFullYear()} SAFE DAY • Bagas Bumi Persada
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

// helper biar aman dari karakter aneh di html
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = { sendNewPasswordEmail };