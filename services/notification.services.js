const admin = require("../firebase/firebaseAdmin");
const pool = require("../config/db");

/* ================== ROLE RULE ================== */
function resolveTargetRoles(creatorRole) {
  if (creatorRole === "superadmin") return ["admin", "member"];
  if (creatorRole === "admin") return ["member"];
  return [];
}

/* ================== BUILD MESSAGE ================== */
function buildDailyPlanMessage({ creatorRole, title }) {
  let senderName = "";
  
  if (creatorRole === "superadmin") {
    senderName = "HO";
  } else if (creatorRole === "admin") {
    senderName = "HSES";
  } else {
    senderName = "Tim";
  }
  return {
    title: "📝 Daily Plan Baru Ready!",
    body: `📢 Hai! ${senderName} baru aja buat Daily Plan nihh 📋. Yuk, lihat dan kasih rating dulu ya! ⭐`,
  };
}

/* ================== GET TARGET USERS ================== */
async function getTargetUsers({ creatorRole, siteIds, creatorId }) {
  const roles = resolveTargetRoles(creatorRole);
  if (!roles.length) return [];

  const result = await pool.query(
    `
    SELECT u.id
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.role_name = ANY($1)
      AND u.site_id = ANY($2)
      AND u.deleted_at IS NULL
      AND u.id != $3
    `,
    [roles, siteIds, creatorId]
  );

  return result.rows.map(r => r.id);
}

async function saveNotifications({ userIds, title, body, data }) {
  if (!userIds.length) return;

  const values = [];
  const params = [];

  userIds.forEach((userId, index) => {
    const base = index * 4;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
    );
    params.push(userId, title, body, data);
  });

  await pool.query(
    `
    INSERT INTO notifications (user_id, title, body, data)
    VALUES ${values.join(",")}
    `,
    params
  );
}


/* ================== SEND NOTIFICATION ================== */
async function sendDailyPlanNotification({
  creatorRole,
  siteIds,
  creatorId,
  title,
  planId,
}) {
  const userIds = await getTargetUsers({
    creatorRole,
    siteIds,
    creatorId,
  });

  if (!userIds.length) return;

  const message = buildDailyPlanMessage({ creatorRole, title });

  // 🔔 SIMPAN KE DATABASE
  await saveNotifications({
    userIds,
    title: message.title,
    body: message.body,
    data: {
      type: "daily_plan",
      daily_plan_id: planId,
    },
  });

  // 🔥 AMBIL TOKEN
  const tokensRes = await pool.query(
    `
    SELECT DISTINCT fcm_token
    FROM user_fcm_tokens
    WHERE user_id = ANY($1)
      AND fcm_token IS NOT NULL
    `,
    [userIds]
  );

  const tokens = tokensRes.rows.map(r => r.fcm_token);
  if (!tokens.length) return;

  // 🚀 KIRIM PUSH
  await admin.messaging().sendMulticast({
    tokens,
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      type: "daily_plan",
      daily_plan_id: String(planId),
    },
  });
}

module.exports = {
  sendDailyPlanNotification,
};
