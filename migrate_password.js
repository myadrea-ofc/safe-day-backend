require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

(async () => {
  const users = await pool.query("SELECT id, password FROM users");

  for (const u of users.rows) {
    if (!u.password.startsWith("$2")) {
      const hashed = bcrypt.hashSync(u.password, 10);
      await pool.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashed, u.id]
      );
      console.log(`User ${u.id} dimigrasi`);
    }
  }

  console.log("SEMUA PASSWORD SUDAH AMAN");
  process.exit(0);
})();
