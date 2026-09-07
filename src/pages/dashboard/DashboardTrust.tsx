import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dashboardApi, type DashboardUserTrust } from "../../lib/dashboardApi";

const stateClass = (state: string) => {
  if (state === "restricted") return "text-danger";
  if (state === "watch") return "dashboard-yellow";
  if (state === "warned") return "dashboard-blue";
  if (state === "trusted") return "text-nook-green";
  return "text-muted";
};

const severityBadge = (severity: string) => {
  if (severity === "critical") return "bg-danger";
  if (severity === "warning") return "bg-warning text-dark";
  if (severity === "attention") return "bg-warning text-dark";
  return "bg-info text-dark";
};

const text = (value: unknown) => String(value ?? "-");

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

const DashboardTrust = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState(searchParams.get("user_id") || "");
  const [profile, setProfile] = useState<DashboardUserTrust | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const search = useCallback(async (target = userId) => {
    const clean = target.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    try {
      const data = await dashboardApi.userTrustProfile(clean);
      setProfile(data);
      setSearchParams({ user_id: clean });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trust profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams, userId]);

  useEffect(() => {
    const fromUrl = searchParams.get("user_id") || "";
    if (fromUrl && fromUrl !== userId) setUserId(fromUrl);
    if (fromUrl) search(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyUserId = () => {
    if (!profile?.user_id) return;
    navigator.clipboard.writeText(profile.user_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const avatarUrl = useMemo(() => {
    if (!profile?.user_id) return null;
    try {
      const idx = Number(BigInt(profile.user_id) >> 22n) % 6;
      return `https://cdn.discordapp.com/embed/avatars/${Math.abs(idx)}.png`;
    } catch {
      return null;
    }
  }, [profile?.user_id]);

  const riskNum = typeof profile?.risk_score === "number" ? profile.risk_score : 0;
  const riskColor = riskNum < 30 ? "var(--nook-green)" : riskNum < 70 ? "#f59e0b" : "#dc3545";

  const summary = profile?.summary || {};
  const cards = [
    ["Risk Score", profile?.risk_score ?? "-", "fa-gauge-high", riskNum >= 70 ? "text-danger" : riskNum >= 30 ? "dashboard-yellow" : "text-nook-green"],
    ["State", profile?.status_label || "-", "fa-shield-halved", stateClass(profile?.trust_state || "")],
    ["Visits", summary.total_visits ?? 0, "fa-plane", "text-nook-green"],
    ["Warnings", summary.warnings ?? 0, "fa-triangle-exclamation", "dashboard-yellow"],
    ["Kicks", summary.kicks ?? 0, "fa-person-walking-arrow-right", "dashboard-blue"],
    ["Dodo Reveals", summary.dodo_reveals ?? 0, "fa-key", "dashboard-purple"],
  ];

  return (
    <div className="container-fluid px-0">
      <section className="section-card mb-4">
        <div className="section-card-header">
          <span><i className="fa-solid fa-user-shield me-2 text-success" />User Trust Profile</span>
        </div>
        <div className="p-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-7">
              <label className="db-label">Discord User ID</label>
              <input
                className="db-input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="123456789012345678"
              />
            </div>
            <div className="col-md-3">
              <button className="btn btn-nook-primary w-100 fw-bold" disabled={loading} onClick={() => search()}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="fa-solid fa-magnifying-glass me-1" />Search Profile</>}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-danger dashboard-alert mt-3 mb-0">{error}</div>}
        </div>
      </section>

      {profile && (
        <>
          <div className="row g-3 mb-4">
            {cards.map(([label, value, icon, color]) => (
              <div className="col-6 col-lg-2" key={String(label)}>
                <div className="stat-card h-100">
                  <div className="stat-label"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
                  <div className={`stat-value ${color}`}>{text(value)}</div>
                  {label === "Risk Score" && (
                    <div className="dashboard-progress mt-2" style={{ height: "6px" }}>
                      <div style={{ width: `${Math.min(100, Math.max(5, riskNum))}%`, background: riskColor }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4 mb-4">
            <div className="col-12 col-xl-5">
              <section className="section-card h-100">
                <div className="section-card-header"><span><i className="fa-solid fa-id-badge me-2 dashboard-blue" />Identity</span></div>
                <div className="p-4">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="rounded-circle border"
                        style={{ width: "56px", height: "56px", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="dashboard-avatar-fallback rounded-circle"
                        style={{ width: "56px", height: "56px", fontSize: "1.4rem" }}
                      >
                        {profile.user_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <div className="fw-bold fs-5">{profile.user_name || profile.user_id}</div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span className="x-small text-muted font-monospace">{profile.user_id}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-sub px-2 py-0 x-small rounded-pill"
                          onClick={copyUserId}
                          title="Copy Discord User ID"
                          style={{ fontSize: "0.72rem" }}
                        >
                          <i className={`fa-solid ${copied ? "fa-check text-success" : "fa-copy"} me-1`} />
                          {copied ? "Copied" : "Copy ID"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="db-label">Risk Evaluation</div>
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="small fw-bold">Score: {riskNum} / 100</span>
                      <span className="badge rounded-pill" style={{ background: riskColor, color: "white" }}>
                        {profile.status_label || (riskNum < 30 ? "Low Risk" : riskNum < 70 ? "Medium Risk" : "High Risk")}
                      </span>
                    </div>
                    <div className="dashboard-progress" style={{ height: "8px" }}>
                      <div style={{ width: `${Math.min(100, Math.max(5, riskNum))}%`, background: riskColor }} />
                    </div>
                  </div>

                  <div className="db-label">Risk Flags</div>
                  <div className="d-flex flex-wrap gap-2">
                    {profile.risk_flags.length ? profile.risk_flags.map((flag) => (
                      <span key={flag} className="badge rounded-pill bg-light text-dark border">{flag.replace(/_/g, " ")}</span>
                    )) : <span className="text-muted small fw-bold">No active flags.</span>}
                  </div>
                </div>
              </section>
            </div>
            <div className="col-12 col-xl-7">
              <section className="section-card h-100">
                <div className="section-card-header"><span><i className="fa-solid fa-leaf me-2 text-success" />Known IGNs</span></div>
                <div className="table-responsive">
                  <table className="db-table">
                    <thead><tr><th>IGN</th><th>Visits</th><th>Last Seen</th></tr></thead>
                    <tbody>
                      {profile.known_igns.length ? profile.known_igns.map((row, index) => (
                        <tr key={`${text(row.ign)}-${index}`}>
                          <td className="fw-bold">{text(row.ign)}</td>
                          <td>{text(row.visit_count)}</td>
                          <td className="small text-muted">
                            <span title={fmtDate(row.last_seen_at)} style={{ cursor: "help" }}>
                              {timeAgo(String(row.last_seen_at || ""))}
                            </span>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={3} className="text-center py-4 text-muted fw-bold">No known IGNs.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>

          <section className="section-card">
            <div className="section-card-header"><span><i className="fa-solid fa-timeline me-2 dashboard-purple" />Unified Timeline</span></div>
            <div className="table-responsive">
              <table className="db-table">
                <thead><tr><th>Signal</th><th>Event</th><th>Severity</th><th>When</th></tr></thead>
                <tbody>
                  {profile.timeline.length ? profile.timeline.map((item, index) => (
                    <tr key={`${item.type}-${item.timestamp}-${index}`}>
                      <td className="fw-bold">{item.label || item.type}</td>
                      <td>{item.title}</td>
                      <td><span className={`badge rounded-pill ${severityBadge(item.severity)}`}>{item.severity}</span></td>
                      <td className="small text-muted">
                        <span title={fmtDate(item.timestamp)} style={{ cursor: "help" }}>
                          {timeAgo(item.timestamp)}
                        </span>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4} className="text-center py-4 text-muted fw-bold">No timeline events.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardTrust;
