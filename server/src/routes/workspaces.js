const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { getRole } = require("../helpers/permissions");

const router = express.Router();
router.use(requireAuth); // every route in this file needs login

// POST /api/workspaces  -> create a workspace; creator becomes admin
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Workspace name is required" });

  // A transaction = both inserts succeed together, or neither happens
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ws = await client.query(
      "INSERT INTO workspaces (name) VALUES ($1) RETURNING id, name",
      [name]
    );
    await client.query(
      "INSERT INTO members (user_id, workspace_id, role) VALUES ($1, $2, 'admin')",
      [req.userId, ws.rows[0].id]
    );
    await client.query("COMMIT");
    res.status(201).json({ workspace: { ...ws.rows[0], role: "admin" } });
  } catch (err) {
    await client.query("ROLLBACK"); // undo everything if something failed
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    client.release(); // give the connection back to the pool
  }
});

// GET /api/workspaces  -> all workspaces I belong to
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, m.role
       FROM workspaces w
       JOIN members m ON m.workspace_id = w.id
       WHERE m.user_id = $1
       ORDER BY w.id`,
      [req.userId]
    );
    res.json({ workspaces: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/workspaces/:id/members  -> admin adds a user by email
router.post("/:id/members", async (req, res) => {
  const workspaceId = Number(req.params.id);
  const { email } = req.body;

  try {
    const role = await getRole(req.userId, workspaceId);
    if (role !== "admin") {
      return res.status(403).json({ error: "Only admins can add members" });
    }

    const found = await pool.query("SELECT id, name, email FROM users WHERE email = $1", [email]);
    if (found.rows.length === 0) {
      return res.status(404).json({ error: "No user with that email" });
    }

    await pool.query(
      "INSERT INTO members (user_id, workspace_id, role) VALUES ($1, $2, 'member')",
      [found.rows[0].id, workspaceId]
    );
    res.status(201).json({ member: found.rows[0] });
  } catch (err) {
    if (err.code === "23505") { // Postgres code for "unique rule broken"
      return res.status(409).json({ error: "User is already a member" });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/workspaces/:id/boards  -> admin creates a board with 3 default columns
router.post("/:id/boards", async (req, res) => {
  const workspaceId = Number(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Board name is required" });

  const client = await pool.connect();
  try {
    const role = await getRole(req.userId, workspaceId);
    if (role !== "admin") {
      return res.status(403).json({ error: "Only admins can create boards" });
    }

    await client.query("BEGIN");
    const board = await client.query(
      "INSERT INTO boards (name, workspace_id) VALUES ($1, $2) RETURNING id, name",
      [name, workspaceId]
    );
    const defaults = ["To Do", "In Progress", "Done"];
    for (let i = 0; i < defaults.length; i++) {
      await client.query(
        "INSERT INTO columns (name, position, board_id) VALUES ($1, $2, $3)",
        [defaults[i], i, board.rows[0].id]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ board: board.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    client.release();
  }
});

// GET /api/workspaces/:id/boards  -> list boards (any member can view)
router.get("/:id/boards", async (req, res) => {
  const workspaceId = Number(req.params.id);
  try {
    const role = await getRole(req.userId, workspaceId);
    if (!role) return res.status(403).json({ error: "You are not in this workspace" });

    const result = await pool.query(
      "SELECT id, name FROM boards WHERE workspace_id = $1 ORDER BY id",
      [workspaceId]
    );
    res.json({ boards: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;