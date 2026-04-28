function sanitizePayload(payload = {}) {
  const hiddenFields = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'otp',
    'pin',
    'fcm_token',
  ];

  const cleanPayload = { ...payload };

  hiddenFields.forEach((field) => {
    if (cleanPayload[field]) {
      cleanPayload[field] = '[HIDDEN]';
    }
  });

  return cleanPayload;
}

async function createAuditLog(clientOrPool, data) {
  const {
    userId = null,
    userName = null,
    userRole = null,
    siteId = null,
    siteName = null,
    departmentId = null,
    departmentName = null,
    action,
    module = null,
    method = null,
    endpoint = null,
    description = null,
    requestPayload = null,
    responseStatus = null,
    ipAddress = null,
    deviceId = null,
    userAgent = null,
  } = data;

  await clientOrPool.query(
    `
    INSERT INTO audit_logs (
      user_id,
      user_name,
      user_role,
      site_id,
      site_name,
      department_id,
      department_name,
      action,
      module,
      method,
      endpoint,
      description,
      request_payload,
      response_status,
      ip_address,
      device_id,
      user_agent
    )
    VALUES (
      $1, $2, $3,
      $4, $5,
      $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17
    )
    `,
    [
      userId,
      userName,
      userRole,
      siteId,
      siteName,
      departmentId,
      departmentName,
      action,
      module,
      method,
      endpoint,
      description,
      requestPayload,
      responseStatus,
      ipAddress,
      deviceId,
      userAgent,
    ],
  );
}

module.exports = {
  sanitizePayload,
  createAuditLog,
};