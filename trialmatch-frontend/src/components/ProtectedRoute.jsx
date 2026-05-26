import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Checking session...</div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}
