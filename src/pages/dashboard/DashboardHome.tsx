import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import { dashboardApi, type DashboardOverview } from "../../lib/dashboardApi";

const fmt = (value: number | string | null | undefined) => {
  if (typeof value === "number") return value.toLocaleString();
  return String(value ?? 0);
};

const pct = (value: number, max: number) => `${max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0}%`;
const authLabel = (value: unknown) => (value === true ? "authorized" : value === false ? "unknown" : String(value || "unknown"));
const authBadge = (value: unknown) => (value === true || value === "authorized" ? "badge-auth" : "badge-unkn");

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

const fmtDate = (value: unknown) => {
  if (!value) return "-";
  const d = new Date(String(value));
  if (!isNaN(d.getTime())) return d.toLocaleString();
  return String(value);
};

const DashboardHome = () => {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState("");
  const [recentPage, setRecentPage] = useState(1);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const recentPerPage = 10;

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      const overview = await dashboardApi.overview();
      setData(overview);
      setLastRefreshed(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 60-second polling with visibility detection
  useEffect(() => {
    let timer = window.setInterval(load, 60000);
    const handleVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        load();
        timer = window.setInterval(load, 60000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  const maxTrend = useMemo(() => Math.max(...(data?.trend_counts || [0]), 1), [data]);
  const recentTotalPages = Math.max(1, Math.ceil((data?.recent.length || 0) / recentPerPage));
  const safeRecentPage = Math.min(recentPage, recentTotalPages);
  const pagedRecent = useMemo(
    () => (data?.recent || []).slice((safeRecentPage - 1) * recentPerPage, safeRecentPage * recentPerPage),
    [data?.recent, safeRecentPage],
  );

  if (error && !data) return <div className="alert alert-danger fw-bold">{error}</div>;
  if (!data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" />
      </div>
    );
  }

  const statusOnline = data.status_map.ONLINE || 0;
  const statusRefreshing = data.status_map.REFRESHING || 0;
  const statusOffline = data.status_map.OFFLINE || 0;
  const maxIsland = Math.max(...data.top_islands.map((row) => row.count), 1);
  const maxTraveler = Math.max(...data.top_travelers.map((row) => row.count), 1);

  // Delta calculation for visits today vs daily average over 7 days
  const dailyAvg = Math.max(1, Math.round((data.visits_week || 0) / 7));
  const todayDeltaPct = Math.round(((data.visits_today - dailyAvg) / dailyAvg) * 100);

  const cards = [
    {
      label: "Total Visits",
      value: data.total_visits,
      icon: "fa-plane",
      color: "text-nook-green",
      sub: "all-time total",
    },
    {
      label: "Visits Today",
      value: data.visits_today,
      icon: "fa-calendar-day",
      color: "dashboard-blue",
      sub: (
        <span className={todayDeltaPct >= 0 ? "text-success" : "text-muted"}>
          {todayDeltaPct >= 0 ? `▲ +${todayDeltaPct}%` : `▼ ${todayDeltaPct}%`} vs 7d avg ({dailyAvg}/d)
        </span>
      ),
    },
    {
      label: "This Week",
      value: data.visits_week,
      icon: "fa-calendar-week",
      color: "dashboard-purple",
      sub: `${data.warnings_week} warnings logged`,
    },
    {
      label: "Warnings",
      value: data.total_warnings,
      icon: "fa-triangle-exclamation",
      color: "dashboard-yellow",
      sub: "total flagged events",
    },
    {
      label: "Total Islands",
      value: data.island_count,
      icon: "fa-location-dot",
      color: "text-nook-green",
      sub: `${fmt(statusOnline)} currently active`,
    },
    {
      label: "Bots Online",
      value: data.online_count,
      icon: "fa-wifi",
      color: "text-nook-green",
      hasPulse: true,
      sub: `of ${fmt(data.island_count)} total (${data.online_pct}%)`,
    },
    {
      label: "Warn Rate",
      value: `${data.warn_rate_7d}%`,
      icon: "fa-shield-halved",
      color: data.warn_rate_7d >= 10 ? "dashboard-red" : "text-nook-green",
      isAlert: data.warn_rate_7d >= 10,
      sub: `${fmt(data.warnings_week)} warnings this week`,
    },
    {
      label: "Analytics",
      value: "View",
      icon: "fa-chart-line",
      color: "dashboard-purple",
      isLink: true,
      sub: "deep dive metrics",
    },
  ];

  return (
    <div className="container-fluid px-0">
      {/* Header bar with auto-refresh status & manual trigger */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="x-small text-muted fw-bold">
          <i className="fa-solid fa-clock-rotate-left me-1" />
          {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Loading..."}
          <span className="ms-2 opacity-75">(auto-refreshes every 60s)</span>
        </div>
        <button
          className="btn btn-sm btn-sub rounded-pill fw-bold"
          disabled={refreshing}
          onClick={() => load()}
          title="Refresh overview data"
        >
          <i className={`fa-solid fa-arrows-rotate me-1 ${refreshing ? "fa-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="row g-3 mb-4">
        {cards.map((card) => {
          const content = (
            <div
              className="stat-card h-100"
              style={
                card.isAlert
                  ? { background: "rgba(239, 68, 68, 0.07)", borderColor: "#fca5a5" }
                  : undefined
              }
            >
              <div className="stat-label d-flex align-items-center justify-content-between">
                <span>
                  <i className={`fa-solid ${card.icon} me-1`} />
                  {card.label}
                </span>
                {card.hasPulse && (
                  <span
                    className="status-dot bg-success pulse-ring"
                    style={{ width: 8, height: 8 }}
                    title="Live online status"
                  />
                )}
              </div>
              <div className={`stat-value ${card.color}`}>{fmt(card.value)}</div>
              {card.sub && <div className="x-small fw-bold mt-1 text-muted">{card.sub}</div>}
            </div>
          );

          return (
            <div className="col-6 col-lg-3" key={card.label}>
              {card.isLink ? (
                <Link to="/dashboard/analytics" className="text-decoration-none d-block h-100">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      <section className="section-card mb-4">
        <div className="section-card-header">
          <span>
            <i className="fa-solid fa-location-dot me-2 text-success" />
            Island Status Breakdown
          </span>
          <Link to="/dashboard/islands" className="text-decoration-none fw-bold x-small text-success">
            View all
          </Link>
        </div>
        <div className="p-4">
          <div className="row g-3 mb-4">
            <div className="col-4">
              <div className="dashboard-mini-metric dashboard-mini-green">
                <div>{fmt(statusOnline)}</div>
                <span>Online</span>
              </div>
            </div>
            <div className="col-4">
              <div className="dashboard-mini-metric dashboard-mini-blue">
                <div>{fmt(statusRefreshing)}</div>
                <span>Refreshing</span>
              </div>
            </div>
            <div className="col-4">
              <div className="dashboard-mini-metric dashboard-mini-muted">
                <div>{fmt(statusOffline)}</div>
                <span>Offline</span>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="x-small fw-bold text-muted">
              {fmt(data.online_count)} of {fmt(data.island_count)} islands currently online
            </span>
            <span className="x-small fw-bold text-muted">{fmt(data.online_pct)}%</span>
          </div>
          <div className="dashboard-progress">
            <div style={{ width: `${data.online_pct}%` }} />
          </div>
        </div>
      </section>

      <section className="section-card mb-4">
        <div className="section-card-header">
          <span>
            <i className="fa-solid fa-chart-simple me-2 dashboard-blue" />
            Visit Trend (Last 7 Days)
          </span>
          <Link to="/dashboard/analytics" className="text-decoration-none fw-bold x-small text-success">
            Full analytics
          </Link>
        </div>
        <div className="dashboard-spark-bars">
          {data.trend_counts.map((count, index) => {
            const label = data.trend_labels[index] || `Day ${index + 1}`;
            return (
              <div
                className="dashboard-spark-item"
                key={`${label}-${index}`}
                title={`${label}: ${count.toLocaleString()} visits`}
                style={{ cursor: "pointer" }}
              >
                <div className="x-small fw-bold text-muted mb-1">{fmt(count)}</div>
                <div className="dashboard-spark-track">
                  <span
                    style={{
                      height: pct(count, maxTrend),
                      transition: "height 0.3s ease",
                    }}
                  />
                </div>
                <small className="fw-bold">{label.length > 5 ? label.slice(5) : label}</small>
              </div>
            );
          })}
        </div>
      </section>

      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-6">
          <section className="section-card h-100">
            <div className="section-card-header">
              <span>
                <i className="fa-solid fa-trophy me-2 dashboard-yellow" />
                Top Islands
              </span>
              <Link to="/dashboard/analytics" className="text-decoration-none fw-bold x-small text-success">
                View all
              </Link>
            </div>
            <div className="p-3">
              {data.top_islands.length === 0 && <div className="dashboard-empty">No visit data yet.</div>}
              {data.top_islands.slice(0, 5).map((row, index) => (
                <div className="dashboard-bar-row" key={row.name} title={`${row.name}: ${row.count} visits`}>
                  <div className="dashboard-row-title">
                    <span>#{index + 1}</span>
                    {row.name}
                  </div>
                  <div className="dashboard-row-bar">
                    <span style={{ width: pct(row.count, maxIsland) }} />
                  </div>
                  <strong>{fmt(row.count)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-6">
          <section className="section-card h-100">
            <div className="section-card-header">
              <span>
                <i className="fa-solid fa-user-check me-2 dashboard-blue" />
                Top Travelers
              </span>
              <Link to="/dashboard/analytics" className="text-decoration-none fw-bold x-small text-success">
                View all
              </Link>
            </div>
            <div className="p-3">
              {data.top_travelers.length === 0 && <div className="dashboard-empty">No traveler data yet.</div>}
              {data.top_travelers.slice(0, 5).map((row, index) => (
                <div className="dashboard-bar-row dashboard-blue-bars" key={row.ign} title={`${row.ign}: ${row.count} visits`}>
                  <div className="dashboard-row-title">
                    <span>#{index + 1}</span>
                    {row.ign}
                  </div>
                  <div className="dashboard-row-bar">
                    <span style={{ width: pct(row.count, maxTraveler) }} />
                  </div>
                  <strong>{fmt(row.count)}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="section-card">
        <div className="section-card-header">
          <span>
            <i className="fa-solid fa-clock-rotate-left me-2 text-success" />
            Recent Flight Activity
          </span>
          <Link to="/dashboard/logs" className="text-decoration-none fw-bold x-small text-success">
            View all
          </Link>
        </div>
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th>IGN</th>
                <th>Destination</th>
                <th>When</th>
                <th>Auth</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecent.map((row, idx) => {
                const rawTime = String(row.timestamp || "");
                return (
                  <tr key={idx}>
                    <td className="fw-bold">{String(row.ign || "Unknown")}</td>
                    <td>{String(row.destination || "Unknown")}</td>
                    <td className="text-muted small">
                      <span title={fmtDate(rawTime)} style={{ cursor: "help" }}>
                        {timeAgo(rawTime)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${authBadge(row.auth_status ?? row.authorized)}`}>
                        {authLabel(row.auth_status ?? row.authorized)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DashboardPagination
          page={safeRecentPage}
          perPage={recentPerPage}
          totalItems={data.recent.length}
          onPageChange={setRecentPage}
        />
      </section>
    </div>
  );
};

export default DashboardHome;
