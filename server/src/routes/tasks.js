const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { getRole, getColumnAccess, getTaskAccess } = require("../helpers/permissions");
const { emitToBoard } = require("../../socket");

const router = express.Router();
router.use(requireAuth);

// POST /api/tasks
router.post("/", async (req, res) => {
  const { columnId, title, description, dueDate } = req.body;
  if (!columnId || !title) {
    return res.status(400).json({ error: "columnId and title are required" });
  }

  try {
    const access = await getColumnAccess(req.userId, columnId);
    if (!access) return res.status(404).json({ error: "Column not found" });

    const pos = await pool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE column_id = $1",
      [columnId]
    );

    const result = await pool.query(
      `INSERT INTO tasks (title, description, due_date, position, column_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || null, dueDate || null, pos.rows[0].next, columnId]
    );

    emitToBoard(access.board_id, "task:created", { task: result.rows[0] });
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/tasks/:id
router.patch("/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  const { title, description, dueDate, assigneeId } = req.body;

  try {
    const access = await getTaskAccess(req.userId, taskId);
    if (!access) return res.status(404).json({ error: "Task not found" });

    if (assigneeId) {
      const assigneeRole = await getRole(assigneeId, access.workspace_id);
      if (!assigneeRole) {
        return res.status(400).json({ error: "Assignee is not in this workspace" });
      }
    }

    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         due_date = COALESCE($3, due_date),
         assignee_id = COALESCE($4, assignee_id)
       WHERE id = $5
       RETURNING *`,
      [title || null, description || null, dueDate || null, assigneeId || null, taskId]
    );

    emitToBoard(access.board_id, "task:updated", { task: result.rows[0] });
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/tasks/:id/move
router.patch("/:id/move", async (req, res) => {
  const taskId = Number(req.params.id);
  const { columnId, position } = req.body;
  if (columnId === undefined || position === undefined) {
    return res.status(400).json({ error: "columnId and position are required" });
  }

  const client = await pool.connect();
  try {
    const taskAccess = await getTaskAccess(req.userId, taskId);
    const colAccess = await getColumnAccess(req.userId, columnId);
    if (!taskAccess || !colAccess) {
      return res.status(404).json({ error: "Task or column not found" });
    }
    if (taskAccess.board_id !== colAccess.board_id) {
      return res.status(400).json({ error: "Cannot move task to another board" });
    }

    // Remember where it came from, so other users' screens can update both columns
    const old = await pool.query("SELECT column_id FROM tasks WHERE id = $1", [taskId]);
    const fromColumnId = old.rows[0].column_id;

    await client.query("BEGIN");
    await client.query(
      "UPDATE tasks SET position = position + 1 WHERE column_id = $1 AND position >= $2 AND id <> $3",
      [columnId, position, taskId]
    );
    const result = await client.query(
      "UPDATE tasks SET column_id = $1, position = $2 WHERE id = $3 RETURNING *",
      [columnId, position, taskId]
    );
    await client.query("COMMIT");

    emitToBoard(taskAccess.board_id, "task:moved", { task: result.rows[0], fromColumnId });
    res.json({ task: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  } finally {
    client.release();
  }
});

// DELETE /api/tasks/:id (admin only)
router.delete("/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  try {
    const access = await getTaskAccess(req.userId, taskId);
    if (!access) return res.status(404).json({ error: "Task not found" });
    if (access.role !== "admin") {
      return res.status(403).json({ error: "Only admins can delete tasks" });
    }

    await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);

    emitToBoard(access.board_id, "task:deleted", { taskId });
    res.json({ message: "Task deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/tasks/:id/comments
router.post("/:id/comments", async (req, res) => {
  const taskId = Number(req.params.id);
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Comment text is required" });

  try {
    const access = await getTaskAccess(req.userId, taskId);
    if (!access) return res.status(404).json({ error: "Task not found" });

    const inserted = await pool.query(
      "INSERT INTO comments (text, task_id, author_id) VALUES ($1, $2, $3) RETURNING id, text, created_at",
      [text, taskId, req.userId]
    );
    const user = await pool.query("SELECT name FROM users WHERE id = $1", [req.userId]);
    const comment = { ...inserted.rows[0], author: user.rows[0].name };

    emitToBoard(access.board_id, "comment:added", { taskId, comment });
    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/tasks/:id/comments
router.get("/:id/comments", async (req, res) => {
  const taskId = Number(req.params.id);
  try {
    const access = await getTaskAccess(req.userId, taskId);
    if (!access) return res.status(404).json({ error: "Task not found" });

    const result = await pool.query(
      `SELECT c.id, c.text, c.created_at, u.name AS author
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1
       ORDER BY c.created_at`,
      [taskId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;