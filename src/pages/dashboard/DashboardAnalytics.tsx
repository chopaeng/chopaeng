import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthToken } from "../../context/authToken";
import { dashboardApi, type DashboardAnalytics as AnalyticsPayload, type DashboardCommandAnalytics } from "../../lib/dashboardApi";

type Row = Record<string, unknown>;
type IslandFilter = "" | "free" | "sub";

const asNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const rows = (data: AnalyticsPayload | null, key: string): Row[] => {
  const value = data?.[key];
  return Array.isArray(value) ? value.filter((item): item is Row => item != null && typeof item === "object" && !Array.isArray(item)) : [];
};

const obj = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const fmt = (value: unknown) => typeof value === "number" ? value.toLocaleString() : String(value ?? "0");
const pct = (value: number, max: number) => `${max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0}%`;
const nameFor = (row: Row) => String(row.destination ?? row.ign ?? row.user_name ?? row.label ?? row.name ?? "Unknown");
const countFor = (row: Row, key = "visit_count") => asNumber(row[key] ?? row.count);
const queryNameFor = (row: Row) => String(row.normalized_query ?? row.query ?? row.command ?? "Unknown");

const DashboardAnalytics = () => {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [commandData, setCommandData] = useState<DashboardCommandAnalytics | null>(null);
  const [filter, setFilter] = useState<IslandFilter>("");
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [nrDays, setNrDays] = useState<7 | 30>(7);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [expandedQueries, setExpandedQueries] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(() => {
    setError("");
    dashboardApi.analytics(filter)
      .then((res) => {
        setData(res);
        setLastRefreshed(new Date());
      })
      .catch((err) => setError(err.message));
    dashboardApi.commandAnalytics(30, 25).then(setCommandData).catch((err) => console.error("[command analytics]", err));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

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

  const authStats = obj(data?.auth_stats);
  const catStats = obj(data?.cat_stats);
  const newReturning = obj(data?.new_returning);
  const authorized = asNumber(authStats.authorized ?? data?.authorized_visits);
  const unauthorized = asNumber(authStats.unauthorized ?? data?.unauthorized_visits);
  const authTotal = authorized + unauthorized;
  const topIslands = rows(data, "top_islands");
  const topTravelers = rows(data, "top_travelers");
  const visitsByDay = rows(data, trendDays === 30 ? "visits_by_day_30" : "visits_by_day");
  const visitsByHour = rows(data, "visits_by_hour");
  const visitsByDow = rows(data, "visits_by_dow");
  const topWarned = rows(data, "top_warned");
  const topKicked = rows(data, "top_kicked");
  const topBanned = rows(data, "top_banned");
  const topNoted = rows(data, "top_noted");
  const topQueries = commandData?.top_queries || [];
  const failedQueries = commandData?.failed_queries || [];
  const weekDelta = asNumber(data?.visits_week) - asNumber(data?.visits_prev_week);

  const maxes = useMemo(() => ({
    islands: Math.max(...topIslands.map((row) => countFor(row)), 1),
    travelers: Math.max(...topTravelers.map((row) => countFor(row)), 1),
    trend: Math.max(...visitsByDay.map((row) => countFor(row, "count")), 1),
    hour: Math.max(...visitsByHour.map((row) => countFor(row, "count")), 1),
    dow: Math.max(...visitsByDow.map((row) => countFor(row, "count")), 1),
  }), [topIslands, topTravelers, visitsByDay, visitsByHour, visitsByDow]);

  const exportCsv = async () => {
    setExporting(true);
    setExportSuccess(false);
    setError("");
    try {
      const token = getAuthToken();
      const resp = await fetch(dashboardApi.analyticsExportUrl(filter), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error(`Export failed (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chobot_visits${filter ? `_${filter}` : ""}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (error && !data) return <div className="alert alert-danger fw-bold">{error}</div>;
  if (!data) return <div className="text-center py-5"><div className="spinner-border text-success" /></div>;

  const cards = [
    ["Visits Today", data.visits_today, "fa-calendar-day", "text-nook-green", asNumber(data.warnings_today) ? `${fmt(data.warnings_today)} warning(s) today` : ""],
    ["Visits This Week", data.visits_week, "fa-calendar-week", "dashboard-blue", asNumber(data.visits_prev_week) ? `${weekDelta >= 0 ? "+" : ""}${fmt(weekDelta)} vs prev week` : ""],
    ["Warnings 7d", data.warnings_week, "fa-triangle-exclamation", "dashboard-yellow", `${fmt(data.warn_rate_week)}% warn rate`],
    ["Total Visits", authTotal, "fa-plane", "dashboard-purple", `avg ${fmt(data.avg_visits_30d)}/day (30d)`],
    ["Unique Travelers", data.total_unique_travelers, "fa-users", "text-nook-green", "all-time distinct visitors"],
    ["Unique Islands", data.total_unique_islands, "fa-map", "dashboard-blue", "all-time destinations"],
    ["Peak Hour", data.peak_hour == null ? "n/a" : `${String(data.peak_hour).padStart(2, "0")}:00`, "fa-clock", "dashboard-yellow", "UTC+8 timezone"],
    ["Auth Rate", data.auth_rate_pct == null ? "n/a" : `${String(data.auth_rate_pct)}%`, "fa-user-shield", "text-nook-green", "authorized visits"],
  ];

  const renderBarRows = (items: Row[], colorClass: string, countKey = "visit_count") => {
    const max = Math.max(...items.map((row) => countFor(row, countKey)), 1);
    return items.length ? items.slice(0, 10).map((row, index) => {
      const count = countFor(row, countKey);
      const name = nameFor(row);
      return (
        <div className={`dashboard-bar-row ${colorClass}`} key={`${name}-${index}`} title={`${name}: ${count.toLocaleString()}`}>
          <div className="dashboard-row-title"><span>#{index + 1}</span>{name}</div>
          <div className="dashboard-row-bar"><span style={{ width: pct(count, max) }} /></div>
          <strong>{fmt(count)}</strong>
        </div>
      );
    }) : <div className="dashboard-empty">No data yet.</div>;
  };

  const renderQueryRows = (items: Row[], colorClass: string) => {
    const max = Math.max(...items.map((row) => countFor(row, "count")), 1);
    const limit = expandedQueries ? 20 : 8;
    return items.length ? items.slice(0, limit).map((row, index) => {
      const count = countFor(row, "count");
      const q = queryNameFor(row);
      return (
        <div className={`dashboard-bar-row ${colorClass}`} key={`${q}-${index}`} title={`Query: "${q}" (${count.toLocaleString()} times)`}>
          <div className="dashboard-row-title text-truncate" style={{ maxWidth: 220 }}>
            <span>{String(row.command || "find")}</span>
            <span className="text-truncate" title={q}>{q}</span>
          </div>
          <div className="dashboard-row-bar"><span style={{ width: pct(count, max) }} /></div>
          <strong>{fmt(count)}</strong>
        </div>
      );
    }) : <div className="dashboard-empty">No command data yet.</div>;
  };

  return (
    <div className="container-fluid px-0">
      <div className="dashboard-filter-strip mb-4">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-bold x-small text-muted">Filter by island type:</span>
          {[
            ["", "All Islands", "fa-umbrella-beach"],
            ["free", "Free Islands", "fa-tree"],
            ["sub", "Sub Islands", "fa-star"],
          ].map(([value, label, icon]) => (
            <button key={value || "all"} className={`btn rounded-pill fw-bold px-3 py-2 ${filter === value ? "btn-nook-primary" : "btn-sub"}`} onClick={() => setFilter(value as IslandFilter)}>
              <i className={`fa-solid ${icon} me-1`} />{label}
            </button>
          ))}
          {lastRefreshed && (
            <span className="x-small text-muted ms-2 d-none d-md-inline">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            className={`btn rounded-pill fw-bold px-4 py-2 ${exportSuccess ? "btn-success text-white" : "dashboard-export-btn"}`}
            disabled={exporting}
            onClick={exportCsv}
            title="Download full analytics as CSV"
          >
            {exporting ? (
              <><span className="spinner-border spinner-border-sm me-1" />Exporting...</>
            ) : exportSuccess ? (
              <><i className="fa-solid fa-check me-1" />Exported!</>
            ) : (
              <><i className="fa-solid fa-download me-1" />Export CSV</>
            )}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger dashboard-alert">{error}</div>}

      <div className="row g-3 mb-4">
        {cards.map(([label, value, icon, color, sub]) => (
          <div className="col-6 col-lg-3" key={String(label)}>
            <div className="stat-card h-100">
              <div className="stat-label"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
              <div className={`stat-value ${color}`}>{fmt(value)}</div>
              {Boolean(sub) && <div className="x-small fw-bold mt-1 text-muted">{String(sub)}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-5">
          <section className="section-card h-100">
            <div className="section-card-header"><span><i className="fa-solid fa-chart-pie me-2 text-success" />Traveler Authorization</span></div>
            <div className="p-4">
              <div
                className="dashboard-donut"
                style={{
                  background: `conic-gradient(var(--nook-green) 0 ${authTotal ? (authorized / authTotal) * 100 : 0}%, #e06c75 0 100%)`,
                  transition: "background 0.5s ease",
                }}
              >
                <div className="text-center position-relative" style={{ zIndex: 1, lineHeight: 1.1 }}>
                  <span className="d-block">{data.auth_rate_pct == null ? "n/a" : `${String(data.auth_rate_pct)}%`}</span>
                  <small className="text-muted fw-bold" style={{ fontSize: "0.68rem" }}>Auth Rate</small>
                </div>
              </div>
              <div className="dashboard-legend mt-4">
                <div title={`${fmt(authorized)} authorized visits`}>
                  <span className="status-dot bg-success" />Authorized<strong>{fmt(authorized)}</strong>
                </div>
                <div title={`${fmt(unauthorized)} unauthorized / unknown visits`}>
                  <span className="status-dot dashboard-dot-red" />Unknown<strong>{fmt(unauthorized)}</strong>
                </div>
                <div title={`${fmt(authTotal)} total visits evaluated`}>
                  <span className="status-dot dashboard-dot-muted" />Total<strong>{fmt(authTotal)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="col-12 col-lg-7">
          <section className="section-card h-100">
            <div className="section-card-header">
              <span><i className="fa-solid fa-chart-line me-2 dashboard-blue" />Visit Trend</span>
              <div className="d-flex gap-1">
                <button className={`btn btn-sm rounded-pill fw-bold dashboard-chip-btn ${trendDays === 7 ? "active" : ""}`} onClick={() => setTrendDays(7)}>7 Days</button>
                <button className={`btn btn-sm rounded-pill fw-bold dashboard-chip-btn ${trendDays === 30 ? "active" : ""}`} onClick={() => setTrendDays(30)}>30 Days</button>
              </div>
            </div>
            <div className="dashboard-spark-bars">
              {visitsByDay.map((row) => {
                const count = countFor(row, "count");
                const dayStr = String(row.day || "");
                return (
                  <div
                    className="dashboard-spark-item"
                    key={dayStr}
                    title={`${dayStr}: ${count.toLocaleString()} visits`}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="x-small fw-bold text-muted mb-1" style={{ fontSize: "0.68rem" }}>{fmt(count)}</div>
                    <div className="dashboard-spark-track">
                      <span style={{ height: pct(count, maxes.trend), transition: "height 0.3s ease" }} />
                    </div>
                    <small className="fw-bold">{dayStr.length > 5 ? dayStr.slice(5) : dayStr}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-6"><section className="section-card h-100"><div className="section-card-header"><span><i className="fa-solid fa-umbrella-beach me-2 text-success" />Most Visited Islands</span></div><div className="p-3">{renderBarRows(topIslands, "")}</div></section></div>
        <div className="col-12 col-lg-6"><section className="section-card h-100"><div className="section-card-header"><span><i className="fa-solid fa-plane me-2 dashboard-purple" />Most Active Travelers</span></div><div className="p-3">{renderBarRows(topTravelers, "dashboard-purple-bars")}</div></section></div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-4">
          <section className="section-card h-100">
            <div className="section-card-header"><span><i className="fa-solid fa-chart-pie me-2 dashboard-blue" />Visits by Tier</span></div>
            <div className="p-4">
              <div className="dashboard-legend">
                <div><span className="status-dot dashboard-dot-blue" />Public<strong>{fmt(asNumber(catStats.public))}</strong></div>
                <div><span className="status-dot dashboard-dot-yellow" />Member / VIP<strong>{fmt(asNumber(catStats.member))}</strong></div>
                <div><span className="status-dot dashboard-dot-muted" />Total matched<strong>{fmt(asNumber(catStats.public) + asNumber(catStats.member))}</strong></div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="section-card mb-4">
        <div className="section-card-header">
          <span><i className="fa-solid fa-clock me-2 dashboard-yellow" />Visits by Hour of Day (UTC+8)</span>
          {data.peak_hour != null && <span className="dashboard-peak-badge">Peak: {String(data.peak_hour).padStart(2, "0")}:00</span>}
        </div>
        <div className="dashboard-hour-grid p-3">
          {visitsByHour.map((row) => {
            const hourNum = asNumber(row.hour);
            const count = countFor(row, "count");
            const isPeak = data.peak_hour === hourNum;
            const hourLabel = `${String(hourNum).padStart(2, "0")}:00`;
            return (
              <div
                key={String(row.hour)}
                title={`${hourLabel} (UTC+8): ${count.toLocaleString()} visits${isPeak ? " ★ PEAK" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <span
                  style={{
                    height: pct(count, maxes.hour),
                    background: isPeak ? "var(--dal-blue)" : undefined,
                    transition: "height 0.3s ease",
                  }}
                />
                <small style={{ color: isPeak ? "var(--dal-blue)" : undefined, fontWeight: isPeak ? 900 : 700 }}>
                  {String(row.hour).padStart(2, "0")}
                </small>
              </div>
            );
          })}
        </div>
      </section>

      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-7">
          <section className="section-card h-100">
            <div className="section-card-header"><span><i className="fa-solid fa-calendar-days me-2 dashboard-purple" />Visits by Day of Week</span></div>
            <div className="p-3">
              {visitsByDow.map((row) => {
                const count = countFor(row, "count");
                return (
                  <div
                    className="dashboard-bar-row dashboard-purple-bars"
                    key={String(row.label)}
                    title={`${String(row.label)}: ${count.toLocaleString()} visits`}
                  >
                    <div className="dashboard-row-title">{String(row.label)}</div>
                    <div className="dashboard-row-bar"><span style={{ width: pct(count, maxes.dow) }} /></div>
                    <strong>{fmt(count)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="col-12 col-lg-5">
          <section className="section-card h-100">
            <div className="section-card-header">
              <span><i className="fa-solid fa-users me-2 text-success" />New vs Returning</span>
              <div className="d-flex gap-1">
                <button className={`btn btn-sm rounded-pill fw-bold dashboard-chip-btn ${nrDays === 7 ? "active" : ""}`} onClick={() => setNrDays(7)}>7d</button>
                <button className={`btn btn-sm rounded-pill fw-bold dashboard-chip-btn ${nrDays === 30 ? "active" : ""}`} onClick={() => setNrDays(30)}>30d</button>
              </div>
            </div>
            <div className="p-4 dashboard-nr-grid">
              <div><i className="fa-solid fa-user-plus text-success" /><strong>{fmt(newReturning[`new_${nrDays}d`])}</strong><span>First-time visitors</span></div>
              <div><i className="fa-solid fa-repeat dashboard-purple" /><strong>{fmt(newReturning[`returning_${nrDays}d`])}</strong><span>Returning visitors</span></div>
              <div><i className="fa-solid fa-users dashboard-blue" /><strong>{fmt(newReturning[`total_${nrDays}d`])}</strong><span>Unique travelers</span></div>
            </div>
          </section>
        </div>
      </div>

      <section className="section-card">
        <div className="section-card-header"><span><i className="fa-solid fa-triangle-exclamation me-2 dashboard-yellow" />Moderation Leaderboards</span></div>
        <div className="row g-0">
          <div className="col-md-3 p-3">{renderBarRows(topWarned, "", "warn_count")}</div>
          <div className="col-md-3 p-3">{renderBarRows(topKicked, "dashboard-yellow-bars", "kick_count")}</div>
          <div className="col-md-3 p-3">{renderBarRows(topBanned, "dashboard-red-bars", "ban_count")}</div>
          <div className="col-md-3 p-3">{renderBarRows(topNoted, "dashboard-blue-bars", "note_count")}</div>
        </div>
      </section>

      <section className="section-card mt-4">
        <div className="section-card-header">
          <span><i className="fa-solid fa-magnifying-glass-chart me-2 dashboard-blue" />Command Search Analytics</span>
          <div className="d-flex align-items-center gap-2">
            {commandData && (
              <span className="dashboard-peak-badge">
                {fmt(commandData.summary.total_searches)} searches · {commandData.summary.success_rate_pct == null ? "n/a" : `${commandData.summary.success_rate_pct}%`} success
              </span>
            )}
            {(topQueries.length > 8 || failedQueries.length > 8) && (
              <button
                className="btn btn-sm btn-sub rounded-pill fw-bold"
                onClick={() => setExpandedQueries(!expandedQueries)}
              >
                {expandedQueries ? "Show Less" : "Show More"}
              </button>
            )}
          </div>
        </div>
        <div className="row g-0">
          <div className="col-12 col-lg-6 p-3">
            <div className="db-label mb-2">Top Searches</div>
            {renderQueryRows(topQueries, "dashboard-blue-bars")}
          </div>
          <div className="col-12 col-lg-6 p-3">
            <div className="db-label mb-2">Failed Searches</div>
            {renderQueryRows(failedQueries, "dashboard-yellow-bars")}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardAnalytics;
