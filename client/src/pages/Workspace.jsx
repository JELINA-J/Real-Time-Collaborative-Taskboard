import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Topbar from "../components/Topbar";

export default function Workspace() {
  const { id } = useParams(); // the :id from the URL
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [boardName, setBoardName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load members and boards at the same time
    Promise.all([api(`/api/workspaces/${id}/members`), api(`/api/workspaces/${id}/boards`)])
      .then(([m, b]) => {
        setWorkspace(m.workspace);
        setMembers(m.members);
        setBoards(b.boards);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function createBoard(e) {
    e.preventDefault();
    if (!boardName.trim()) return;
    setError("");
    try {
      const data = await api(`/api/workspaces/${id}/boards`, { method: "POST", body: { name: boardName } });
      setBoards([...boards, data.board]);
      setBoardName("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function addMember(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    try {
      const data = await api(`/api/workspaces/${id}/members`, { method: "POST", body: { email } });
      setMembers([...members, { ...data.member, role: "member" }]);
      setEmail("");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <><Topbar /><div className="page">Loading...</div></>;
  if (!workspace) return <><Topbar /><div className="page"><div className="error">{error}</div><Link to="/">Back</Link></div></>;

  const isAdmin = workspace.role === "admin";

  return (
    <>
      <Topbar />
      <div className="page">
        <Link to="/">← All workspaces</Link>
        <h1>
          {workspace.name}
          <span className="badge">{workspace.role}</span>
        </h1>
        {error && <div className="error">{error}</div>}

        <h2>Boards</h2>
        {boards.length === 0 ? (
          <p className="muted">No boards yet.{isAdmin && " Create one below."}</p>
        ) : (
          <div className="grid">
            {boards.map((b) => (
              <Link key={b.id} to={`/boards/${b.id}`} className="card">
                <strong>{b.name}</strong>
              </Link>
            ))}
          </div>
        )}
        {isAdmin && (
          <form className="inline-form" onSubmit={createBoard}>
            <input placeholder="New board name" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
            <button type="submit">Create board</button>
          </form>
        )}

        <h2>Members</h2>
        <ul>
          {members.map((m) => (
            <li key={m.id}>
              {m.name} <span className="muted">({m.email})</span>
              <span className="badge">{m.role}</span>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form className="inline-form" onSubmit={addMember}>
            <input type="email" placeholder="Add member by email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        )}
      </div>
    </>
  );
}