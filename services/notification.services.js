const admin = require("../firebase/firebaseAdmin");
const pool = require("../config/db");

/* ================== ROLE RULE ================== */
function resolveTargetRoles(creatorRole) {
  if (creatorRole === "superadmin") return ["admin", "member"];
  if (creatorRole === "admin") return ["member"];
  return [];
}

/* ================== NORMALIZE SITE IDS ================== */
function normalizeSiteIds(siteIds) {
  if (typeof siteIds === "string") {
    try {
      siteIds = JSON.parse(siteIds);
    } catch {
      siteIds = [siteIds];
    }
  }

  if (!Array.isArray(siteIds)) siteIds = siteIds ? [siteIds] : [];

  return [...new Set(siteIds)]
    .map((id) => Number(id))
    .filter((id) => !isNaN(id));
}

/* ================== BUILD MESSAGE ================== */
function buildDailyPlanMessage({ creatorRole }) {
  const senderName =
    creatorRole === "superadmin" ? "HO" : creatorRole === "admin" ? "HSES" : "Tim";

  return {
    title: "📝 Daily Plan Baru Ready!",
    body: `📢 Hai! ${senderName} baru aja buat Daily Plan nih 📋. Yuk, lihat dan kasih rating dulu ya! ⭐`,
  };
}

function buildBuletinMessage({ creatorRole }) {
  return {
    title: "📰 Buletin Baru!",
    body:
      creatorRole === "superadmin"
        ? "📢 HO upload Buletin baru. Yuk, lihat dan kasih rating dulu ya! ⭐"
        : "📢 HSES upload Buletin baru. Yuk, lihat dan kasih rating dulu ya! ⭐",
  };
}

function buildLpiMessage({ senderName }) {
  return {
    title: "🚨 PERHATIAN LPI ACCIDENT",
    body: `📌 ${senderName} mengirim LPI. Tap untuk cek detaiL 🚨`,
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
    WHERE r.role_name = ANY($1::text[])
      AND u.site_id = ANY($2::int[])
      AND u.deleted_at IS NULL
      AND u.id != $3
    `,
    [roles, siteIds, creatorId]
  );

  return result.rows.map((r) => r.id);
}

async function getTargetUsersForLpi({ siteId, creatorId }) {
  const result = await pool.query(
    `
    SELECT u.id
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.deleted_at IS NULL
      AND u.id != $2
      AND (
        r.role_name = 'superadmin'
        OR (r.role_name = 'admin' AND u.site_id = $1)
      )
    `,
    [siteId, creatorId]
  );

  return result.rows.map((r) => r.id);
}

/* ================== SAVE NOTIFICATIONS ================== */
async function saveNotifications({ userIds, title, body, data }) {
  if (!userIds.length) return;

  const values = [];
  const params = [];

  userIds.forEach((userId, index) => {
    const base = index * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(userId, title, body, JSON.stringify(data));
  });

  await pool.query(
    `
    INSERT INTO notifications (user_id, title, body, data)
    VALUES ${values.join(",")}
    `,
    params
  );
}

/* ================== HELPERS ================== */
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function getFcmTokensByUserIds(userIds) {
  const tokensRes = await pool.query(
    `
    SELECT DISTINCT fcm_token
    FROM user_devices
    WHERE user_id = ANY($1::int[])
      AND fcm_token IS NOT NULL
      AND fcm_token <> ''
    `,
    [userIds]
  );

  return (tokensRes.rows || []).map((r) => r.fcm_token).filter(Boolean);
}

async function deleteInvalidTokens(tokens) {
  if (!tokens.length) return;

  await pool.query(
    `
    DELETE FROM user_devices
    WHERE fcm_token = ANY($1::text[])
    `,
    [tokens]
  );
}

/* ================== SEND DAILY PLAN ================== */
async function sendDailyPlanNotification({
  creatorRole,
  siteIds,
  creatorId,
  title,
  planId,
}) {
  try {
    siteIds = normalizeSiteIds(siteIds);
    if (!siteIds.length) return console.log("❌ No valid siteIds (daily_plan)");

    const userIds = await getTargetUsers({ creatorRole, siteIds, creatorId });
    if (!userIds.length) return console.log("❌ No target users (daily_plan)");

    const message = buildDailyPlanMessage({ creatorRole, title });

    await saveNotifications({
      userIds,
      title: message.title,
      body: message.body,
      data: { type: "daily_plan", daily_plan_id: planId },
    });

    const tokens = await getFcmTokensByUserIds(userIds);
    if (!tokens.length) return console.log("❌ No tokens (daily_plan)");

    const tokenChunks = chunkArray(tokens, 500);
    const invalidSet = new Set();

    for (const chunk of tokenChunks) {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: message.title, body: message.body },
        android: {
          priority: "high",
          notification: {
            channelId: "high_importance_channel",
            sound: "default",
          },
        },
        data: { type: "daily_plan", daily_plan_id: String(planId) },
      });

      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidSet.add(chunk[idx]);
          }
        }
      });
    }

    await deleteInvalidTokens([...invalidSet]);
  } catch (err) {
    console.error("❌ ERROR SEND DAILY PLAN NOTIFICATION:", err);
  }
}

/* ================== SEND BULETIN ================== */
async function sendBuletinNotification({
  creatorRole,
  siteIds,
  creatorId,
  title,
  buletinId,
}) {
  try {
    siteIds = normalizeSiteIds(siteIds);
    if (!siteIds.length) return console.log("❌ No valid siteIds (buletin)");

    const userIds = await getTargetUsers({ creatorRole, siteIds, creatorId });
    if (!userIds.length) return console.log("❌ No target users (buletin)");

    const message = buildBuletinMessage({ creatorRole, title });

    await saveNotifications({
      userIds,
      title: message.title,
      body: message.body,
      data: { type: "buletin", buletin_id: buletinId },
    });

    const tokens = await getFcmTokensByUserIds(userIds);
    if (!tokens.length) return console.log("❌ No tokens (buletin)");

    const tokenChunks = chunkArray(tokens, 500);
    const invalidSet = new Set();

    for (const chunk of tokenChunks) {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: message.title, body: message.body },
        android: {
          priority: "high",
          notification: {
            channelId: "high_importance_channel",
            sound: "default",
          },
        },
        data: { type: "buletin", buletin_id: String(buletinId) },
      });

      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidSet.add(chunk[idx]);
          }
        }
      });
    }

    await deleteInvalidTokens([...invalidSet]);
  } catch (err) {
    console.error("❌ ERROR SEND BULETIN NOTIFICATION:", err);
  }
}

async function sendLpiNotification({ creatorId, siteId, senderName, lpiId }) {
  try {
    siteId = Number(siteId);
    if (!siteId || Number.isNaN(siteId)) return console.log("❌ Invalid siteId (lpi)");
    if (!lpiId) return console.log("❌ No lpiId (lpi)");

    const userIdsRaw = await getTargetUsersForLpi({ siteId, creatorId });
    const userIds = [...new Set(userIdsRaw)];
    if (!userIds.length) return console.log("❌ No target users (lpi)");

    const message = buildLpiMessage({ senderName: senderName || "User" });

    await saveNotifications({
      userIds,
      title: message.title,
      body: message.body,
      data: { type: "lpi", lpi_id: lpiId, site_id: siteId },
    });

    const tokens = await getFcmTokensByUserIds(userIds);
    if (!tokens.length) return console.log("❌ No tokens (lpi)");

    const tokenChunks = chunkArray(tokens, 500);
    const invalidSet = new Set();

    for (const chunk of tokenChunks) {
      const resp = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: message.title, body: message.body },
        android: {
          priority: "high",
          ttl: 24 * 60 * 60 * 1000,
          notification: {
            channelId: "high_importance_channel",
            sound: "default",
          },
        },
        data: {
          type: "lpi",
          lpi_id: String(lpiId),
          site_id: String(siteId),
        },
      });

      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidSet.add(chunk[idx]);
          }
        }
      });
    }

    await deleteInvalidTokens([...invalidSet]);
  } catch (err) {
    console.error("❌ ERROR SEND LPI NOTIFICATION:", err);
  }
}


module.exports = {
  sendDailyPlanNotification,
  sendBuletinNotification,
  sendLpiNotification,
  getTargetUsers,
};
