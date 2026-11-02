const pool = require("../db");

async function getRole(userId, workspaceId) {
  const result = await pool.query(
    "SELECT role FROM members WHERE user_id = $1 AND workspace_id = $2",
    [userId, workspaceId]
  );
  return result.rows[0] ? result.rows[0].role : null;
}

async function getBoardAccess(userId, boardId) {
  const result = await pool.query(
    `SELECT b.workspace_id, m.role
     FROM boards b
     JOIN members m ON m.workspace_id = b.workspace_id AND m.user_id = $2
     WHERE b.id = $1`,
    [boardId, userId]
  );
  return result.rows[0] || null;
}

async function getColumnAccess(userId, columnId) {
  const result = await pool.query(
    `SELECT b.id AS board_id, b.workspace_id, m.role
     FROM columns c
     JOIN boards b ON b.id = c.board_id
     JOIN members m ON m.workspace_id = b.workspace_id AND m.user_id = $2
     WHERE c.id = $1`,
    [columnId, userId]
  );
  return result.rows[0] || null;
}

async function getTaskAccess(userId, taskId) {
  const result = await pool.query(
    `SELECT b.id AS board_id, b.workspace_id, m.role
     FROM tasks t
     JOIN columns c ON c.id = t.column_id
     JOIN boards b ON b.id = c.board_id
     JOIN members m ON m.workspace_id = b.workspace_id AND m.user_id = $2
     WHERE t.id = $1`,
    [taskId, userId]
  );
  return result.rows[0] || null;
}

module.exports = { getRole, getBoardAccess, getColumnAccess, getTaskAccess };