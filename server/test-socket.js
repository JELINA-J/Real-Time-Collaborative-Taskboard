const { io } = require("socket.io-client");

const token = process.argv[2];
const boardId = Number(process.argv[3]);

const socket = io("http://localhost:4000", { auth: { token } });

socket.on("connect", () => {
  console.log("connected");
  socket.emit("join-board", boardId, (res) => console.log("join result:", res));
});

socket.on("connect_error", (e) => console.log("connect error:", e.message));
socket.on("presence", (users) => console.log("online:", users));

["task:created", "task:updated", "task:moved", "task:deleted", "comment:added"].forEach((ev) =>
  socket.on(ev, (data) => console.log(ev, data))
);