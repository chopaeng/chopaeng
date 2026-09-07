import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import CommandPalette from "../components/dashboard/CommandPalette";
import { API_BASE } from "../config/api";
import { getAuthToken } from "../context/authToken";
import { useAuth } from "../context/useAuth";
import { dashboardApi } from "../lib/dashboardApi";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  shortcut?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Monitor",
    items: [
      { to: "/dashboard", label: "Overview", icon: "fa-house", end: true, shortcut: "h" },
      { to: "/dashboard/incidents", label: "Incidents", icon: "fa-triangle-exclamation", shortcut: "c" },
      { to: "/dashboard/audit", label: "Audit Log", icon: "fa-scroll", shortcut: "u" },
      { to: "/dashboard/bulk", label: "Bulk Actions", icon: "fa-bolt", shortcut: "x" },
    ],
  },
  {
    title: "Data",
    items: [
      { to: "/dashboard/islands", label: "Islands & Status", icon: "fa-location-dot", shortcut: "i" },
      { to: "/dashboard/bundles", label: "Pocket Bundles", icon: "fa-boxes-stacked", shortcut: "b" },
      { to: "/dashboard/analytics", label: "Analytics", icon: "fa-chart-line", shortcut: "a" },
      { to: "/dashboard/logs", label: "XLog Reports", icon: "fa-clipboard-list", shortcut: "l" },
      { to: "/dashboard/trust", label: "Trust Profile", icon: "fa-id-card", shortcut: "t" },
      { to: "/dashboard/player", label: "Player Lookup", icon: "fa-magnifying-glass", shortcut: "p" },
      { to: "/dashboard/leaderboard", label: "Mod Leaderboard", icon: "fa-ranking-star", shortcut: "m" },
      { to: "/dashboard/devices", label: "IP Fingerprints", icon: "fa-fingerprint", shortcut: "f" },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/dashboard/ops", label: "Ops", icon: "fa-server", shortcut: "o" },
      { to: "/dashboard/auth-log", label: "Website Logins", icon: "fa-user-check", shortcut: "w" },
      { to: "/dashboard/database", label: "Database", icon: "fa-database", shortcut: "d" },
      { to: "/dashboard/scheduled", label: "Scheduled Msgs", icon: "fa-bullhorn", shortcut: "n" },
      { to: "/dashboard/maintenance", label: "Maintenance", icon: "fa-wrench", shortcut: "e" },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

const apiLinks = [
  { href: `${API_BASE}/dashboard/api/islands`, label: "/api/islands" },
  { href: `${API_BASE}/dashboard/api/analytics`, label: "/api/analytics" },
  { href: `${API_BASE}/dashboard/api/logs`, label: "/api/logs" },
  { href: `${API_BASE}/dashboard/api/website-logins`, label: "/api/website-logins" },
];

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sb-collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [incidentCount, setIncidentCount] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("db-theme") === "dark");

  const pageTitle = useMemo(() => {
    const match = [...allNavItems].reverse().find((link) => {
      if (link.end) return location.pathname === link.to;
      return location.pathname.startsWith(link.to);
    });
    return match?.label || "Dashboard";
  }, [location.pathname]);

  const userAvatarUrl = useMemo(() => {
    if (!user || !user.avatar) return null;
    if (user.avatar.startsWith("http")) return user.avatar;
    return `https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`;
  }, [user]);

  useEffect(() => {
    localStorage.setItem("sb-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Apply dashboard-only theme class to shell
  useEffect(() => {
    localStorage.setItem("db-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Ctrl+K / Cmd+K to open palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Fetch incident badge count
  useEffect(() => {
    let mounted = true;
    const fetchIncidents = async () => {
      try {
        const res = await dashboardApi.incidents(1);
        if (!mounted) return;
        const warnings = Number(res?.summary?.active_warnings || 0);
        const queue = Number(res?.summary?.open_queue_entries || 0);
        const open = Number(res?.summary?.open_incidents || 0);
        setIncidentCount(warnings + queue + open);
      } catch {
        // silent fail for badge
      }
    };
    fetchIncidents();
    const iv = setInterval(fetchIncidents, 60000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // Keyboard shortcut listener: 'g' then letter jumps to page
  useEffect(() => {
    let gPressed = false;
    let gTimer: number | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        gPressed = true;
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gPressed = false;
        }, 1200);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) window.clearTimeout(gTimer);
        const key = e.key.toLowerCase();
        if (key === "s") {
          e.preventDefault();
          navigate("/dashboard/islands");
          return;
        }
        const found = allNavItems.find((item) => item.shortcut === key);
        if (found) {
          e.preventDefault();
          navigate(found.to);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [navigate]);

  const toggleSidebar = () => {
    if (window.innerWidth <= 767) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => !value);
  };

  const refreshCache = async () => {
    const token = getAuthToken();
    setRefreshing(true);
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}/api/refresh`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || "Refresh failed"));
      setNotice("API cache refresh started.");
      setTimeout(() => setNotice(""), 4000);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Refresh failed");
      setTimeout(() => setNotice(""), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className={`sidebar-overlay ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(false)} />
      <div className={`d-flex dashboard-shell ${darkMode ? "db-dark" : "db-light"}`}>
        <aside className={`db-sidebar ${collapsed ? "sb-collapsed" : ""} ${mobileOpen ? "sb-open" : ""}`}>
          <div className="sidebar-brand">
            <div className="logo-box flex-shrink-0">
              <img src="https://cdn.chopaeng.com/logo.webp" alt="ChoBot" className="dashboard-logo" />
            </div>
            <div className="brand-text">
              <div className="ac-font fw-bold text-nook-green dashboard-brand-title">ChoBot</div>
              <div className="x-small text-muted fw-bold">Mod Dashboard</div>
            </div>
          </div>

          <nav className="flex-grow-1 p-3 overflow-y-auto">
            {navSections.map((section, idx) => (
              <div key={section.title} className={idx > 0 ? "mt-3" : ""}>
                <div className="sidebar-section-label">{section.title}</div>
                {section.items.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav-pill-link ${isActive ? "active" : ""}`}
                    title={`${link.label} (G then ${link.shortcut?.toUpperCase()})`}
                  >
                    <i className={`fa-solid ${link.icon}`} />
                    <span className="link-text">{link.label}</span>
                    {link.to === "/dashboard/incidents" && incidentCount > 0 && (
                      <span className="badge rounded-pill bg-danger ms-auto link-text" style={{ fontSize: "0.65rem" }}>
                        {incidentCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}

            <div className="sidebar-section-label mt-3">API</div>
            {apiLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav-pill-link small" target="_blank" rel="noreferrer" title={link.label}>
                <i className="fa-solid fa-link" />
                <span className="link-text">{link.label}</span>
              </a>
            ))}
          </nav>

          <div className="p-3 border-top dashboard-sidebar-footer">
            <button type="button" className="nav-pill-link dashboard-logout" onClick={handleLogout} title="Logout">
              <i className="fa-solid fa-right-from-bracket" />
              <span className="link-text">Logout</span>
            </button>
          </div>
        </aside>

        <div className="db-main flex-grow-1">
          <div className="db-topbar">
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="sb-toggle-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
                <i className="fa-solid fa-bars" />
              </button>
              <div className="d-flex flex-column">
                <span className="fw-black ac-font text-nook-green dashboard-page-title mb-0">{pageTitle}</span>
                <span className="x-small text-muted d-none d-sm-inline" style={{ fontSize: "0.72rem", marginTop: "-2px" }}>
                  Dashboard <i className="fa-solid fa-chevron-right mx-1" style={{ fontSize: "0.55rem" }} /> {pageTitle}
                </span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {/* Command Palette trigger */}
              <button
                type="button"
                className="sb-toggle-btn"
                onClick={() => setPaletteOpen(true)}
                title="Command Palette (Ctrl+K)"
                aria-label="Open command palette"
              >
                <i className="fa-solid fa-magnifying-glass" />
              </button>

              <NavLink
                to="/dashboard/incidents"
                className="sb-toggle-btn position-relative"
                title="Incidents & Alerts"
                aria-label="Incidents"
              >
                <i className="fa-solid fa-bell" />
                {incidentCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: "0.62rem", padding: "0.2em 0.45em" }}
                  >
                    {incidentCount > 99 ? "99+" : incidentCount}
                  </span>
                )}
              </NavLink>

              {/* Theme toggle */}
              <button
                type="button"
                className="sb-toggle-btn"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                <i className={`fa-solid ${darkMode ? "fa-sun" : "fa-moon"}`} />
              </button>

              <button
                type="button"
                className="sb-toggle-btn"
                onClick={refreshCache}
                disabled={refreshing}
                title="Refresh API cache"
                aria-label="Refresh API cache"
              >
                <i className={`fa-solid fa-arrows-rotate ${refreshing ? "fa-spin" : ""}`} />
              </button>
              <div className="dashboard-user-chip">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt=""
                    className="dashboard-avatar"
                    onError={(e) => {
                      // Fallback if avatar fails to load
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="dashboard-avatar-fallback">{user?.username?.[0]?.toUpperCase() || "M"}</div>
                )}
                <div className="dashboard-user-meta">
                  <span className="dashboard-username">{user?.username || "Moderator"}</span>
                  <span className="dashboard-role"><i className="fa-solid fa-shield-halved me-1" />{user?.is_admin ? "Admin" : "Mod"}</span>
                </div>
              </div>
            </div>
          </div>

          {notice && (
            <div className="px-4 pt-3">
              <div className={`alert ${notice.toLowerCase().includes("failed") ? "alert-danger" : "alert-success"} dashboard-alert mb-0`}>
                {notice}
              </div>
            </div>
          )}

          <main className="db-body">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default DashboardLayout;
