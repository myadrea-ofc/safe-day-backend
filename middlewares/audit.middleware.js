const {
  createAuditLog,
  sanitizePayload,
} = require("../helpers/auditLog.helper");

function auditMiddleware(moduleName) {
  return async function (req, res, next) {

    res.on("finish", async () => {
      try {

        if (!req.user) return;

        let action = req.method;

        const url = req.originalUrl.toLowerCase();

        if (url.includes("export")) {
          action = "EXPORT";
        }

        if (url.includes("login")) {
          action = "LOGIN";
        }

        if (url.includes("logout")) {
          action = "LOGOUT";
        }

        await createAuditLog(req.db, {
          userId: req.user.id,
          userName: req.user.name,
          userRole: req.user.role,

          siteId: req.user.site_id,
          departmentId: req.user.department_id,

          action,
          module: moduleName,
          method: req.method,
          endpoint: req.originalUrl,

          description:
            `${req.user.name} melakukan ${action} pada module ${moduleName}`,

          requestPayload:
            req.method === "GET"
              ? null
              : sanitizePayload(req.body),

          responseStatus: res.statusCode,

          ipAddress: req.ip,
          deviceId: req.headers["x-device-id"],
          userAgent: req.headers["user-agent"],
        });

      } catch (error) {
        console.error(
          "Audit middleware error:",
          error.message
        );
      }
    });

    next();
  };
}

module.exports = auditMiddleware;