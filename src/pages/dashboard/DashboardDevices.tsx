import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import { dashboardApi, type WebsiteLoginEvent } from "../../lib/dashboardApi";

const timeAgo = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
};

const fmtDate = (v: unknown) => {
  if (!v) return "-";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};

const displayName = (e: WebsiteLoginEvent) =>
  e.nickname || e.username || e.discord_name || e.global_name || e.account_name || "Unknown";

interface IpGroup {
  ip: string;
  accounts: WebsiteLoginEvent[];
  lastSeen: string;
  isShared: boolean;
}

const DashboardDevices = () => {
  const [logins, setLogins] = useState<WebsiteLoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [filterIp, setFilterIp] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [showSharedOnly, setShowSharedOnly] = useState(false);
  const [expandedIp, setExpandedIp] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch multiple pages to get enough data for grouping
      const [p1, p2] = await Promise.all([
        dashboardApi.websiteLogins(new URLSearchParams({ page: "1", per_page: "200" }).toString()),
        dashboardApi.websiteLogins(new URLSearchParams({ page: "2", per_page: "200" }).toString()),
      ]);
      const all = [...(p1.entries || []), ...(p2.entries || [])];
      setLogins(all);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load login data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let timer = window.setInterval(load, 120000);
    const handleVisibility = () => {
      if (document.hidden) window.clearInterval(timer);
      else { load(); timer = window.setInterval(load, 120000); }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [load]);

  // Group logins by IP address
  const ipGroups = useMemo((): IpGroup[] => {
    const map = new Map<string, WebsiteLoginEvent[]>();
    for (const login of logins) {
      const ip = login.ip_address || "Unknown";
      if (!map.has(ip)) map.set(ip, []);
      // Deduplicate by user_id per IP
      const existing = map.get(ip)!;
      if (!existing.some((e) => e.user_id === login.user_id)) {
        existing.push(login);
      }
    }
    const groups: IpGroup[] = [];
    for (const [ip, accounts] of map.entries()) {
      const lastSeen = accounts
        .map((a) => a.created_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || "";
      groups.push({ ip, accounts, lastSeen, isShared: accounts.length > 1 });
    }
    return groups.sort((a, b) => b.accounts.length - a.accounts.length);
  }, [logins]);

  const filtered = useMemo(() => {
    let g = ipGroups;
    if (showSharedOnly) g = g.filter((gr) => gr.isShared);
    if (filterIp.trim()) g = g.filter((gr) => gr.ip.includes(filterIp.trim()));
    if (filterUser.trim()) {
      const q = filterUser.trim().toLowerCase();
      g = g.filter((gr) =>
        gr.accounts.some(
          (a) =>
            displayName(a).toLowerCase().includes(q) ||
            a.user_id.includes(q),
        ),
      );
    }
    return g;
  }, [ipGroups, showSharedOnly, filterIp, filterUser]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const sharedCount = ipGroups.filter((g) => g.isShared).length;
  const altFlaggedCount = ipGroups.filter((g) => g.isShared && g.accounts.length >= 3).length;

  if (loading && logins.length === 0) {
    return <div className="text-center py-5"><div className="spinner-border text-success" /></div>;
  }

  return (
    <div className="container-fluid px-0">
      {error && <div className="alert alert-danger dashboard-alert mb-3">{error}</div>}

      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="x-small text-muted fw-bold">
          <i className="fa-solid fa-clock-rotate-left me-1" />
          {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Loading…"}
          <span className="ms-2 opacity-75">(auto-refreshes every 2 min)</span>
        </div>
        <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={load} disabled={loading}>
          <i className={`fa-solid fa-arrows-rotate me-1 ${loading ? "fa-spin" : ""}`} />Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="row g-3 mb-4">
        {[
          ["Unique IPs", ipGroups.length, "fa-network-wired", "text-nook-green"],
          ["Shared IPs", sharedCount, "fa-user-group", "dashboard-yellow"],
          ["Alt Flags (3+)", altFlaggedCount, "fa-flag", "text-danger"],
          ["Login Records", logins.length, "fa-arrow-right-to-bracket", "dashboard-blue"],
        ].map(([label, value, icon, color]) => (
          <div className="col-6 col-md-3" key={String(label)}>
            <div className="stat-card">
              <div className="stat-label"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
              <div className={`stat-value ${color}`}>{String(value)}</div>
              {String(label) === "Shared IPs" && sharedCount > 0 && (
                <div className="x-small text-muted fw-bold mt-1">potential alt accounts</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {altFlaggedCount > 0 && (
        <div className="alert dashboard-alert mb-4" style={{ background: "rgba(239,68,68,0.09)", borderColor: "#fca5a5" }}>
          <i className="fa-solid fa-flag me-2 text-danger" />
          <strong>{altFlaggedCount} IP{altFlaggedCount > 1 ? "s" : ""}</strong> have 3 or more distinct accounts.
          These may indicate alt account rings — review carefully.
        </div>
      )}

      {/* Filters */}
      <section className="section-card mb-4">
        <div className="p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="db-label">Filter by IP</label>
              <input className="db-input" placeholder="192.168.x.x" value={filterIp} onChange={(e) => { setFilterIp(e.target.value); setPage(1); }} />
            </div>
            <div className="col-md-4">
              <label className="db-label">Filter by User / ID</label>
              <input className="db-input" placeholder="Username or Discord ID" value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(1); }} />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="shared-only"
                  checked={showSharedOnly}
                  onChange={(e) => { setShowSharedOnly(e.target.checked); setPage(1); }}
                  style={{ accentColor: "var(--nook-green)" }}
                />
                <label className="form-check-label db-label mb-0" htmlFor="shared-only">Shared IPs only</label>
              </div>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button className="btn btn-sm btn-sub w-100 fw-bold rounded-pill" onClick={() => { setFilterIp(""); setFilterUser(""); setShowSharedOnly(false); setPage(1); }}>
                <i className="fa-solid fa-rotate-left me-1" />Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* IP Groups Table */}
      <section className="section-card">
        <div className="section-card-header">
          <span><i className="fa-solid fa-fingerprint me-2 dashboard-purple" />IP Fingerprint Groups</span>
          <span className="badge rounded-pill bg-light text-muted border">{filtered.length} groups</span>
        </div>
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th style={{ width: "2rem" }} />
                <th>IP Address</th>
                <th>Accounts</th>
                <th>Risk</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4 text-muted fw-bold">No IP groups match the filters.</td></tr>
              ) : paged.map((group) => {
                const isExpanded = expandedIp === group.ip;
                const risk = group.accounts.length >= 3 ? "high" : group.accounts.length >= 2 ? "medium" : "low";
                return (
                  <>
                    <tr
                      key={`row-${group.ip}`}
                      style={{
                        cursor: "pointer",
                        background: isExpanded ? "rgba(34,197,94,0.06)" : group.isShared ? "rgba(245,158,11,0.04)" : undefined,
                      }}
                      onClick={() => setExpandedIp(isExpanded ? null : group.ip)}
                    >
                      <td>
                        <i className={`fa-solid fa-chevron-${isExpanded ? "down" : "right"} text-muted small`} />
                      </td>
                      <td className="font-monospace fw-bold">{group.ip}</td>
                      <td>
                        <span className={`badge rounded-pill fw-bold ${group.accounts.length >= 3 ? "bg-danger" : group.accounts.length >= 2 ? "bg-warning text-dark" : "badge-auth"}`}>
                          {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${risk === "high" ? "bg-danger" : risk === "medium" ? "bg-warning text-dark" : "badge-auth"}`}>
                          {risk === "high" ? <><i className="fa-solid fa-flag me-1" />HIGH</> : risk === "medium" ? "SHARED" : "CLEAN"}
                        </span>
                      </td>
                      <td className="small text-muted">
                        <span title={fmtDate(group.lastSeen)} style={{ cursor: "help" }}>{timeAgo(group.lastSeen)}</span>
                      </td>
                    </tr>
                    {isExpanded && group.accounts.map((account) => {
                      const avatarSrc = account.avatar?.startsWith("http")
                        ? account.avatar
                        : account.avatar
                        ? `https://cdn.discordapp.com/avatars/${account.user_id}/${account.avatar}.png?size=32`
                        : null;
                      return (
                        <tr key={`acc-${group.ip}-${account.user_id}`} style={{ background: "rgba(0,0,0,0.03)" }}>
                          <td />
                          <td colSpan={4}>
                            <div className="d-flex align-items-center gap-3 py-1 ps-3">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt=""
                                  className="rounded-circle"
                                  style={{ width: 28, height: 28, objectFit: "cover" }}
                                  onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                                />
                              ) : (
                                <span className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center" style={{ width: 28, height: 28, fontSize: "0.7rem" }}>
                                  {displayName(account)[0]?.toUpperCase()}
                                </span>
                              )}
                              <div>
                                <Link to={`/dashboard/player?user_id=${encodeURIComponent(account.user_id)}`} className="fw-bold text-decoration-none">
                                  {displayName(account)}
                                </Link>
                                <span className="font-monospace x-small text-muted ms-2">{account.user_id}</span>
                                {account.is_admin && <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle ms-2">Admin</span>}
                                {account.is_mod && <span className="badge rounded-pill dashboard-member-badge ms-1">Mod</span>}
                              </div>
                              <div className="ms-auto x-small text-muted">
                                Last login: <span title={fmtDate(account.created_at)} style={{ cursor: "help" }}>{timeAgo(account.created_at)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <DashboardPagination page={safePage} perPage={perPage} totalItems={filtered.length} onPageChange={setPage} />
      </section>
    </div>
  );
};

export default DashboardDevices;
