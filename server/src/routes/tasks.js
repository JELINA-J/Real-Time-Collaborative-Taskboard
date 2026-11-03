const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");
const { getRole, getColumnAccess, getTaskAccess } = require("../helpers/permissions");
const { emitToBoard } = require("../../socket");

const router = express.Router();
router.use(requireAuth);
// Gives tasks in a column the positions 0, 1, 2... in the order of the ids array
async function renumber(client, columnId, ids) {
  if (ids.length === 0) return;
  await client.query(
    `UPDATE tasks t SET column_id = $1, position = v.pos - 1
     FROM unnest($2::int[]) WITH ORDINALITY AS v(id, pos)
     WHERE t.id = v.id`,
    [columnId, ids]
  );
}

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
// PATCH /api/tasks/:id  -> edit a task (admin, assignee, or anyone if unassigned)
router.patch("/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId)) {
    return res.status(400).json({ error: "Invalid task id" });
  }

  try {
    const access = await getTaskAccess(req.userId, taskId);
    if (!access) return res.status(404).json({ error: "Task not found" });
    const isAdmin = access.role === "admin";

    // Who owns the task right now?
    const current = await pool.query("SELECT assignee_id FROM tasks WHERE id = $1", [taskId]);
    const currentAssignee = current.rows[0].assignee_id;

    // Rule 1: only admin, the assignee, or anyone (if nobody owns it) may edit
    const canEdit = isAdmin || currentAssignee === null || currentAssignee === req.userId;
    if (!canEdit) {
      return res.status(403).json({ error: "Only admins or the assignee can edit this task" });
    }

    // Build the UPDATE only from the fields that were actually sent
    const body = req.body;
    const fields = [];
    const values = [];
    const set = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if ("title" in body) {
      if (!String(body.title).trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      set("title", String(body.title).trim());
    }
    if ("description" in body) set("description", body.description || null);
    if ("dueDate" in body) set("due_date", body.dueDate || null);

    // Rule 2: changing the assignee
    if ("assigneeId" in body) {
      const newAssignee = body.assigneeId ? Number(body.assigneeId) : null;
      if (newAssignee !== currentAssignee) {
        const claiming = currentAssignee === null && newAssignee === req.userId;
        if (!isAdmin && !claiming) {
          return res.status(403).json({ error: "Only admins can change the assignee" });
        }
        if (newAssignee !== null) {
          const role = await getRole(newAssignee, access.workspace_id);
          if (!role) {
            return res.status(400).json({ error: "Assignee is not in this workspace" });
          }
        }
        set("assignee_id", newAssignee);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    values.push(taskId);
    const result = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );

    emitToBoard(access.board_id, "task:updated", { task: result.rows[0] });
    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/tasks/:id/move  -> move to another column and/or position
router.patch("/:id/move", async (req, res) => {
  const taskId = Number(req.params.id);
  const columnId = Number(req.body.columnId);
  const position = Number(req.body.position);

  if (![taskId, columnId, position].every(Number.isInteger) || position < 0) {
    return res.status(400).json({ error: "Valid task id, columnId and position are required" });
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

    const old = await pool.query("SELECT column_id FROM tasks WHERE id = $1", [taskId]);
    const fromColumnId = old.rows[0].column_id;

    await client.query("BEGIN");

    // 1. Tasks already in the destination column, without the moved one
    const dest = await client.query(
      "SELECT id FROM tasks WHERE column_id = $1 AND id <> $2 ORDER BY position, id",
      [columnId, taskId]
    );
    const ids = dest.rows.map((r) => r.id);

    // 2. Insert the moved task at the wanted index, then renumber the column
    ids.splice(Math.min(position, ids.length), 0, taskId);
    await renumber(client, columnId, ids);

    // 3. If it left another column, close the gap there too
    if (fromColumnId !== columnId) {
      const src = await client.query(
        "SELECT id FROM tasks WHERE column_id = $1 AND id <> $2 ORDER BY position, id",
        [fromColumnId, taskId]
      );
      await renumber(client, fromColumnId, src.rows.map((r) => r.id));
    }

    await client.query("COMMIT");

    const result = await pool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
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
// POST /api/tasks/:id/comments
router.post("/:id/comments", async (req, res) => {
  const taskId = Number(req.params.id);
  const { text } = req.body;
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: "Invalid task id" });
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
  if (!Number.isInteger(taskId)) return res.status(400).json({ error: "Invalid task id" });

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