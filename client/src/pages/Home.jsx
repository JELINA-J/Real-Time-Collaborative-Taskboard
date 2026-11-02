import { useAuth } from "../AuthContext";

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="container">
      <h1>Hello, {user.name}</h1>
      <p>You are logged in as {user.email}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}