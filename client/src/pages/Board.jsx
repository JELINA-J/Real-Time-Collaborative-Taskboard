import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { io } from "socket.io-client";
import { api, API_URL } from "../api";
import Topbar from "../components/Topbar";
import TaskModal from "../components/TaskModal";
import { toShortDate } from "../dates";
import { useAuth } from "../AuthContext";
// Small pure functions: take the columns, return new columns.
// Each one is safe to run twice with the same data.
const withTaskAdded = (cols, task) =>
  cols.some((c) => c.tasks.some((t) => t.id === task.id))
    ? cols // already on screen (we created it ourselves), do nothing
    : cols.map((c) => (c.id === task.column_id ? { ...c, tasks: [...c.tasks, task] } : c));

const withTaskReplaced = (cols, updated) =>
  cols.map((c) => ({
    ...c,
    tasks: c.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
  }));

const withTaskRemoved = (cols, taskId) =>
  cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }));

const withTaskMoved = (cols, task) => {
  const existing = cols.flatMap((c) => c.tasks).find((t) => t.id === task.id);
  const merged = { ...existing, ...task };
  return withTaskRemoved(cols, task.id).map((c) => {
    if (c.id !== task.column_id) return c;
    const tasks = [...c.tasks];
    tasks.splice(Math.min(task.position, tasks.length), 0, merged);
    return { ...c, tasks };
  });
};

export default function Board() {
  const { user } = useAuth();
  const { id } = useParams();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTitles, setNewTitles] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState([]);          // users viewing this board now
  const [connected, setConnected] = useState(false); // is the live connection up?
  const [liveComment, setLiveComment] = useState(null);

  const loadBoard = useCallback(async () => {
    try {
      const data = await api(`/api/boards/${id}`);
      setBoard(data.board);
      setColumns(data.columns);
      const m = await api(`/api/workspaces/${data.board.workspace_id}/members`);
      setMembers(m.members);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Live connection: opens when the page opens, closes when you leave it
  useEffect(() => {
    const socket = io(API_URL, { auth: { token: localStorage.getItem("token") } });
    let firstConnect = true;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-board", Number(id), (res) => {
        if (res && res.error) setError(res.error);
      });
      // After a reconnect we may have missed events, so load fresh data
      if (!firstConnect) loadBoard();
      firstConnect = false;
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("presence", (users) => setOnline(users));
    socket.on("task:created", ({ task }) => setColumns((cols) => withTaskAdded(cols, task)));
    socket.on("task:updated", ({ task }) => setColumns((cols) => withTaskReplaced(cols, task)));
    socket.on("task:moved", ({ task }) => setColumns((cols) => withTaskMoved(cols, task)));
    socket.on("task:deleted", ({ taskId }) => setColumns((cols) => withTaskRemoved(cols, taskId)));
    socket.on("comment:added", (data) => {
      setLiveComment(data); // for an open task panel
      // add 1 to that task's count on the board
      setColumns((cols) =>
        cols.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) =>
            t.id === data.taskId ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t
          ),
        }))
      );
    });
    return () => socket.disconnect(); // cleanup when leaving the page
  }, [id, loadBoard]);

  async function addTask(e, columnId) {
    e.preventDefault();
    const title = (newTitles[columnId] || "").trim();
    if (!title) return;
    try {
      const data = await api("/api/tasks", { method: "POST", body: { columnId, title } });
      setColumns((cols) => withTaskAdded(cols, data.task));
      setNewTitles({ ...newTitles, [columnId]: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const fromId = Number(source.droppableId);
    const toId = Number(destination.droppableId);
    const taskId = Number(draggableId);

    // Update the screen immediately (optimistic update)
    setColumns((cols) => {
      const next = cols.map((c) => ({ ...c, tasks: [...c.tasks] }));
      const from = next.find((c) => c.id === fromId);
      const to = next.find((c) => c.id === toId);
      const [moved] = from.tasks.splice(source.index, 1);
      to.tasks.splice(destination.index, 0, { ...moved, column_id: toId });
      return next;
    });

    try {
      await api(`/api/tasks/${taskId}/move`, {
        method: "PATCH",
        body: { columnId: toId, position: destination.index },
      });
    } catch (err) {
      setError(err.message);
      loadBoard();
    }
  }

  const memberName = (userId) => members.find((m) => m.id === userId)?.name;
  const openTask = columns.flatMap((c) => c.tasks).find((t) => t.id === openTaskId);

  if (loading) return <><Topbar /><div className="page">Loading...</div></>;
  if (!board) return <><Topbar /><div className="page"><div className="error">{error}</div><Link to="/">Back</Link></div></>;

  return (
    <>
      <Topbar />
      <div className="page" style={{ maxWidth: "none", paddingBottom: 0 }}>
        <Link to={`/workspaces/${board.workspace_id}`}>← Back to workspace</Link>
        <div className="row">
          <h1 style={{ margin: "8px 0 0" }}>{board.name}</h1>
          <div className="presence">
            <span className={connected ? "live" : "offline"}>
              {connected ? "● Live" : "○ Reconnecting..."}
            </span>
            {online.map((u) => (
              <span key={u.id} className="avatar" title={u.name}>
                {u.name[0].toUpperCase()}
              </span>
            ))}
          </div>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="board">
          {columns.map((col) => (
            <div key={col.id} className="column">
              <h3>{col.name} <span className="muted">({col.tasks.length})</span></h3>

              <Droppable droppableId={String(col.id)}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`drop-zone ${snapshot.isDraggingOver ? "over" : ""}`}
                  >
                    {col.tasks.map((t, index) => (
                      <Draggable key={t.id} draggableId={String(t.id)} index={index}>
                        {(drag, dragSnapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className="task"
                            style={{
                              ...drag.draggableProps.style,
                              boxShadow: dragSnapshot.isDragging
                                ? "0 6px 16px rgba(0,0,0,.35)"
                                : undefined,
                            }}
                            onClick={() => setOpenTaskId(t.id)}
                          >
                            <div>{t.title}</div>
                            <div className="task-meta">
                              <span>{t.due_date ? `📅 ${toShortDate(t.due_date)}` : ""}</span>
                              <span>{t.comment_count > 0 ? `💬 ${t.comment_count}` : ""}</span>
                              <span>{t.assignee_id ? `👤 ${memberName(t.assignee_id) || ""}` : ""}</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <form onSubmit={(e) => addTask(e, col.id)}>
                <input
                  placeholder="+ Add a task"
                  value={newTitles[col.id] || ""}
                  onChange={(e) => setNewTitles({ ...newTitles, [col.id]: e.target.value })}
                />
              </form>
            </div>
          ))}
        </div>
      </DragDropContext>

      {openTask && (
        <TaskModal
          key={openTask.id}
          task={openTask}
          members={members}
          currentUserId={user.id}
          isAdmin={board.role === "admin"}
          liveComment={liveComment}
          onClose={() => setOpenTaskId(null)}
          onUpdated={(t) => setColumns((cols) => withTaskReplaced(cols, t))}
          onDeleted={(taskId) => setColumns((cols) => withTaskRemoved(cols, taskId))}
        />
      )}
    </>
  );
}