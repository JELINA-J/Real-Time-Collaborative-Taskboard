const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const pool = require("./src/db");
const { getBoardAccess } = require("./src/helpers/permissions");

let io; // set once in initSocket, used by emitToBoard

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" },
  });

  // Runs once per connection, BEFORE the "connection" event.
  // Verifies the token and loads the user's name, so the handler below needs no waiting.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = payload.userId;

      const u = await pool.query("SELECT name FROM users WHERE id = $1", [payload.userId]);
      socket.data.name = u.rows[0] ? u.rows[0].name : "Unknown";
      socket.data.boards = new Set();
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  // No "await" before the listeners, so nothing can be missed
  io.on("connection", (socket) => {
    // Client says: "I opened board 5"
    socket.on("join-board", async (boardId, ack) => {
      try {
        const access = await getBoardAccess(socket.data.userId, boardId);
        if (!access) {
          if (ack) ack({ error: "No access to this board" });
          return;
        }
        socket.join(`board:${boardId}`);
        socket.data.boards.add(boardId);
        if (ack) ack({ ok: true });
        broadcastPresence(boardId);
      } catch (err) {
        console.error("join-board failed:", err.message);
        if (ack) ack({ error: "Server error" });
      }
    });

    // Client says: "I closed board 5"
    socket.on("leave-board", (boardId) => {
      socket.leave(`board:${boardId}`);
      socket.data.boards.delete(boardId);
      broadcastPresence(boardId);
    });

    socket.on("disconnect", () => {
      for (const boardId of socket.data.boards) broadcastPresence(boardId);
    });
  });
}

// Send the list of users currently viewing a board to everyone in that board
async function broadcastPresence(boardId) {
  const sockets = await io.in(`board:${boardId}`).fetchSockets();
  const users = new Map(); // Map removes duplicates (same user, two tabs)
  for (const s of sockets) {
    users.set(s.data.userId, { id: s.data.userId, name: s.data.name });
  }
  io.to(`board:${boardId}`).emit("presence", [...users.values()]);
}

// Used by the REST routes to announce a change
function emitToBoard(boardId, event, payload) {
  if (io) io.to(`board:${boardId}`).emit(event, payload);
}

module.exports = { initSocket, emitToBoard };




