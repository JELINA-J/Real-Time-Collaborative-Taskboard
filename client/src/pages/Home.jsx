import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Topbar from "../components/Topbar";

export default function Home() {
  const [workspaces, setWorkspaces] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Runs once when the page opens
  useEffect(() => {
    api("/api/workspaces")
      .then((data) => setWorkspaces(data.workspaces))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function createWorkspace(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const data = await api("/api/workspaces", { method: "POST", body: { name } });
      setWorkspaces([...workspaces, data.workspace]); // add to the list without reloading
      setName("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Topbar />
      <div className="page">
        <h1>Your workspaces</h1>
        {error && <div className="error">{error}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : workspaces.length === 0 ? (
          <p className="muted">No workspaces yet. Create your first one below.</p>
        ) : (
          <div className="grid">
            {workspaces.map((w) => (
              <Link key={w.id} to={`/workspaces/${w.id}`} className="card">
                <strong>{w.name}</strong>
                <span className="badge">{w.role}</span>
              </Link>
            ))}
          </div>
        )}

        <form className="inline-form" onSubmit={createWorkspace}>
          <input placeholder="New workspace name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create</button>
        </form>
      </div>
    </>
  );
}