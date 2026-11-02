import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load: if a token is saved, ask the server who it belongs to
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }
    api("/api/me")
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("token")) // token expired or invalid
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem("token", data.token);
    setUser(data.user);
  }

  async function signup(name, email, password) {
    await api("/api/auth/signup", { method: "POST", body: { name, email, password } });
    await login(email, password); // log in straight after signing up
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}