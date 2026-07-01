import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

export default function AdminRoute({ children }) {
  const { user, isCheckingAuth } = useAuth();

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Checking admin access...
      </div>
    );
  }

  const isAdmin = String(user?.role_name || "").toLowerCase() === "admin";

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}