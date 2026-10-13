import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import {
  Menu,
  X,
  Church,
  LayoutDashboard,
  Users,
  CalendarCheck,
  QrCode,
  CalendarDays,
  Heart,
  FileBarChart,
  Settings as SettingsIcon,
  MapPinned, MessageSquare,
  LogOut,
} from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/auth";
const Home = React.lazy(() => import("./pages/Home"));
const Login = React.lazy(() => import("./pages/Login"));
const Resources = React.lazy(() => import("./pages/Resources"));
const Attendance = React.lazy(() => import("./pages/Attendance"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Districts = React.lazy(() => import("./pages/Districts"));
const Followup = React.lazy(() => import("./pages/Followup"));
import Settings, { Users as UserPage } from "./pages/Settings";
import "./styles.css";
import { useData } from "./hooks/data";
function PublicLayout() {
  const { user, logout } = useAuth();
  const settings = useData("/public/settings");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <header className="navbar">
        <Link className="brand" to="/">
          <Church />{" "}
          <span>
            {settings.data?.church_name || "THE CHURCH OF PENTECOST CANADA – PEEL HALTON AREA"}
            <small>PEEL HALTON AREA</small>
          </span>
        </Link>
        <button
          className="mobile-toggle secondary"
          aria-label="Toggle navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""}>
          {[
            ["Home", "/"],
            ["About Us", "/#about"],
            ["Districts", "/districts"],
            ["Ministries", "/#ministries"],
            ["Events", "/#events"],
            ["Attendance", "/attendance"],
            ["Members", "/members"],
            ["Dashboard", "/dashboard"],
            ["Contact Us", "/#contact"],
          ].map(([t, p]) =>
            p.includes("#") ? (
              <a key={t} href={p} onClick={() => setOpen(false)}>
                {t}
              </a>
            ) : (
              <Link key={t} to={p} onClick={() => setOpen(false)}>
                {t}
              </Link>
            ),
          )}
          {user ? (
            <>
              <Link to={user.role === "MEMBER" ? "/profile" : "/dashboard"}>
                {user.role === "MEMBER" ? "My Profile" : "Admin Dashboard"}
              </Link>
              <button className="secondary" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <Link className="button" to="/login">
              Login
            </Link>
          )}
        </nav>
      </header>
      <Outlet />
      <footer>The Church of Pentecost Canada · Peel Halton Area · Faith. Community. Service.</footer>
    </>
  );
}
function Guard({ roles }: { roles?: string[] }) {
  const { user, loading } = useAuth();
  const l = useLocation();
  if (loading) return <p className="empty">Checking your session…</p>;
  if (!user)
    return <Navigate to="/login" state={{ from: l.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="empty">
        <h1>Access restricted</h1>
        <Link to="/profile">Go to my profile</Link>
      </div>
    );
  return <Outlet />;
}
function AdminLayout() {
  const { user, logout } = useAuth();
  const settings = useData("/public/settings");
  const [open, setOpen] = React.useState(false);
  const nav = [
    ["Dashboard", "dashboard", LayoutDashboard, ["ADMIN", "PASTOR"]],
    ["Districts", "districts", MapPinned, ["ADMIN", "PASTOR", "STAFF"]],
    ["Members", "members", Users, ["ADMIN", "PASTOR", "STAFF"]],
    ["Attendance", "attendance", CalendarCheck, ["ADMIN", "PASTOR", "STAFF"]],
    ["QR Scanner", "scanner", QrCode, ["ADMIN", "PASTOR", "STAFF"]],
    ["Services", "services", CalendarDays, ["ADMIN", "PASTOR", "STAFF"]],
    ["Events", "events", CalendarDays, ["ADMIN", "PASTOR", "STAFF"]],
    ["Ministries", "ministries", Heart, ["ADMIN", "PASTOR", "STAFF"]],
    ["Reports", "reports", FileBarChart, ["ADMIN", "PASTOR"]],
    ["Attendance Follow-Up", "followup", MessageSquare, ["ADMIN", "PASTOR"]],
    ["Users", "users", Users, ["ADMIN"]],
    ["Settings", "settings", SettingsIcon, ["ADMIN"]],
  ] as const;
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link to="/" className="brand">
          <Church />
          <span>
            {settings.data?.church_name || "THE CHURCH OF PENTECOST CANADA – PEEL HALTON AREA"}
            <small>PEEL HALTON AREA · MANAGEMENT</small>
          </span>
        </Link>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav>
          {user?.role === "MEMBER" && (
            <>
              <NavLink to="/profile">My Profile</NavLink>
              <NavLink to="/dashboard">My Attendance</NavLink>
            </>
          )}
          {nav
            .filter((x) => (x[3] as readonly string[]).includes(user!.role))
            .map(([t, p, Icon]) => (
              <NavLink to={"/" + p} key={p} onClick={() => setOpen(false)}>
                <Icon size={19} />
                {t}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Serving together.
            <br />
            <small>One community, one purpose.</small>
          </p>
          <button onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <button
            className="mobile-toggle secondary"
            aria-label="Open menu"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <span>Peel Halton Area · {user?.district_id || "Area administration"}</span>
          <div className="user-chip">
            <div className="avatar">{user?.name?.[0]}</div>
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
function MemberDashboard() {
  const { user } = useAuth();
  return user?.role === "MEMBER" ? (
    <Profile />
  ) : user?.role === "STAFF" ? (
    <Attendance />
  ) : (
    <Dashboard />
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <React.Suspense
        fallback={
          <div className="skeleton" role="status">
            Loading page…
          </div>
        }
      >
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="districts" element={<Districts />} />
            <Route path="districts/:districtId" element={<Districts />} />
            <Route element={<Guard />}>
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>
          <Route element={<Guard />}>
            <Route element={<AdminLayout />}>
              <Route path="dashboard" element={<MemberDashboard />} />
              <Route element={<Guard roles={["ADMIN", "PASTOR", "STAFF"]} />}>
                {["members", "services", "events", "ministries"].map((r) => (
                  <Route
                    path={r}
                    key={r}
                    element={<Resources resource={r} />}
                  />
                ))}
                <Route path="attendance" element={<Attendance />} />
                <Route path="scanner" element={<Attendance scanner />} />
              </Route>
              <Route element={<Guard roles={["ADMIN", "PASTOR"]} />}>
                <Route path="reports" element={<Dashboard reports />} />
                <Route path="followup" element={<Followup />} />
              </Route>
              <Route element={<Guard roles={["ADMIN"]} />}>
                <Route path="users" element={<UserPage />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  </BrowserRouter>,
);
