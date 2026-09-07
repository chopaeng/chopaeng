import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../../lib/dashboardApi";

interface MaintenanceWindow {
  id: string;
  reason: string;
  startAt: string;
  endAt: string;
  recurring: boolean;
  recurDay: string;
  status: "planned" | "active" | "done";
  createdAt: string;
}

const STORAGE_KEY = "db-maintenance-windows";

const loadWindows = (): MaintenanceWindow[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveWindows = (items: MaintenanceWindow[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const fmtDate = (v: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString();
};

const countdown = (targetStr: string): string => {
  const target = new Date(targetStr).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "Now / Past";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)} days`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DashboardMaintenance = () => {
  const [windows, setWindows] = useState<MaintenanceWindow[]>(loadWindows);
  const [opsStatus, setOpsStatus] = useState<{ maintenance?: Record<string, unknown> } | null>(null);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "planned" | "active" | "done">("all");

  // Form state
  const [reason, setReason] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurDay, setRecurDay] = useState("0");

  // 1s tick for countdowns
  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const loadOps = useCallback(async () => {
    try {
      const status = await dashboardApi.runtimeStatus();
      setOpsStatus(status);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadOps();
    const iv = window.setInterval(loadOps, 60000);
    return () => window.clearInterval(iv);
  }, [loadOps]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const updateWindows = (next: MaintenanceWindow[]) => {
    saveWindows(next);
    setWindows(next);
  };

  const add = () => {
    if (!reason.trim() || !startAt) return;
    const w: MaintenanceWindow = {
      id: `mw-${Date.now()}`,
      reason: reason.trim(),
      startAt,
      endAt,
      recurring,
      recurDay,
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    updateWindows([...windows, w]);
    setReason("");
    setStartAt("");
    setEndAt("");
    setRecurring(false);
    showNotice("Maintenance window planned.");
  };

  const markStatus = (id: string, status: MaintenanceWindow["status"]) => {
    updateWindows(windows.map((w) => (w.id === id ? { ...w, status } : w)));
  };

  const remove = (id: string) => updateWindows(windows.filter((w) => w.id !== id));

  const filtered = useMemo(
    () => windows.filter((w) => filter === "all" || w.status === filter),
    [windows, filter],
  );

  // Upcoming planned (by start time)
  const upcoming = useMemo(
    () =>
      windows
        .filter((w) => w.status === "planned" && new Date(w.startAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windows, tick],
  );

  const nextWindow = upcoming[0];
  const maintenanceActive = Boolean(opsStatus?.maintenance && Object.keys(opsStatus.maintenance).length > 0);

  return (
    <div className="container-fluid px-0">
      {notice && (
        <div className="alert alert-success dashboard-alert mb-3">
          <i className="fa-solid fa-check me-2" />{notice}
        </div>
      )}

      {/* Current maintenance status from ops */}
      {maintenanceActive && (
        <div className="alert dashboard-alert mb-4" style={{ background: "rgba(239,68,68,0.09)", borderColor: "#fca5a5" }}>
          <i className="fa-solid fa-wrench me-2 text-danger" />
          <strong>Maintenance Mode is currently ACTIVE</strong> — manage via{" "}
          <a href="/dashboard/ops" className="fw-bold">Ops &rarr; Maintenance</a>
        </div>
      )}

      {/* Countdown to next */}
      {nextWindow && (
        <div className="section-card mb-4 p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <div className="x-small text-muted fw-bold mb-1">
                <i className="fa-solid fa-clock me-1" />NEXT SCHEDULED MAINTENANCE
              </div>
              <div className="fw-black fs-5">{nextWindow.reason}</div>
              <div className="small text-muted mt-1">
                <i className="fa-solid fa-calendar me-1" />{fmtDate(nextWindow.startAt)}
                {nextWindow.endAt && <> &rarr; {fmtDate(nextWindow.endAt)}</>}
              </div>
            </div>
            <div className="text-center">
              <div className="fw-black" style={{ fontSize: "2.5rem", color: "var(--nook-green)", lineHeight: 1 }}>
                {countdown(nextWindow.startAt)}
              </div>
              <div className="x-small text-muted fw-bold">until maintenance</div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="row g-3 mb-4">
        {[
          ["Planned", windows.filter((w) => w.status === "planned").length, "fa-calendar-plus", "dashboard-blue"],
          ["Active", windows.filter((w) => w.status === "active").length, "fa-wrench", "text-danger"],
          ["Done", windows.filter((w) => w.status === "done").length, "fa-circle-check", "text-nook-green"],
          ["Recurring", windows.filter((w) => w.recurring).length, "fa-rotate", "dashboard-purple"],
        ].map(([label, value, icon, color]) => (
          <div className="col-6 col-md-3" key={String(label)}>
            <div className="stat-card">
              <div className="stat-label"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
              <div className={`stat-value ${color}`}>{String(value)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      <section className="section-card mb-4">
        <div className="section-card-header">
          <span><i className="fa-solid fa-plus me-2 text-success" />Plan Maintenance Window</span>
        </div>
        <div className="p-4">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="db-label">Reason / Description</label>
              <input
                className="db-input"
                placeholder="e.g. Scheduled database migration"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="db-label">Start</label>
              <input
                className="db-input"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="db-label">End (optional)</label>
              <input
                className="db-input"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
            <div className="col-md-4 d-flex align-items-center gap-3">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="recurring-check"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  style={{ accentColor: "var(--nook-green)" }}
                />
                <label className="form-check-label db-label mb-0" htmlFor="recurring-check">Recurring</label>
              </div>
              {recurring && (
                <select className="db-input py-1" style={{ maxWidth: 180 }} value={recurDay} onChange={(e) => setRecurDay(e.target.value)}>
                  {DAYS.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                </select>
              )}
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button
                className="btn btn-nook-primary w-100 fw-bold"
                disabled={!reason.trim() || !startAt}
                onClick={add}
              >
                <i className="fa-solid fa-calendar-plus me-1" />Plan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="section-card">
        <div className="section-card-header flex-wrap gap-2">
          <span><i className="fa-solid fa-list me-2 dashboard-blue" />Maintenance Windows</span>
          <div className="btn-group btn-group-sm">
            {(["all", "planned", "active", "done"] as const).map((f) => (
              <button key={f} className={`btn fw-bold ${filter === f ? "btn-dark text-white" : "btn-sub"}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Reason</th>
                <th>Start</th>
                <th>End</th>
                <th>Countdown</th>
                <th>Recurring</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-muted fw-bold">No maintenance windows planned.</td></tr>
              ) : [...filtered].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).map((w) => (
                <tr key={w.id}>
                  <td>
                    <span className={`badge rounded-pill fw-bold ${w.status === "active" ? "bg-danger" : w.status === "done" ? "badge-auth" : "bg-light text-muted border"}`}>
                      {w.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="fw-bold">{w.reason}</td>
                  <td className="small text-muted">{fmtDate(w.startAt)}</td>
                  <td className="small text-muted">{w.endAt ? fmtDate(w.endAt) : "—"}</td>
                  <td>
                    {w.status === "planned" && new Date(w.startAt).getTime() > Date.now()
                      ? <span className="fw-bold text-nook-green small">{countdown(w.startAt)}</span>
                      : <span className="text-muted small">—</span>
                    }
                  </td>
                  <td>
                    {w.recurring
                      ? <span className="badge rounded-pill bg-light text-muted border"><i className="fa-solid fa-rotate me-1" />{DAYS[Number(w.recurDay)] || "?"}</span>
                      : <span className="text-muted small">—</span>
                    }
                  </td>
                  <td className="text-end text-nowrap">
                    {w.status === "planned" && (
                      <button className="btn btn-sm btn-sub rounded-pill fw-bold me-1" onClick={() => markStatus(w.id, "active")}>
                        <i className="fa-solid fa-wrench me-1" />Activate
                      </button>
                    )}
                    {w.status === "active" && (
                      <button className="btn btn-sm btn-sub rounded-pill fw-bold me-1" onClick={() => markStatus(w.id, "done")}>
                        <i className="fa-solid fa-circle-check me-1 text-success" />Done
                      </button>
                    )}
                    <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={() => remove(w.id)}>
                      <i className="fa-solid fa-trash-can text-danger" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardMaintenance;
