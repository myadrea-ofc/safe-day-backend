const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.resolve(
  process.cwd(),
  "secrets/firebase-service-account.json"
);

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
