import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <Link to="/">Taskboard</Link>
      <div>
        <span style={{ marginRight: 12 }}>{user.name}</span>
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  );
}