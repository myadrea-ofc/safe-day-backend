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
    WHERE r.role_name = ANY($1::text[])
      AND u.site_id = ANY($2::int[])
      AND u.deleted_at IS NULL
      AND u.id != $3
    `,
    [roles, siteIds, creatorId]
  );

  return result.rows.map(r => r.id);
}

/* ================== SAVE NOTIFICATIONS ================== */
async function saveNotifications({ userIds, title, body, data }) {
  if (!userIds.length) return;

  const values = [];
  const params = [];

  userIds.forEach((userId, index) => {
    const base = index * 4;
    values.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
    );
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

/* ================== HELPER BATCH ================== */
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/* ================== SEND NOTIFICATION ================== */
async function sendDailyPlanNotification({
  creatorRole,
  siteIds,
  creatorId,
  title,
  planId,
}) {
  try {
    // ✅ NORMALIZE siteIds
    
if (typeof siteIds === "string") {
  try {
    siteIds = JSON.parse(siteIds);
  } catch {
    siteIds = [];
  }
}

if (!Array.isArray(siteIds)) {
  siteIds = [siteIds];
}


    siteIds = [...new Set(siteIds)]
      .map(id => Number(id))
      .filter(id => !isNaN(id));

    if (siteIds.length === 0) {
      console.log("❌ No valid siteIds provided");
      return;
    }

    console.log(`📨 Sending Daily Plan ID: ${planId}`);

    const userIds = await getTargetUsers({
      creatorRole,
      siteIds,
      creatorId,
    });

    console.log("TARGET USER IDS:", userIds.length);

    if (!userIds.length) {
      console.log("❌ No target users found");
      return;
    }

    const message = buildDailyPlanMessage({ creatorRole, title });

    // ================= SAVE TO DB =================
    await saveNotifications({
      userIds,
      title: message.title,
      body: message.body,
      data: {
        type: "daily_plan",
        daily_plan_id: planId,
      },
    });

    // ================= GET TOKENS =================
    const tokensRes = await pool.query(
      `
      SELECT DISTINCT fcm_token
      FROM user_fcm_tokens
      WHERE user_id = ANY($1::int[])
        AND fcm_token IS NOT NULL
      `,
      [userIds]
    );

    const tokens = tokensRes.rows.map(r => r.fcm_token);

    console.log("TOKENS LIST:", tokens);

    console.log("TOKENS FOUND:", tokens.length);

    if (!tokens.length) {
      console.log("❌ No FCM tokens found");
      return;
    }

    // ================= SEND FCM (BATCH MAX 500) =================
    const tokenChunks = chunkArray(tokens, 500);
    let allInvalidTokens = [];

    for (const chunk of tokenChunks) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: {
          type: "daily_plan",
          daily_plan_id: String(planId),
        },
      });

      console.log("FCM SUCCESS:", response.successCount);
      console.log("FCM FAIL:", response.failureCount);

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;

          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            allInvalidTokens.push(chunk[idx]);
          }
        }
      });
    }

    // ================= CLEAN INVALID TOKENS =================
    if (allInvalidTokens.length > 0) {
      console.log("🧹 Removing invalid tokens:", allInvalidTokens.length);

      await pool.query(
        `
        DELETE FROM user_fcm_tokens
        WHERE fcm_token = ANY($1::text[])
        `,
        [allInvalidTokens]
      );
    }

  } catch (err) {
    console.error("❌ ERROR SEND DAILY PLAN NOTIFICATION:", err);
  }
}

module.exports = {
  sendDailyPlanNotification,
  getTargetUsers
};
