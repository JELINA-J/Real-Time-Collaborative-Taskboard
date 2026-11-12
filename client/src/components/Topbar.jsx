import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <Link to="/" className="brand">▦ Taskboard</Link>
      <div className="topbar-right">
        <span className="avatar">{user.name[0].toUpperCase()}</span>
        <span className="user-name">{user.name}</span>
        <button className="btn-ghost" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}