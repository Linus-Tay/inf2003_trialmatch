import { createContext, useContext, useEffect, useMemo, useState } from "react";

import api from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("trialmatch_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("trialmatch_token");

    if (!token) {
      setIsCheckingAuth(false);
      return;
    }

    api
      .get("/auth/me")
      .then((response) => {
        setUser(response.data);
        localStorage.setItem("trialmatch_user", JSON.stringify(response.data));
      })
      .catch(() => {
        localStorage.removeItem("trialmatch_token");
        localStorage.removeItem("trialmatch_user");
        setUser(null);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    localStorage.setItem("trialmatch_token", response.data.access_token);
    localStorage.setItem("trialmatch_user", JSON.stringify(response.data.user));
    setUser(response.data.user);
    return response.data.user;
  }

  async function signup(fullName, email, password) {
    const response = await api.post("/auth/signup", {
      full_name: fullName,
      email,
      password,
    });
    localStorage.setItem("trialmatch_token", response.data.access_token);
    localStorage.setItem("trialmatch_user", JSON.stringify(response.data.user));
    setUser(response.data.user);
    return response.data.user;
  }

  function logout() {
    localStorage.removeItem("trialmatch_token");
    localStorage.removeItem("trialmatch_user");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), isCheckingAuth, login, signup, logout }),
    [user, isCheckingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
