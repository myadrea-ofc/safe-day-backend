const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
  max: 10,                     // max koneksi
  idleTimeoutMillis: 10000,    // tutup koneksi idle
  connectionTimeoutMillis: 5000, // ⬅️ PENTING
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error", err);
});

module.exports = pool;
