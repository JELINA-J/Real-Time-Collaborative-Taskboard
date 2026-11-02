import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Auth from "./pages/Auth";
import Home from "./pages/Home";

// Wrapper: show the page only if logged in, otherwise go to /login
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ textAlign: "center" }}>Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/" element={<Protected><Home /></Protected>} />
    </Routes>
  );
}