const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/boards/:boardId  -> board + its columns + tasks
router.get("/:boardId", async (req, res) => {
  const boardId = Number(req.params.boardId);
  try {
    // The JOIN on members means: only return the board if I belong to its workspace
    const board = await pool.query(
      `SELECT b.id, b.name, b.workspace_id, m.role
       FROM boards b
       JOIN members m ON m.workspace_id = b.workspace_id AND m.user_id = $2
       WHERE b.id = $1`,
      [boardId, req.userId]
    );
    if (board.rows.length === 0) {
      return res.status(404).json({ error: "Board not found" });
    }

    const columns = await pool.query(
      "SELECT id, name, position FROM columns WHERE board_id = $1 ORDER BY position",
      [boardId]
    );
    const tasks = await pool.query(
      `SELECT t.id, t.title, t.description, t.due_date, t.position, t.column_id, t.assignee_id
       FROM tasks t
       JOIN columns c ON c.id = t.column_id
       WHERE c.board_id = $1
       ORDER BY t.position`,
      [boardId]
    );

    // Put each task inside its column
    const result = columns.rows.map((col) => ({
      ...col,
      tasks: tasks.rows.filter((t) => t.column_id === col.id),
    }));

    res.json({ board: board.rows[0], columns: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;