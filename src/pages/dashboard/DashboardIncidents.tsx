import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  dashboardApi,
  type DashboardDodoQueueEntry,
  type DashboardIncidentEvent,
  type DashboardIncidentsPayload,
} from "../../lib/dashboardApi";

const severityClass = (severity: string) => {
  if (severity === "critical") return "bg-danger";
  if (severity === "warning") return "bg-warning text-dark";
  if (severity === "attention") return "bg-warning text-dark";
  return "bg-info text-dark";
};

const fmtDate = (value: unknown) => {
  if (typeof value === "number") return new Date(value * 1000).toLocaleString();
  if (typeof value === "string" && value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(value || "-");
};

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

const DashboardIncidents = () => {
  const [data, setData] = useState<DashboardIncidentsPayload | null>(null);
  const [queue, setQueue] = useState<DashboardDodoQueueEntry[]>([]);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [incidentPayload, queuePayload] = await Promise.all([
        dashboardApi.incidents(75),
        dashboardApi.dodoQueue(),
      ]);
      setData(incidentPayload);
      setQueue(queuePayload.items || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    }
  }, []);

  useEffect(() => {
    load();
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

  const updateIncident = async (event: DashboardIncidentEvent, status: string) => {
    const key = `${event.kind}:${event.source_id}:${status}`;
    setBusyKey(key);
    try {
      await dashboardApi.updateIncident({
        kind: event.kind,
        source_id: event.source_id,
        title: event.title,
        status,
        severity: event.severity,
        assigned_to: status === "investigating" ? "current mod" : event.assigned_to || "",
        note: event.note || "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update incident");
    } finally {
      setBusyKey("");
    }
  };

  const updateQueue = async (entry: DashboardDodoQueueEntry, status: string) => {
    const key = `queue:${entry.id}:${status}`;
    setBusyKey(key);
    try {
      await dashboardApi.updateDodoQueue(entry.id, status, entry.note || "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update queue");
    } finally {
      setBusyKey("");
    }
  };

  const summary = data?.summary || {};
  const allEvents = data?.events || [];
  const events = severityFilter
    ? allEvents.filter((e) => e.severity === severityFilter)
    : allEvents;

  const summaryCards = [
    ["Unknown", summary.unknown_travelers, "fa-user-secret", "text-danger", "unauthorized igns"],
    ["Warnings", summary.active_warnings, "fa-triangle-exclamation", "dashboard-yellow", "active warnings"],
    ["Dodo Reveals", summary.recent_dodo_reveals, "fa-key", "dashboard-blue", "recent reveals"],
    ["Identity", summary.recent_identity_events, "fa-id-card", "dashboard-purple", "identity changes"],
    ["Queue", summary.open_queue_entries, "fa-hourglass-half", "text-nook-green", "waiting in queue"],
    ["Workflow", summary.workflow_open, "fa-list-check", "dashboard-blue", "open workflows"],
  ];

  if (error && !data) return <div className="alert alert-danger fw-bold">{error}</div>;

  return (
    <div className="container-fluid px-0">
      {error && <div className="alert alert-danger dashboard-alert">{error}</div>}

      <div className="row g-3 mb-4">
        {summaryCards.map(([label, value, icon, color, sub]) => (
          <div className="col-6 col-lg-2" key={String(label)}>
            <div className="stat-card h-100">
              <div className="stat-label"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
              <div className={`stat-value ${color}`}>{Number(value || 0).toLocaleString()}</div>
              {sub && <div className="x-small text-muted fw-bold mt-1">{String(sub)}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <section className="section-card h-100">
            <div className="section-card-header flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <span><i className="fa-solid fa-triangle-exclamation me-2 text-warning" />Incident Center</span>
                <span className="badge rounded-pill bg-light text-muted border">{events.length} shown</span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div className="btn-group btn-group-sm">
                  {["", "critical", "warning", "info"].map((sev) => (
                    <button
                      key={sev || "all"}
                      className={`btn btn-sm ${severityFilter === sev ? "btn-dark text-white fw-bold" : "btn-sub"}`}
                      onClick={() => setSeverityFilter(sev)}
                    >
                      {sev ? sev.toUpperCase() : "ALL"}
                    </button>
                  ))}
                </div>
                <button className="btn btn-sm rounded-pill fw-bold btn-sub" onClick={load} title="Refresh incidents">
                  <i className="fa-solid fa-arrows-rotate me-1" />
                  {lastRefreshed ? lastRefreshed.toLocaleTimeString() : "Refresh"}
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="db-table">
                <thead><tr><th>Severity</th><th>Type</th><th>Event</th><th>Status</th><th>When</th><th>User</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {!data ? (
                    <tr><td colSpan={7} className="text-center py-4"><div className="spinner-border spinner-border-sm text-warning" /></td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-muted fw-bold">No active incidents found.</td></tr>
                  ) : events.map((event) => {
                    const key = `${event.kind}:${event.source_id}`;
                    const isCritical = event.severity === "critical";
                    const isWarning = event.severity === "warning" || event.severity === "attention";
                    const rowBg = isCritical
                      ? "rgba(239, 68, 68, 0.07)"
                      : isWarning
                      ? "rgba(245, 158, 11, 0.07)"
                      : undefined;

                    return (
                      <tr key={key} style={rowBg ? { background: rowBg } : undefined}>
                        <td><span className={`badge rounded-pill ${severityClass(event.severity)}`}>{event.severity}</span></td>
                        <td className="small fw-bold">{event.kind}</td>
                        <td className="fw-bold">{event.title}</td>
                        <td>
                          <span className={`badge rounded-pill ${event.status === "resolved" ? "badge-auth" : event.status === "investigating" ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle" : "bg-light text-muted border"}`}>
                            {event.status || "new"}
                          </span>
                        </td>
                        <td className="small text-muted">
                          <span title={fmtDate(event.timestamp)} style={{ cursor: "help" }}>
                            {timeAgo(String(event.timestamp))}
                          </span>
                        </td>
                        <td>
                          {event.user_id ? (
                            <Link className="fw-bold text-decoration-none" to={`/dashboard/trust?user_id=${encodeURIComponent(String(event.user_id))}`}>
                              {String(event.user_id)}
                            </Link>
                          ) : "-"}
                        </td>
                        <td className="text-end text-nowrap">
                          {["investigating", "resolved", "dismissed"].map((status) => {
                            const isCurrent = (event.status || "new") === status;
                            return (
                              <button
                                key={status}
                                className={`btn btn-sm rounded-pill fw-bold me-1 ${isCurrent ? "btn-dark text-white" : "btn-sub"}`}
                                disabled={busyKey === `${key}:${status}` || isCurrent}
                                onClick={() => updateIncident(event, status)}
                                title={isCurrent ? `Currently ${status}` : `Mark as ${status}`}
                              >
                                {busyKey === `${key}:${status}` ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : status === "investigating" ? "Investigate" : status === "resolved" ? "Resolve" : "Dismiss"}
                              </button>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="section-card h-100">
            <div className="section-card-header">
              <span><i className="fa-solid fa-plane me-2 dashboard-blue" />Dodo Queue</span>
              <span className="badge rounded-pill bg-light text-muted border">{queue.length} in queue</span>
            </div>
            <div className="table-responsive">
              <table className="db-table">
                <thead><tr><th>#</th><th>Island</th><th>User</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-muted fw-bold">Queue is clear.</td></tr>
                  ) : queue.map((entry, idx) => {
                    const entryTime = typeof entry.created_at === "number"
                      ? new Date(entry.created_at * 1000).toISOString()
                      : String(entry.created_at || "");
                    return (
                      <tr key={entry.id}>
                        <td className="fw-bold text-muted" style={{ width: "2rem" }}>#{idx + 1}</td>
                        <td className="fw-bold">{entry.island_name}</td>
                        <td>
                          <Link className="fw-bold text-decoration-none" to={`/dashboard/trust?user_id=${encodeURIComponent(entry.user_id)}`}>
                            {entry.username || entry.user_id}
                          </Link>
                          <div className="x-small text-muted" title={fmtDate(entry.created_at)} style={{ cursor: "help" }}>
                            {timeAgo(entryTime)}
                          </div>
                        </td>
                        <td>
                          <span className={`badge rounded-pill ${entry.status === "called" ? "bg-primary text-white" : entry.status === "waiting" ? "bg-warning text-dark" : "bg-light text-muted border"}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="text-end text-nowrap">
                          {["called", "done", "cancelled"].map((status) => {
                            const isCurrent = entry.status === status;
                            return (
                              <button
                                key={status}
                                className={`btn btn-sm rounded-pill fw-bold me-1 ${isCurrent ? "btn-dark text-white" : "btn-sub"}`}
                                disabled={busyKey === `queue:${entry.id}:${status}` || isCurrent}
                                onClick={() => updateQueue(entry, status)}
                                title={isCurrent ? `Currently ${status}` : `Mark as ${status}`}
                              >
                                {busyKey === `queue:${entry.id}:${status}` ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : status === "called" ? "Call" : status === "done" ? "Done" : "Cancel"}
                              </button>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardIncidents;
