import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import Topbar from "../components/Topbar";
import "./Home.css";

const getArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

const formatDate = (date) => {
  if (!date) return "No due date";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "No due date";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getDeadlineLabel = (date) => {
  if (!date) return "";

  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return "";

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(due, today)) return "Due today";
  if (isSameDay(due, tomorrow)) return "Due tomorrow";
  if (due < today) return "Overdue";

  return formatDate(date);
};

export default function Home() {
  const { user } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [search, setSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const username =
    user?.name ||
    user?.username ||
    user?.email?.split("@")[0] ||
    "there";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Existing API: fetch the user's workspaces.
      const workspaceResponse = await api("/api/workspaces");
      const workspaceList = getArray(workspaceResponse, "workspaces");

      setWorkspaces(workspaceList);

      // Existing APIs: fetch boards and members for each workspace.
      const details = await Promise.all(
        workspaceList.map(async (workspace) => {
          const [boardsResult, membersResult] = await Promise.allSettled([
            api(`/api/workspaces/${workspace.id}/boards`),
            api(`/api/workspaces/${workspace.id}/members`),
          ]);

          const boards =
            boardsResult.status === "fulfilled"
              ? getArray(boardsResult.value, "boards")
              : [];

          const members =
            membersResult.status === "fulfilled"
              ? getArray(membersResult.value, "members")
              : [];

          // Existing API: fetch each board and its columns/tasks.
          const boardDetails = await Promise.all(
            boards.map(async (board) => {
              try {
                const response = await api(`/api/boards/${board.id}`);

                return {
                  ...board,
                  board: response.board || board,
                  columns: response.columns || [],
                };
              } catch {
                return {
                  ...board,
                  board,
                  columns: [],
                };
              }
            })
          );

          return {
            workspace,
            members,
            boards: boardDetails,
          };
        })
      );

      setDashboardData(details);
    } catch (err) {
      setError(err.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Flatten the tasks while retaining their workspace and board information.
  const allTasks = useMemo(() => {
    return dashboardData.flatMap((workspaceData) =>
      workspaceData.boards.flatMap((boardData) => {
        const columns = boardData.columns || [];
        const lastColumnId = columns.length
          ? columns[columns.length - 1].id
          : null;

        return columns.flatMap((column) =>
          (column.tasks || []).map((task) => ({
            ...task,
            column_name: column.name,
            board_id: boardData.id,
            board_name: boardData.board?.name || boardData.name,
            workspace_id: workspaceData.workspace.id,
            workspace_name: workspaceData.workspace.name,
            is_completed: column.id === lastColumnId,
          }))
        );
      })
    );
  }, [dashboardData]);

  const completedTasks = allTasks.filter((task) => task.is_completed);
  const openTasks = allTasks.filter((task) => !task.is_completed);

  const myTasks = openTasks.filter(
    (task) => String(task.assignee_id) === String(user?.id)
  );

  const upcomingTasks = openTasks
    .filter((task) => {
      if (!task.due_date) return false;

      const due = new Date(task.due_date);
      if (Number.isNaN(due.getTime())) return false;

      const end = new Date();
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);

      return due <= end;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const notifications = upcomingTasks.filter((task) => {
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return due <= today || due <= new Date(Date.now() + 86400000);
  });

  // Client-side global search across data already loaded from the API.
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    const workspaceResults = dashboardData
      .filter((item) => item.workspace.name?.toLowerCase().includes(query))
      .map((item) => ({
        type: "Workspace",
        title: item.workspace.name,
        url: `/workspaces/${item.workspace.id}`,
      }));

    const boardResults = dashboardData.flatMap((item) =>
      item.boards
        .filter((board) =>
          (board.board?.name || board.name || "")
            .toLowerCase()
            .includes(query)
        )
        .map((board) => ({
          type: "Board",
          title: board.board?.name || board.name,
          url: `/boards/${board.id}`,
        }))
    );

    const taskResults = allTasks
      .filter((task) => task.title?.toLowerCase().includes(query))
      .map((task) => ({
        type: "Task",
        title: task.title,
        subtitle: task.board_name,
        url: `/boards/${task.board_id}`,
      }));

    return [...workspaceResults, ...boardResults, ...taskResults].slice(0, 8);
  }, [search, dashboardData, allTasks]);

  async function createWorkspace(e) {
    e.preventDefault();

    const name = workspaceName.trim();
    if (!name) return;

    setCreating(true);
    setError("");

    try {
      // Preserves your existing workspace creation API.
      await api("/api/workspaces", {
        method: "POST",
        body: { name },
      });

      setWorkspaceName("");
      setShowCreate(false);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Could not create workspace.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <main className="home-page">
          <div className="home-loading">
            <div className="loading-spinner" />
            <p>Preparing your workspace...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <main className="home-page">
        {/* Welcome and global search */}
        <section className="home-header">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              Good to see you, {username} <span>👋</span>
            </h1>
            <p className="home-subtitle">
              Here's what's happening across your projects today.
            </p>
          </div>

          <div className="header-actions">
            <div className="global-search">
              <span className="search-icon">⌕</span>
              <input
                type="search"
                placeholder="Search workspaces, boards, tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}

              {search.trim() && (
                <div className="search-results">
                  <p className="dropdown-heading">SEARCH RESULTS</p>

                  {searchResults.length ? (
                    searchResults.map((result, index) => (
                      <Link
                        to={result.url}
                        className="search-result"
                        key={`${result.type}-${index}`}
                        onClick={() => setSearch("")}
                      >
                        <span className="search-result-icon">
                          {result.type === "Workspace"
                            ? "▦"
                            : result.type === "Board"
                            ? "▤"
                            : "✓"}
                        </span>
                        <span>
                          <strong>{result.title}</strong>
                          <small>
                            {result.type}
                            {result.subtitle ? ` · ${result.subtitle}` : ""}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="dropdown-empty">No matching results found.</p>
                  )}
                </div>
              )}
            </div>

            <div className="notification-wrap">
              <button
                className="notification-button"
                onClick={() => setShowNotifications((value) => !value)}
                aria-label="Notifications"
              >
                ♧
                {notifications.length > 0 && (
                  <span className="notification-count">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-panel">
                  <div className="dropdown-title-row">
                    <strong>Notifications</strong>
                    <button onClick={() => setShowNotifications(false)}>
                      ×
                    </button>
                  </div>

                  {notifications.length ? (
                    notifications.slice(0, 6).map((task) => (
                      <Link
                        to={`/boards/${task.board_id}`}
                        className="notification-item"
                        key={task.id}
                        onClick={() => setShowNotifications(false)}
                      >
                        <span className="notification-dot" />
                        <span>
                          <strong>{task.title}</strong>
                          <small>
                            {getDeadlineLabel(task.due_date)} ·{" "}
                            {task.board_name}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="dropdown-empty">
                      No tasks due today or tomorrow.
                    </p>
                  )}

                  <p className="notification-note">
                    Reminders are calculated from your task due dates.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && <div className="home-error">{error}</div>}

        {/* Statistics */}
        <section className="stats-grid">
          <StatCard
            icon="▦"
            label="Workspaces"
            value={workspaces.length}
            color="purple"
          />
          <StatCard
            icon="▤"
            label="Boards"
            value={dashboardData.reduce(
              (total, item) => total + item.boards.length,
              0
            )}
            color="blue"
          />
          <StatCard
            icon="✓"
            label="Total tasks"
            value={allTasks.length}
            color="orange"
          />
          <StatCard
            icon="◉"
            label="Completed"
            value={completedTasks.length}
            color="green"
            helper={
              allTasks.length
                ? `${Math.round(
                    (completedTasks.length / allTasks.length) * 100
                  )}% completion`
                : "No tasks yet"
            }
          />
        </section>

        {/* Workspace section */}
        <section className="home-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PROJECTS</p>
              <h2>Workspaces</h2>
              <p className="section-description">
                Keep your teams and projects organized.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowCreate((value) => !value)}
            >
              + Create workspace
            </button>
          </div>

          {showCreate && (
            <form className="create-workspace-form" onSubmit={createWorkspace}>
              <input
                autoFocus
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                maxLength={80}
                required
              />
              <button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </form>
          )}

          {dashboardData.length ? (
            <div className="workspace-grid">
              {dashboardData.map((item, index) => {
                const workspace = item.workspace;
                const workspaceTasks = item.boards.reduce(
                  (total, board) =>
                    total +
                    board.columns.reduce(
                      (count, column) =>
                        count + (column.tasks?.length || 0),
                      0
                    ),
                  0
                );

                const colors = ["violet", "cyan", "peach", "green"];
                const color = colors[index % colors.length];

                return (
                  <Link
                    to={`/workspaces/${workspace.id}`}
                    className="workspace-card"
                    key={workspace.id}
                  >
                    <div className={`workspace-card-accent ${color}`} />

                    <div className="workspace-card-content">
                      <div className="workspace-card-top">
                        <div className={`workspace-icon ${color}`}>
                          {getInitials(workspace.name)}
                        </div>
                        <span className="workspace-arrow">↗</span>
                      </div>

                      <h3>{workspace.name}</h3>
                      <span className="workspace-role">
                        {workspace.role || "Member"}
                      </span>

                      <div className="workspace-card-stats">
                        <span>▤ {item.boards.length} boards</span>
                        <span>✓ {workspaceTasks} tasks</span>
                      </div>

                      <div className="workspace-card-bottom">
                        <div className="member-avatars">
                          {item.members.slice(0, 5).map((member, memberIndex) => (
                            <span
                              className={`member-avatar avatar-${memberIndex % 5}`}
                              key={member.id}
                              title={member.name || member.email || "Member"}
                            >
                              {member.avatar_url || member.avatar ? (
                                <img
                                  src={member.avatar_url || member.avatar}
                                  alt={member.name || "Member"}
                                />
                              ) : (
                                getInitials(member.name || member.email)
                              )}
                            </span>
                          ))}
                          {item.members.length > 5 && (
                            <span className="member-avatar more-members">
                              +{item.members.length - 5}
                            </span>
                          )}
                        </div>

                        <span className="member-count">
                          {item.members.length} members
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="home-empty">
              <div className="empty-illustration">▦</div>
              <h3>Your workspace starts here</h3>
              <p>Create a workspace to organize boards, tasks and teammates.</p>
              <button
                className="primary-button"
                onClick={() => setShowCreate(true)}
              >
                + Create your first workspace
              </button>
            </div>
          )}
        </section>

        {/* My tasks and deadlines */}
        <section className="dashboard-columns">
          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">ASSIGNED TO YOU</p>
                <h2>My Tasks</h2>
              </div>
              <span className="panel-count">{myTasks.length}</span>
            </div>

            {myTasks.length ? (
              <div className="task-list">
                {myTasks.slice(0, 6).map((task) => (
                  <Link
                    to={`/boards/${task.board_id}`}
                    className="home-task"
                    key={task.id}
                  >
                    <span className="task-check-circle" />
                    <span className="home-task-info">
                      <strong>{task.title}</strong>
                      <small>
                        {task.board_name} · {task.workspace_name}
                      </small>
                    </span>
                    <span className="task-date">
                      {formatDate(task.due_date)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="panel-empty">
                <span>✓</span>
                <p>No open tasks assigned to you.</p>
              </div>
            )}
          </div>

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">NEXT 7 DAYS</p>
                <h2>Upcoming deadlines</h2>
              </div>
              <span className="panel-count">{upcomingTasks.length}</span>
            </div>

            {upcomingTasks.length ? (
              <div className="task-list">
                {upcomingTasks.slice(0, 6).map((task) => {
                  const label = getDeadlineLabel(task.due_date);

                  return (
                    <Link
                      to={`/boards/${task.board_id}`}
                      className="home-task"
                      key={task.id}
                    >
                      <span
                        className={`deadline-indicator ${
                          label === "Overdue"
                            ? "overdue"
                            : label === "Due today"
                            ? "today"
                            : ""
                        }`}
                      />
                      <span className="home-task-info">
                        <strong>{task.title}</strong>
                        <small>{task.board_name}</small>
                      </span>
                      <span
                        className={`deadline-label ${
                          label === "Overdue" ? "overdue-text" : ""
                        }`}
                      >
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="panel-empty">
                <span>◷</span>
                <p>No upcoming deadlines in the next 7 days.</p>
              </div>
            )}
          </div>
        </section>

        {/* Activity timeline */}
        <section className="home-section activity-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">STAY IN THE LOOP</p>
              <h2>Recent activity</h2>
              <p className="section-description">
                Keep track of what's changing across your workspaces.
              </p>
            </div>
          </div>

          <div className="activity-empty">
            <span className="activity-empty-icon">◷</span>
            <div>
              <strong>No activity history available yet</strong>
              <p>
                Your current API provides workspace and task data, but does
                not expose a saved activity feed. Add an activity endpoint to
                show who created, updated, moved or completed tasks.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function StatCard({ icon, label, value, color, helper }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </div>
    </div>
  );
}