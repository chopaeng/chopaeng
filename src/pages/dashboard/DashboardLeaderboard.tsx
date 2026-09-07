import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../../lib/dashboardApi";

interface ModStat {
  moderator: string;
  actions: number;
  resolved: number;
  dismissed: number;
  investigating: number;
  critical: number;
  lastAction: string;
}

const DashboardLeaderboard = () => {
  const [stats, setStats] = useState<ModStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<"actions" | "resolved" | "critical">("actions");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [incidentData, logsData] = await Promise.all([
        dashboardApi.incidents(200),
        dashboardApi.logs(new URLSearchParams({ type: "warnings", page: "1", per_page: "200" }).toString()),
      ]);

      // Aggregate stats from incidents
      const modMap = new Map<string, ModStat>();

      const ensure = (actor: string): ModStat => {
        if (!modMap.has(actor)) {
          modMap.set(actor, {
            moderator: actor,
            actions: 0,
            resolved: 0,
            dismissed: 0,
            investigating: 0,
            critical: 0,
            lastAction: "",
          });
        }
        return modMap.get(actor)!;
      };

      for (const event of incidentData.events || []) {
        const actor = String(event.assigned_to || "").trim();
        if (!actor || actor === "current mod") continue;
        const m = ensure(actor);
        m.actions++;
        if (event.status === "resolved") m.resolved++;
        if (event.status === "dismissed") m.dismissed++;
        if (event.status === "investigating") m.investigating++;
        if (event.severity === "critical") m.critical++;
        if (!m.lastAction || event.timestamp > m.lastAction) m.lastAction = event.timestamp;
      }

      // Also count from log entries (warnings)
      for (const entry of logsData.entries || []) {
        const actor = String((entry as Record<string, unknown>).moderator || (entry as Record<string, unknown>).actor || "").trim();
        if (!actor) continue;
        const m = ensure(actor);
        m.actions++;
        const ts = String((entry as Record<string, unknown>).timestamp || "");
        if (!m.lastAction || ts > m.lastAction) m.lastAction = ts;
      }

      setStats(Array.from(modMap.values()));
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    let timer = window.setInterval(load, 120000);
    const handleVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        load();
        timer = window.setInterval(load, 120000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  const sorted = useMemo(
    () => [...stats].sort((a, b) => b[sortBy] - a[sortBy]),
    [stats, sortBy],
  );

  const maxActions = Math.max(...sorted.map((m) => m.actions), 1);

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hr ago`;
    return `${Math.floor(diffSec / 86400)} d ago`;
  };

  const medalColor = (i: number) => {
    if (i === 0) return "#f59e0b";
    if (i === 1) return "#94a3b8";
    if (i === 2) return "#a16207";
    return "transparent";
  };

  if (loading && stats.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" />
        <div className="mt-2 text-muted fw-bold small">Computing leaderboard from incident & warning data…</div>
      </div>
    );
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
        <div className="d-flex gap-2 align-items-center">
          <span className="x-small text-muted fw-bold">Sort by:</span>
          {(["actions", "resolved", "critical"] as const).map((key) => (
            <button
              key={key}
              className={`btn btn-sm rounded-pill fw-bold ${sortBy === key ? "btn-nook-primary" : "btn-sub"}`}
              onClick={() => setSortBy(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={load} disabled={loading}>
            <i className={`fa-solid fa-arrows-rotate me-1 ${loading ? "fa-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <section className="section-card">
          <div className="p-5 text-center">
            <i className="fa-solid fa-trophy fa-3x mb-3 text-muted" />
            <div className="fw-bold text-muted">No moderator activity data found yet.</div>
            <div className="small text-muted mt-1">Action data is derived from incident assignments and warning logs.</div>
          </div>
        </section>
      ) : (
        <>
          {/* Top 3 Podium */}
          {sorted.length >= 1 && (
            <div className="row g-3 mb-4">
              {sorted.slice(0, 3).map((mod, i) => (
                <div className="col-12 col-md-4" key={mod.moderator}>
                  <div
                    className="stat-card text-center"
                    style={{
                      borderColor: medalColor(i),
                      background: `${medalColor(i)}11`,
                    }}
                  >
                    <div className="mb-2">
                      <span style={{ fontSize: "2rem" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                    </div>
                    <div className="fw-black fs-5 ac-font">{mod.moderator}</div>
                    <div className={`stat-value mt-1 ${i === 0 ? "text-nook-green" : i === 1 ? "text-muted" : "dashboard-yellow"}`} style={{ fontSize: "2rem" }}>
                      {mod.actions}
                    </div>
                    <div className="x-small text-muted fw-bold">total actions</div>
                    <div className="d-flex justify-content-center gap-3 mt-2">
                      <span className="x-small fw-bold text-success"><i className="fa-solid fa-check me-1" />{mod.resolved} resolved</span>
                      {mod.critical > 0 && <span className="x-small fw-bold text-danger"><i className="fa-solid fa-fire me-1" />{mod.critical} critical</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Full Table */}
          <section className="section-card">
            <div className="section-card-header">
              <span><i className="fa-solid fa-ranking-star me-2 dashboard-yellow" />Full Leaderboard</span>
              <span className="badge rounded-pill bg-light text-muted border">{sorted.length} mods</span>
            </div>
            <div className="table-responsive">
              <table className="db-table">
                <thead>
                  <tr>
                    <th style={{ width: "3rem" }}>#</th>
                    <th>Moderator</th>
                    <th>Total Actions</th>
                    <th>Resolved</th>
                    <th>Dismissed</th>
                    <th>Investigating</th>
                    <th>Critical</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((mod, i) => (
                    <tr key={mod.moderator}>
                      <td className="fw-black text-muted" style={{ color: medalColor(i) }}>
                        {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                      </td>
                      <td>
                        <div className="fw-bold">{mod.moderator}</div>
                        <div className="dashboard-progress mt-1" style={{ height: 4 }}>
                          <div style={{ width: `${Math.round((mod.actions / maxActions) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="fw-black text-nook-green">{mod.actions}</td>
                      <td className="text-success fw-bold">{mod.resolved}</td>
                      <td className="text-muted fw-bold">{mod.dismissed}</td>
                      <td className="dashboard-blue fw-bold">{mod.investigating}</td>
                      <td className={mod.critical > 0 ? "text-danger fw-bold" : "text-muted"}>{mod.critical}</td>
                      <td className="small text-muted">{timeAgo(mod.lastAction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardLeaderboard;
