import { useCallback, useEffect, useState } from "react";
import {
  dashboardApi,
  type DashboardDodoQueueEntry,
  type DashboardIncidentEvent,
} from "../../lib/dashboardApi";

const DashboardBulkActions = () => {
  const [incidents, setIncidents] = useState<DashboardIncidentEvent[]>([]);
  const [queue, setQueue] = useState<DashboardDodoQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Selection state
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set());
  const [selectedQueue, setSelectedQueue] = useState<Set<number>>(new Set());

  // Action targets
  const [incidentAction, setIncidentAction] = useState("resolved");
  const [queueAction, setQueueAction] = useState("done");

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inc, q] = await Promise.all([
        dashboardApi.incidents(200),
        dashboardApi.dodoQueue("waiting,called,investigating"),
      ]);
      setIncidents(inc.events || []);
      setQueue(q.items || []);
      setSelectedIncidents(new Set());
      setSelectedQueue(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Incident selection helpers ----
  const toggleIncident = (key: string) => {
    setSelectedIncidents((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAllIncidents = () => {
    setSelectedIncidents(new Set(incidents.map((e) => `${e.kind}:${e.source_id}`)));
  };

  const clearIncidents = () => setSelectedIncidents(new Set());

  // ---- Queue selection helpers ----
  const toggleQueue = (id: number) => {
    setSelectedQueue((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllQueue = () => {
    setSelectedQueue(new Set(queue.map((e) => e.id)));
  };

  const clearQueue = () => setSelectedQueue(new Set());

  // ---- Bulk apply ----
  const applyBulkIncidents = async () => {
    if (selectedIncidents.size === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      await Promise.all(
        incidents
          .filter((e) => selectedIncidents.has(`${e.kind}:${e.source_id}`))
          .map((e) =>
            dashboardApi
              .updateIncident({
                kind: e.kind,
                source_id: e.source_id,
                title: e.title,
                severity: e.severity,
                status: incidentAction,
                assigned_to: e.assigned_to || "",
                note: e.note || "",
              })
              .then(() => ok++)
              .catch(() => fail++),
          ),
      );
      showNotice(`Bulk update complete: ${ok} updated${fail > 0 ? `, ${fail} failed` : ""}.`);
      await load();
    } catch {
      setError("Bulk incident update failed.");
    } finally {
      setBusy(false);
    }
  };

  const applyBulkQueue = async () => {
    if (selectedQueue.size === 0) return;
    setBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      await Promise.all(
        queue
          .filter((e) => selectedQueue.has(e.id))
          .map((e) =>
            dashboardApi
              .updateDodoQueue(e.id, queueAction, e.note || "")
              .then(() => ok++)
              .catch(() => fail++),
          ),
      );
      showNotice(`Queue bulk update: ${ok} updated${fail > 0 ? `, ${fail} failed` : ""}.`);
      await load();
    } catch {
      setError("Bulk queue update failed.");
    } finally {
      setBusy(false);
    }
  };

  const severityBadge = (s: string) => {
    if (s === "critical") return "bg-danger";
    if (s === "warning" || s === "attention") return "bg-warning text-dark";
    return "bg-info text-dark";
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" />
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      {error && <div className="alert alert-danger dashboard-alert mb-3">{error}</div>}
      {notice && <div className="alert alert-success dashboard-alert mb-3"><i className="fa-solid fa-check me-2" />{notice}</div>}

      {/* Bulk Incidents */}
      <section className="section-card mb-4">
        <div className="section-card-header flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span><i className="fa-solid fa-triangle-exclamation me-2 text-warning" />Bulk Incident Actions</span>
            <span className="badge rounded-pill bg-light text-muted border">{incidents.length} incidents</span>
            {selectedIncidents.size > 0 && (
              <span className="badge rounded-pill bg-success">{selectedIncidents.size} selected</span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="btn-group btn-group-sm">
              <button className="btn btn-sub fw-bold" onClick={selectAllIncidents}>Select All</button>
              <button className="btn btn-sub fw-bold" onClick={clearIncidents}>Clear</button>
            </div>
            <select
              className="db-input py-1"
              style={{ maxWidth: 160 }}
              value={incidentAction}
              onChange={(e) => setIncidentAction(e.target.value)}
            >
              <option value="resolved">Mark Resolved</option>
              <option value="dismissed">Mark Dismissed</option>
              <option value="investigating">Mark Investigating</option>
            </select>
            <button
              className="btn btn-sm btn-nook-primary fw-bold rounded-pill"
              disabled={busy || selectedIncidents.size === 0}
              onClick={applyBulkIncidents}
            >
              {busy ? <span className="spinner-border spinner-border-sm" /> : (
                <><i className="fa-solid fa-bolt me-1" />Apply to {selectedIncidents.size}</>
              )}
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedIncidents.size === incidents.length && incidents.length > 0}
                    onChange={(e) => e.target.checked ? selectAllIncidents() : clearIncidents()}
                    style={{ accentColor: "var(--nook-green)" }}
                  />
                </th>
                <th>Severity</th>
                <th>Event</th>
                <th>Type</th>
                <th>Status</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted fw-bold">No incidents found.</td></tr>
              ) : incidents.map((event) => {
                const key = `${event.kind}:${event.source_id}`;
                const checked = selectedIncidents.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => toggleIncident(key)}
                    style={{ cursor: "pointer", background: checked ? "rgba(34,197,94,0.07)" : undefined }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIncident(key)}
                        style={{ accentColor: "var(--nook-green)" }}
                      />
                    </td>
                    <td><span className={`badge rounded-pill ${severityBadge(event.severity)}`}>{event.severity}</span></td>
                    <td className="fw-bold">{event.title}</td>
                    <td className="small text-muted">{event.kind}</td>
                    <td>
                      <span className={`badge rounded-pill ${event.status === "resolved" ? "badge-auth" : "bg-light text-muted border"}`}>
                        {event.status || "new"}
                      </span>
                    </td>
                    <td className="font-monospace small text-muted">{event.user_id ? String(event.user_id) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bulk Queue */}
      <section className="section-card">
        <div className="section-card-header flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span><i className="fa-solid fa-plane me-2 dashboard-blue" />Bulk Dodo Queue Actions</span>
            <span className="badge rounded-pill bg-light text-muted border">{queue.length} in queue</span>
            {selectedQueue.size > 0 && (
              <span className="badge rounded-pill bg-success">{selectedQueue.size} selected</span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="btn-group btn-group-sm">
              <button className="btn btn-sub fw-bold" onClick={selectAllQueue}>Select All</button>
              <button className="btn btn-sub fw-bold" onClick={clearQueue}>Clear</button>
            </div>
            <select
              className="db-input py-1"
              style={{ maxWidth: 160 }}
              value={queueAction}
              onChange={(e) => setQueueAction(e.target.value)}
            >
              <option value="called">Mark Called</option>
              <option value="done">Mark Done</option>
              <option value="cancelled">Mark Cancelled</option>
            </select>
            <button
              className="btn btn-sm btn-nook-primary fw-bold rounded-pill"
              disabled={busy || selectedQueue.size === 0}
              onClick={applyBulkQueue}
            >
              {busy ? <span className="spinner-border spinner-border-sm" /> : (
                <><i className="fa-solid fa-bolt me-1" />Apply to {selectedQueue.size}</>
              )}
            </button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedQueue.size === queue.length && queue.length > 0}
                    onChange={(e) => e.target.checked ? selectAllQueue() : clearQueue()}
                    style={{ accentColor: "var(--nook-green)" }}
                  />
                </th>
                <th>Island</th>
                <th>User</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-4 text-muted fw-bold">Queue is clear.</td></tr>
              ) : queue.map((entry) => {
                const checked = selectedQueue.has(entry.id);
                return (
                  <tr
                    key={entry.id}
                    onClick={() => toggleQueue(entry.id)}
                    style={{ cursor: "pointer", background: checked ? "rgba(34,197,94,0.07)" : undefined }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleQueue(entry.id)}
                        style={{ accentColor: "var(--nook-green)" }}
                      />
                    </td>
                    <td className="fw-bold">{entry.island_name}</td>
                    <td className="text-muted">{entry.username || entry.user_id}</td>
                    <td>
                      <span className={`badge rounded-pill ${entry.status === "called" ? "bg-primary text-white" : entry.status === "waiting" ? "bg-warning text-dark" : "bg-light text-muted border"}`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardBulkActions;
