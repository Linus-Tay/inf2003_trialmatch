import {
  BarChart3,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  UserRoundSearch,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";

const navGroups = [
  {
    title: "Patient workflow",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/trials", label: "Trial Search", icon: Search },
      { to: "/patients", label: "Patient Match", icon: UserRoundSearch },
      { to: "/saved", label: "Saved Trials", icon: Bookmark },
    ],
  },
  {
    title: "Research/Admin",
    items: [
      { to: "/management", label: "Trial Management", icon: ClipboardList },
      { to: "/analytics", label: "Clinical Analytics", icon: BarChart3 },
      { to: "/criteria-analytics", label: "Criteria Analytics", icon: LineChart },
      { to: "/data-quality", label: "Data Quality", icon: ShieldAlert },
      { to: "/database-demo", label: "Database Demo", icon: FileSearch },
    ],
  },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    setMobileOpen(false);
    navigate("/login");
  }

  function renderNavLinks({ isMobile = false } = {}) {
    return (
      <nav className={`${isMobile ? "mt-8 space-y-7" : "mt-8 max-h-[calc(100vh-260px)] space-y-7 overflow-y-auto pb-4"}`}>
        {navGroups.map((group) => (
          <div key={group.title}>
            {(!collapsed || isMobile) && (
              <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                {group.title}
              </p>
            )}

            <div className="space-y-2">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    } ${collapsed && !isMobile ? "justify-center" : ""}`
                  }
                >
                  <item.icon size={18} className="shrink-0" />

                  {(!collapsed || isMobile) && <span>{item.label}</span>}

                  {collapsed && !isMobile && (
                    <span className="pointer-events-none absolute left-[4.6rem] z-50 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef4ff]">
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-blue-400/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute left-[45%] top-[20%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
      </div>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-white/70 bg-white/80 px-4 shadow-soft backdrop-blur-2xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="ml-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-glow">
            <FlaskConical size={19} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              TrialMatch
            </p>
            <p className="text-[11px] text-slate-500">
              Clinical Trial Intelligence
            </p>
          </div>
        </div>
      </header>

      {/* Mobile full-width sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl lg:hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-glow">
                  <FlaskConical size={22} />
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                    TrialMatch
                  </p>
                  <p className="text-xs text-slate-500">
                    Clinical Trial Intelligence
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
                aria-label="Close navigation menu"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              {renderNavLinks({ isMobile: true })}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    {user?.full_name?.charAt(0)}
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">
                      {user?.full_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {user?.role_name}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 92 : 300 }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
        className="fixed inset-y-0 left-0 z-40 hidden border-r border-white/70 bg-white/75 p-5 shadow-soft backdrop-blur-2xl lg:flex lg:flex-col"
      >
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="absolute -right-3 top-7 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-950 hover:text-white"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-glow">
            <FlaskConical size={22} />
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                  TrialMatch
                </p>
                <p className="text-xs text-slate-500">
                  Clinical Trial Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {renderNavLinks()}

        <div className="relative mt-6">
          <button
            type="button"
            onClick={() => collapsed && setShowProfile(!showProfile)}
            className={`border border-slate-200 bg-white/70 transition ${
              collapsed
                ? "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl p-0"
                : "w-full rounded-3xl p-4"
            }`}
          >
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              {user?.full_name?.charAt(0)}
            </div>

            {!collapsed && (
              <div className="mt-3">
                <p className="font-semibold text-slate-950">
                  {user?.full_name}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {user?.email}
                </p>
                <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {user?.role_name}
                </p>
              </div>
            )}
          </button>

          {collapsed && showProfile && (
            <div className="absolute bottom-0 left-[70px] z-50 w-56 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
              <p className="font-semibold text-slate-950">
                {user?.full_name}
              </p>
              <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
              <p className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {user?.role_name}
              </p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700 ${
              collapsed ? "mx-auto w-14 px-0" : ""
            }`}
          >
            <LogOut size={16} />
            {!collapsed && "Logout"}
          </button>
        </div>
      </motion.aside>

      <section
        className={`relative z-10 pt-20 transition-all duration-300 lg:pt-0 ${
          collapsed ? "lg:pl-[92px]" : "lg:pl-[300px]"
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 py-6">
          <Outlet />
        </div>
      </section>
    </main>
  );
}