import { useEffect, useState } from "react";
import { api } from "../api";
import { toInputDate } from "../dates";

export default function TaskModal({ task, members, isAdmin, liveComment, onClose, onUpdated, onDeleted }) {  // Local copies of the fields, so typing doesn't change the board until we save
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(toInputDate(task.due_date));
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load this task's comments when the panel opens
    // A comment arrived live from someone else (or from ourselves): add it once
  useEffect(() => {
    if (liveComment && liveComment.taskId === task.id) {
      setComments((prev) =>
        prev.some((c) => c.id === liveComment.comment.id) ? prev : [...prev, liveComment.comment]
      );
    }
  }, [liveComment, task.id]);

  async function save() {
    if (!title.trim()) return setError("Title cannot be empty");
    setError("");
    setSaving(true);
    try {
      const data = await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: {
          title,
          description,
          dueDate: dueDate || null,
          assigneeId: assigneeId ? Number(assigneeId) : null,
        },
      });
      onUpdated(data.task);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const data = await api(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: { text: commentText },
      });
            setComments((prev) =>
        prev.some((c) => c.id === data.comment.id) ? prev : [...prev, data.comment]
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this task?")) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onDeleted(task.id);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    // Clicking the dark background closes the panel; clicking inside it does not
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 style={{ margin: 0 }}>Task details</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />

        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <label>Assigned to</label>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ marginBottom: 20 }}>
          <button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          {isAdmin && <button className="danger" onClick={remove}>Delete task</button>}
        </div>

        <h3>Comments</h3>
        {comments.length === 0 && <p className="muted">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <strong>{c.author}</strong>
            <div>{c.text}</div>
          </div>
        ))}
        <form className="inline-form" onSubmit={addComment}>
          <input placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <button type="submit">Post</button>
        </form>
      </div>
    </div>
  );
}