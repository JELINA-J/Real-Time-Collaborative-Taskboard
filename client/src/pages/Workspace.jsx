
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Topbar from "../components/Topbar";

export default function Workspace() {
  const { id } = useParams();

  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [boards, setBoards] = useState([]);

  const [boardName, setBoardName] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setError("");

      try {
        const [m, b] = await Promise.all([
          api(`/api/workspaces/${id}/members`),
          api(`/api/workspaces/${id}/boards`)
        ]);

        if (!active) return;

        setWorkspace(m.workspace);
        setMembers(m.members || []);
        setBoards(b.boards || []);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
  }, [id]);

  const isAdmin = workspace?.role === "admin";

  const filteredBoards = useMemo(() => {
    return boards.filter((board) =>
      board.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [boards, search]);
  async function createBoard(e) {
    e.preventDefault();

    const name = boardName.trim();
    if (!name) return;

    setError("");
    setCreatingBoard(true);

    try {
      const data = await api(`/api/workspaces/${id}/boards`, {
        method: "POST",
        body: { name }
      });

      setBoards((previous) => [...previous, data.board]);
      setBoardName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingBoard(false);
    }
  }

  async function addMember(e) {
    e.preventDefault();

    const memberEmail = email.trim();
    if (!memberEmail) return;

    setError("");
    setAddingMember(true);

    try {
      const data = await api(`/api/workspaces/${id}/members`, {
        method: "POST",
        body: { email: memberEmail }
      });

      setMembers((previous) => [
        ...previous,
        { ...data.member, role: data.member.role || "member" }
      ]);

      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMember(false);
    }
  }



  function getInitial(name, emailAddress) {
    return (name || emailAddress || "?").charAt(0).toUpperCase();
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="workspace-loading">Loading workspace...</div>
      </>
    );
  }

  if (!workspace) {
    return (
      <>
        <Topbar />
        <div className="page">
          <div className="error">{error || "Workspace not found."}</div>
          <Link to="/">← Back to workspaces</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <main className="workspace-dashboard">

        {/* Breadcrumb */}
        <div className="workspace-breadcrumb">
          <Link to="/">← All workspaces</Link>
          <span>/</span>
          <span>{workspace.name}</span>
        </div>

        {/* Workspace header */}
        <section className="workspace-hero">
          <div className="workspace-identity">
            <div className="workspace-icon">▦</div>

            <div>
              <span className="workspace-eyebrow">WORKSPACE</span>
              <h1>{workspace.name}</h1>
              <div className="workspace-subtitle">
                Organize your projects and collaborate with your team.
              </div>
            </div>
          </div>

          <span className={`workspace-role ${isAdmin ? "admin" : ""}`}>
            {isAdmin ? "♛ Admin" : "♙ Member"}
          </span>
        </section>

        {error && <div className="error">{error}</div>}

        {/* Overview */}
        <section className="workspace-overview">
          <div className="overview-card">
            <div className="overview-icon purple">▦</div>
            <div>
              <span>Total boards</span>
              <strong>{boards.length}</strong>
              <small>Boards in this workspace</small>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon green">♙</div>
            <div>
              <span>Team members</span>
              <strong>{members.length}</strong>
              <small>People in this workspace</small>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon orange">✦</div>
            <div>
              <span>Your access</span>
              <strong className="access-value">
                {isAdmin ? "Admin" : "Member"}
              </strong>
              <small>Your workspace role</small>
            </div>
          </div>
        </section>

        {/* Boards section */}
        <section className="workspace-section">

          <div className="workspace-section-header">
            <div>
              <span className="workspace-eyebrow">YOUR PROJECTS</span>
              <h2>Boards</h2>
              <p>Open a board to manage tasks and collaborate.</p>
            </div>

            {isAdmin && (
              <button
                className="workspace-primary-btn"
                onClick={() => document.getElementById("new-board-input")?.focus()}
              >
                + Create board
              </button>
            )}
          </div>

          {/* Search and view controls */}
          <div className="board-toolbar">
            <div className="board-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="view-switch">
              <button
                type="button"
                className={view === "grid" ? "active" : ""}
                onClick={() => setView("grid")}
                title="Grid view"
              >
                ▦
              </button>
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                onClick={() => setView("list")}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>

          {/* Board cards */}
          {filteredBoards.length > 0 ? (
            <div className={`workspace-board-list ${view}`}>
              {filteredBoards.map((board) => {
                <div className="board-card-top">
                  <div className="board-card-icon">▤</div>
                </div>

                return (
                  <article className="workspace-board-card" key={board.id}>
                    <div className="board-card-top">
                      <div className="board-card-icon">▤</div>

                      <button
                        type="button"
                        className={`board-favorite ${favorite ? "selected" : ""}`}
                        onClick={() => toggleFavorite(board.id)}
                        aria-label={
                          favorite ? "Remove favorite" : "Add favorite"
                        }
                        title={
                          favorite ? "Remove favorite" : "Add favorite"
                        }
                      >
                        {favorite ? "★" : "☆"}
                      </button>
                    </div>

                    <Link
                      to={`/boards/${board.id}`}
                      className="board-card-link"
                    >
                      <h3>{board.name}</h3>
                      <p>Open board and manage your tasks</p>

                      <div className="board-card-footer">
                        <span>View board</span>
                        <span>→</span>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="workspace-empty">
              <div className="workspace-empty-icon">▤</div>
              <h3>
                {search ? "No matching boards" : "No boards yet"}
              </h3>
              <p>
                {search
                  ? "Try another board name."
                  : isAdmin
                    ? "Create your first board to start organizing work."
                    : "Ask your workspace admin to create a board."}
              </p>
            </div>
          )}

          {/* Create board form */}
          {isAdmin && (
            <form className="workspace-create-form" onSubmit={createBoard}>
              <div>
                <label htmlFor="new-board-input">Create a new board</label>
                <input
                  id="new-board-input"
                  type="text"
                  placeholder="Enter board name..."
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <button
                type="submit"
                disabled={creatingBoard || !boardName.trim()}
              >
                {creatingBoard ? "Creating..." : "+ Create board"}
              </button>
            </form>
          )}
        </section>

        {/* Members section */}
        <section className="workspace-section members-section">

          <div className="workspace-section-header">
            <div>
              <span className="workspace-eyebrow">COLLABORATION</span>
              <h2>Team members</h2>
              <p>People who have access to this workspace.</p>
            </div>

            <span className="member-total">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <div className="workspace-members-grid">
            {members.map((member) => (
              <div className="workspace-member-card" key={member.id}>
                <div className="member-avatar">
                  {getInitial(member.name, member.email)}
                </div>

                <div className="member-details">
                  <strong>{member.name || "Unnamed member"}</strong>
                  <span>{member.email}</span>
                </div>

                <span
                  className={`member-role ${member.role === "admin" ? "admin" : ""
                    }`}
                >
                  {member.role || "member"}
                </span>
              </div>
            ))}
          </div>

          {/* Add member form */}
          {isAdmin && (
            <form className="workspace-add-member" onSubmit={addMember}>
              <div>
                <label htmlFor="member-email">Invite a team member</label>
                <p>Enter the email address of an existing user.</p>
              </div>

              <div className="invite-controls">
                <input
                  id="member-email"
                  type="email"
                  placeholder="Enter email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <button type="submit" disabled={addingMember || !email.trim()}>
                  {addingMember ? "Adding..." : "+ Add member"}
                </button>
              </div>
            </form>
          )}
        </section>

      </main>
    </>
  );
}
