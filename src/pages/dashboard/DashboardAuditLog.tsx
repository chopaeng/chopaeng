import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import { dashboardApi } from "../../lib/dashboardApi";

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

type LogEntry = Record<string, unknown>;
type AuditEntry = {
  id: string;
  actor: string;
  userId: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
  source: "incident" | "log";
  severity: string;
};

const ACTION_ICONS: Record<string, string> = {
  WARN: "fa-triangle-exclamation",
  BAN: "fa-ban",
  KICK: "fa-person-walking-arrow-right",
  NOTE: "fa-note-sticky",
  ADMIT: "fa-check-circle",
  resolved: "fa-circle-check",
  dismissed: "fa-circle-xmark",
  investigating: "fa-magnifying-glass",
};

const ACTION_COLORS: Record<string, string> = {
  WARN: "dashboard-yellow",
  BAN: "text-danger",
  KICK: "dashboard-blue",
  NOTE: "text-muted",
  ADMIT: "text-nook-green",
  resolved: "text-nook-green",
  dismissed: "text-muted",
  investigating: "dashboard-blue",
};

const DashboardAuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 30;

  // Filters
  const [filterActor, setFilterActor] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [incidentData, logsWarnings] = await Promise.all([
        dashboardApi.incidents(300),
        dashboardApi.logs(new URLSearchParams({ type: "warnings", page: "1", per_page: "200" }).toString()),
      ]);

      const auditEntries: AuditEntry[] = [];
      let counter = 0;

      // From incidents
      for (const event of incidentData.events || []) {
        if (!event.status || event.status === "new") continue;
        const action = event.status.toUpperCase();
        auditEntries.push({
          id: `inc-${counter++}`,
          actor: event.assigned_to || "System",
          userId: String(event.user_id || ""),
          action,
          target: event.title,
          detail: `${event.kind} — Severity: ${event.severity}`,
          timestamp: event.timestamp,
          source: "incident",
          severity: event.severity,
        });
      }

      // From warning logs
      const buildLogEntry = (entry: LogEntry, logType: "flights" | "log"): AuditEntry => {
        const action = String(entry.action_type || entry.type || (logType === "flights" ? "ADMIT" : "WARN")).toUpperCase();
        return {
          id: `log-${counter++}`,
          actor: String(entry.moderator || entry.actor || "Bot"),
          userId: String(entry.user_id || ""),
          action,
          target: String(entry.ign || entry.user_name || "Unknown"),
          detail: String(entry.destination || entry.reason || entry.event || ""),
          timestamp: String(entry.timestamp || ""),
          source: "log",
          severity: ["WARN", "BAN", "KICK"].includes(action) ? "warning" : "info",
        };
      };

      for (const entry of logsWarnings.entries || []) {
        auditEntries.push(buildLogEntry(entry, "log"));
      }

      // Sort chronologically descending
      auditEntries.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      });

      setEntries(auditEntries);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let timer = window.setInterval(load, 90000);
    const handleVisibility = () => {
      if (document.hidden) window.clearInterval(timer);
      else { load(); timer = window.setInterval(load, 90000); }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [load]);

  const actors = useMemo(() => [...new Set(entries.map((e) => e.actor).filter(Boolean))].sort(), [entries]);
  const actions = useMemo(() => [...new Set(entries.map((e) => e.action).filter(Boolean))].sort(), [entries]);

  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (filterActor && e.actor !== filterActor) return false;
      if (filterAction && e.action !== filterAction) return false;
      if (filterUser && !e.userId.includes(filterUser) && !e.target.toLowerCase().includes(filterUser.toLowerCase())) return false;
      return true;
    }),
    [entries, filterActor, filterAction, filterUser],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (loading && entries.length === 0) {
    return <div className="text-center py-5"><div className="spinner-border text-success" /></div>;
  }

  return (
    <div className="container-fluid px-0">
      {error && <div className="alert alert-danger dashboard-alert mb-3">{error}</div>}

      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="x-small text-muted fw-bold">
          <i className="fa-solid fa-clock-rotate-left me-1" />
          {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : "Loading…"}
          <span className="ms-2 opacity-75">(auto-refreshes every 90s)</span>
          <span className="ms-2 badge rounded-pill bg-light text-muted border">{filtered.length} entries</span>
        </div>
        <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={load} disabled={loading}>
          <i className={`fa-solid fa-arrows-rotate me-1 ${loading ? "fa-spin" : ""}`} />Refresh
        </button>
      </div>

      {/* Filters */}
      <section className="section-card mb-4">
        <div className="p-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="db-label">Actor (Mod)</label>
              <select className="db-input" value={filterActor} onChange={(e) => { setFilterActor(e.target.value); setPage(1); }}>
                <option value="">All mods</option>
                {actors.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="db-label">Action Type</label>
              <select className="db-input" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="db-label">User ID / IGN</label>
              <input
                className="db-input"
                placeholder="Search user ID or IGN…"
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
              />
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-sm btn-sub w-100 fw-bold rounded-pill"
                onClick={() => { setFilterActor(""); setFilterAction(""); setFilterUser(""); setPage(1); }}
              >
                <i className="fa-solid fa-rotate-left me-1" />Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section-card">
        <div className="section-card-header">
          <span><i className="fa-solid fa-scroll me-2 dashboard-purple" />Audit Timeline</span>
        </div>
        <div className="p-4">
          {paged.length === 0 ? (
            <div className="dashboard-empty">No audit entries match the current filters.</div>
          ) : (
            <div className="audit-timeline">
              {paged.map((entry) => {
                const icon = ACTION_ICONS[entry.action] || "fa-circle-dot";
                const color = ACTION_COLORS[entry.action] || "text-muted";
                const isCritical = entry.severity === "critical";
                const isWarning = entry.severity === "warning" || entry.action === "WARN" || entry.action === "BAN";
                return (
                  <div key={entry.id} className="audit-timeline-item">
                    <div className={`audit-timeline-dot ${isCritical ? "badge-danger" : isWarning ? "badge-warning" : "badge-info"}`}>
                      <i className={`fa-solid ${icon}`} />
                    </div>
                    <div className="audit-timeline-body">
                      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                        <div>
                          <span className={`fw-black me-2 ${color}`}>{entry.action}</span>
                          <span className="fw-bold">{entry.target}</span>
                          {entry.detail && (
                            <span className="text-muted small ms-2">— {entry.detail}</span>
                          )}
                        </div>
                        <div className="text-end flex-shrink-0">
                          <div className="x-small text-muted">
                            <span title={fmtDate(entry.timestamp)} style={{ cursor: "help" }}>
                              {timeAgo(entry.timestamp)}
                            </span>
                          </div>
                          <div className="x-small fw-bold text-muted">by {entry.actor}</div>
                        </div>
                      </div>
                      {entry.userId && (
                        <div className="mt-1">
                          <Link
                            to={`/dashboard/player?user_id=${encodeURIComponent(entry.userId)}`}
                            className="x-small text-decoration-none font-monospace text-success"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square me-1" />{entry.userId}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DashboardPagination
          page={safePage}
          perPage={perPage}
          totalItems={filtered.length}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
};

export default DashboardAuditLog;
