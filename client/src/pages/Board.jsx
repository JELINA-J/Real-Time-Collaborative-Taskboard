import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Topbar from "../components/Topbar";
import TaskModal from "../components/TaskModal";
import { toShortDate } from "../dates";

export default function Board() {
  const { id } = useParams();
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTitles, setNewTitles] = useState({}); // what's typed in each column's box
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api(`/api/boards/${id}`);
        setBoard(data.board);
        setColumns(data.columns);
        // Members are needed for the "Assigned to" dropdown and for names on cards
        const m = await api(`/api/workspaces/${data.board.workspace_id}/members`);
        setMembers(m.members);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function addTask(e, columnId) {
    e.preventDefault();
    const title = (newTitles[columnId] || "").trim();
    if (!title) return;
    try {
      const data = await api("/api/tasks", { method: "POST", body: { columnId, title } });
      setColumns((cols) =>
        cols.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, data.task] } : c))
      );
      setNewTitles({ ...newTitles, [columnId]: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  // After the panel saves, update that task everywhere on the board
  function replaceTask(updated) {
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
      }))
    );
  }

  function removeTask(taskId) {
    setColumns((cols) =>
      cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }))
    );
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
        <h1 style={{ margin: "8px 0 0" }}>{board.name}</h1>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="board">
        {columns.map((col) => (
          <div key={col.id} className="column">
            <h3>{col.name} <span className="muted">({col.tasks.length})</span></h3>

            {col.tasks.map((t) => (
              <div key={t.id} className="task" onClick={() => setOpenTaskId(t.id)}>
                <div>{t.title}</div>
                <div className="task-meta">
                  <span>{t.due_date ? `📅 ${toShortDate(t.due_date)}` : ""}</span>
                  <span>{t.assignee_id ? `👤 ${memberName(t.assignee_id) || ""}` : ""}</span>
                </div>
              </div>
            ))}

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

      {openTask && (
        <TaskModal
          key={openTask.id}
          task={openTask}
          members={members}
          isAdmin={board.role === "admin"}
          onClose={() => setOpenTaskId(null)}
          onUpdated={replaceTask}
          onDeleted={removeTask}
        />
      )}
    </>
  );
}
