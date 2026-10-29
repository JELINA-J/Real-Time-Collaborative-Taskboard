require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/auth");

const app = express();
app.use(cors());          // lets the React app (a different port) call this API
app.use(express.json());  // lets us read JSON from request bodies

app.use("/api/auth", authRoutes);

// A protected route to test the middleware
app.get("/api/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [req.userId]
  );
  res.json({ user: result.rows[0] });
});

app.get("/health", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json({ status: "ok", dbTime: result.rows[0].now });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});