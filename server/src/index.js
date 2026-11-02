require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const workspaceRoutes = require("./routes/workspaces");
const boardRoutes = require("./routes/boards");
const taskRoutes = require("./routes/tasks");
const requireAuth = require("./middleware/auth");
const { initSocket } = require("../socket");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/tasks", taskRoutes);

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

const server = http.createServer(app); // Express + Socket.IO share this server
initSocket(server);

server.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});