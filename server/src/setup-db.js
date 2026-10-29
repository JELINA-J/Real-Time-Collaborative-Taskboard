const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function setup() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Tables created");
  await pool.end();
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});