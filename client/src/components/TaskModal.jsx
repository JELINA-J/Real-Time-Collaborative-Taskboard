import { useEffect, useState } from "react";
import { api } from "../api";
import { toInputDate } from "../dates";

export default function TaskModal({ task, members, isAdmin, currentUserId, liveComment, onClose, onUpdated, onDeleted }) {
  // Local copies of the fields, so typing doesn't change the board until we save
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState(toInputDate(task.due_date));
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Same rules as the server (the server is the one that really enforces them)
  const isAssignee = task.assignee_id === currentUserId;
  const canEdit = isAdmin || isAssignee || !task.assignee_id;
  const canChangeAssignee = isAdmin || !task.assignee_id;
  // Admins can pick anyone; a member can only pick themselves (to claim the task)
  const assignableMembers = isAdmin ? members : members.filter((m) => m.id === currentUserId);

  // Load this task's comments when the panel opens
  useEffect(() => {
    api(`/api/tasks/${task.id}/comments`)
      .then((data) => setComments(data.comments))
      .catch((err) => setError(err.message));
  }, [task.id]);

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
      setCommentText("");
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
                    <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {!canEdit && (
          <p className="muted">
            Only admins or the assignee can edit this task. You can still comment.
          </p>
        )}

        <label>Title</label>
        <input value={title} disabled={!canEdit} onChange={(e) => setTitle(e.target.value)} />

        <label>Description</label>
        <textarea value={description} disabled={!canEdit} onChange={(e) => setDescription(e.target.value)} />

        <label>Due date</label>
        <input type="date" value={dueDate} disabled={!canEdit} onChange={(e) => setDueDate(e.target.value)} />

        <label>Assigned to</label>
        <select value={assigneeId} disabled={!canChangeAssignee} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {/* Keep the current assignee visible even when the dropdown is locked */}
          {task.assignee_id && !assignableMembers.some((m) => m.id === task.assignee_id) && (
            <option value={task.assignee_id}>
              {members.find((m) => m.id === task.assignee_id)?.name || "Assigned"}
            </option>
          )}
          {assignableMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ marginBottom: 20 }}>
          {canEdit ? (
            <button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          ) : (
            <span />
          )}
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