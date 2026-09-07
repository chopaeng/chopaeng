import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { dashboardApi, type DashboardUserTrust } from "../../lib/dashboardApi";

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

const stateClass = (state: string) => {
  if (state === "restricted") return "text-danger";
  if (state === "watch") return "dashboard-yellow";
  if (state === "warned") return "dashboard-blue";
  if (state === "trusted") return "text-nook-green";
  return "text-muted";
};

const severityBadge = (severity: string) => {
  if (severity === "critical") return "bg-danger";
  if (severity === "warning" || severity === "attention") return "bg-warning text-dark";
  return "bg-info text-dark";
};

const timelineIcon = (type: string) => {
  if (type.includes("warn")) return "fa-triangle-exclamation";
  if (type.includes("ban")) return "fa-ban";
  if (type.includes("kick")) return "fa-person-walking-arrow-right";
  if (type.includes("dodo")) return "fa-key";
  if (type.includes("visit") || type.includes("flight")) return "fa-plane";
  if (type.includes("identity")) return "fa-id-card";
  return "fa-circle-dot";
};

const DashboardPlayerLookup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("user_id") || "");
  const [profile, setProfile] = useState<DashboardUserTrust | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "visits" | "actions" | "timeline">("overview");

  const search = useCallback(async (target = query) => {
    const clean = target.trim();
    if (!clean) return;
    setLoading(true);
    setError("");
    setProfile(null);
    try {
      const data = await dashboardApi.userTrustProfile(clean);
      setProfile(data);
      setSearchParams({ user_id: clean });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No profile found for this user.");
    } finally {
      setLoading(false);
    }
  }, [query, setSearchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get("user_id") || "";
    if (fromUrl) {
      setQuery(fromUrl);
      search(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const copyId = () => {
    if (!profile?.user_id) return;
    navigator.clipboard.writeText(profile.user_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container-fluid px-0">
      {/* Search Bar */}
      <section className="section-card mb-4">
        <div className="section-card-header">
          <span><i className="fa-solid fa-magnifying-glass me-2 text-success" />Player Lookup</span>
          <span className="x-small text-muted">Search by Discord User ID or IGN</span>
        </div>
        <div className="p-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-8">
              <label className="db-label">Discord User ID</label>
              <input
                id="player-lookup-input"
                className="db-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="123456789012345678"
                autoFocus
              />
            </div>
            <div className="col-md-4">
              <button
                id="player-lookup-btn"
                className="btn btn-nook-primary w-100 fw-bold"
                disabled={loading || !query.trim()}
                onClick={() => search()}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2" />Looking up...</>
                  : <><i className="fa-solid fa-id-card me-2" />Load Profile</>
                }
              </button>
            </div>
          </div>
          {error && <div className="alert alert-danger dashboard-alert mt-3 mb-0"><i className="fa-solid fa-circle-exclamation me-2" />{error}</div>}
        </div>
      </section>

      {/* Profile Results */}
      {profile && (
        <>
          {/* Identity Header */}
          <section className="section-card mb-4">
            <div className="p-4">
              <div className="d-flex align-items-center gap-4 flex-wrap">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="rounded-circle border"
                    style={{ width: 72, height: 72, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    className="dashboard-avatar-fallback rounded-circle"
                    style={{ width: 72, height: 72, fontSize: "1.8rem" }}
                  >
                    {profile.user_name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                    <span className="fw-black fs-4 ac-font">{profile.user_name || "Unknown User"}</span>
                    <span className={`badge rounded-pill fw-bold ${stateClass(profile.trust_state)}`} style={{ border: `1px solid ${riskColor}`, background: `${riskColor}22` }}>
                      {profile.status_label || profile.trust_state}
                    </span>
                    {profile.risk_flags.length > 0 && (
                      <span className="badge rounded-pill bg-danger">
                        <i className="fa-solid fa-flag me-1" />{profile.risk_flags.length} flags
                      </span>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="font-monospace x-small text-muted">{profile.user_id}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-sub px-2 py-0 x-small rounded-pill"
                      onClick={copyId}
                      title="Copy Discord User ID"
                    >
                      <i className={`fa-solid ${copied ? "fa-check text-success" : "fa-copy"} me-1`} />
                      {copied ? "Copied!" : "Copy ID"}
                    </button>
                    <Link
                      to={`/dashboard/trust?user_id=${encodeURIComponent(profile.user_id)}`}
                      className="btn btn-sm btn-sub px-2 py-0 x-small rounded-pill"
                    >
                      <i className="fa-solid fa-shield-halved me-1" />Trust Profile
                    </Link>
                  </div>
                </div>
                {/* Risk Gauge */}
                <div className="text-center" style={{ minWidth: 90 }}>
                  <div
                    className="fw-black"
                    style={{ fontSize: "2.2rem", color: riskColor, lineHeight: 1 }}
                  >
                    {riskNum}
                  </div>
                  <div className="x-small text-muted fw-bold">Risk Score</div>
                  <div className="dashboard-progress mt-1" style={{ height: 6 }}>
                    <div style={{ width: `${Math.min(100, Math.max(4, riskNum))}%`, background: riskColor }} />
                  </div>
                </div>
              </div>

              {/* Risk Flags */}
              {profile.risk_flags.length > 0 && (
                <div className="mt-3 d-flex flex-wrap gap-2">
                  {profile.risk_flags.map((flag) => (
                    <span key={flag} className="badge rounded-pill bg-danger-subtle text-danger-emphasis border border-danger-subtle">
                      <i className="fa-solid fa-flag me-1" />{flag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="border-top">
              <div className="row g-0">
                {[
                  ["Visits", (profile.summary as Record<string, unknown>)?.total_visits ?? 0, "fa-plane", "text-nook-green"],
                  ["Warnings", (profile.summary as Record<string, unknown>)?.warnings ?? 0, "fa-triangle-exclamation", "dashboard-yellow"],
                  ["Kicks", (profile.summary as Record<string, unknown>)?.kicks ?? 0, "fa-person-walking-arrow-right", "dashboard-blue"],
                  ["Dodo Reveals", (profile.summary as Record<string, unknown>)?.dodo_reveals ?? 0, "fa-key", "dashboard-purple"],
                  ["Identity Events", (profile.summary as Record<string, unknown>)?.identity_events ?? profile.recent_identity_events?.length ?? 0, "fa-id-card", "text-muted"],
                ].map(([label, value, icon, color], i) => (
                  <div key={String(label)} className={`col text-center p-3 ${i > 0 ? "border-start" : ""}`}>
                    <div className={`fw-black fs-5 ${color}`}>{String(value)}</div>
                    <div className="x-small text-muted fw-bold"><i className={`fa-solid ${icon} me-1`} />{String(label)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            {(["overview", "visits", "actions", "timeline"] as const).map((tab) => (
              <button
                key={tab}
                className={`btn btn-sm rounded-pill fw-bold ${activeTab === tab ? "btn-nook-primary" : "btn-sub"}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "overview" && <><i className="fa-solid fa-id-badge me-1" />Overview</>}
                {tab === "visits" && <><i className="fa-solid fa-plane me-1" />Recent Visits</>}
                {tab === "actions" && <><i className="fa-solid fa-gavel me-1" />Actions</>}
                {tab === "timeline" && <><i className="fa-solid fa-timeline me-1" />Timeline</>}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="row g-4">
              <div className="col-12 col-lg-6">
                <section className="section-card h-100">
                  <div className="section-card-header"><span><i className="fa-solid fa-leaf me-2 text-success" />Known IGNs</span></div>
                  <div className="table-responsive">
                    <table className="db-table">
                      <thead><tr><th>IGN</th><th>Visits</th><th>Last Seen</th></tr></thead>
                      <tbody>
                        {profile.known_igns.length ? profile.known_igns.map((row, i) => (
                          <tr key={i}>
                            <td className="fw-bold">{String((row as Record<string, unknown>).ign || "-")}</td>
                            <td>{String((row as Record<string, unknown>).visit_count ?? "-")}</td>
                            <td className="small text-muted">
                              <span title={fmtDate((row as Record<string, unknown>).last_seen_at)} style={{ cursor: "help" }}>
                                {timeAgo(String((row as Record<string, unknown>).last_seen_at || ""))}
                              </span>
                            </td>
                          </tr>
                        )) : <tr><td colSpan={3} className="text-center py-4 text-muted fw-bold">No known IGNs.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              <div className="col-12 col-lg-6">
                <section className="section-card h-100">
                  <div className="section-card-header"><span><i className="fa-solid fa-key me-2 dashboard-purple" />Recent Dodo Reveals</span></div>
                  <div className="table-responsive">
                    <table className="db-table">
                      <thead><tr><th>Island</th><th>When</th></tr></thead>
                      <tbody>
                        {profile.recent_dodo_reveals?.length ? profile.recent_dodo_reveals.map((row, i) => (
                          <tr key={i}>
                            <td className="fw-bold">{String((row as Record<string, unknown>).island_name || "-")}</td>
                            <td className="small text-muted">
                              <span title={fmtDate((row as Record<string, unknown>).timestamp)} style={{ cursor: "help" }}>
                                {timeAgo(String((row as Record<string, unknown>).timestamp || ""))}
                              </span>
                            </td>
                          </tr>
                        )) : <tr><td colSpan={2} className="text-center py-4 text-muted fw-bold">No dodo reveals.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* Recent Visits Tab */}
          {activeTab === "visits" && (
            <section className="section-card">
              <div className="section-card-header"><span><i className="fa-solid fa-plane me-2 text-success" />Recent Visits</span></div>
              <div className="table-responsive">
                <table className="db-table">
                  <thead><tr><th>Island</th><th>IGN Used</th><th>When</th><th>Auth</th></tr></thead>
                  <tbody>
                    {profile.recent_visits?.length ? profile.recent_visits.map((row, i) => (
                      <tr key={i}>
                        <td className="fw-bold">{String((row as Record<string, unknown>).island_name || "-")}</td>
                        <td>{String((row as Record<string, unknown>).ign || "-")}</td>
                        <td className="small text-muted">
                          <span title={fmtDate((row as Record<string, unknown>).timestamp)} style={{ cursor: "help" }}>
                            {timeAgo(String((row as Record<string, unknown>).timestamp || ""))}
                          </span>
                        </td>
                        <td>
                          <span className={`badge rounded-pill ${(row as Record<string, unknown>).authorized ? "badge-auth" : "badge-unkn"}`}>
                            {(row as Record<string, unknown>).authorized ? "authorized" : "unknown"}
                          </span>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={4} className="text-center py-4 text-muted fw-bold">No recent visits.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Actions Tab */}
          {activeTab === "actions" && (
            <section className="section-card">
              <div className="section-card-header"><span><i className="fa-solid fa-gavel me-2 dashboard-yellow" />Mod Actions</span></div>
              <div className="table-responsive">
                <table className="db-table">
                  <thead><tr><th>Action</th><th>Reason</th><th>By</th><th>When</th></tr></thead>
                  <tbody>
                    {profile.recent_actions?.length ? profile.recent_actions.map((row, i) => {
                      const action = String((row as Record<string, unknown>).action_type || (row as Record<string, unknown>).type || "");
                      let badgeClass = "bg-secondary";
                      if (["WARN", "KICK"].includes(action.toUpperCase())) badgeClass = "bg-warning text-dark";
                      if (action.toUpperCase() === "BAN") badgeClass = "bg-danger";
                      if (action.toUpperCase() === "NOTE") badgeClass = "bg-info text-dark";
                      return (
                        <tr key={i}>
                          <td><span className={`badge rounded-pill ${badgeClass}`}>{action.toUpperCase() || "ACTION"}</span></td>
                          <td>{String((row as Record<string, unknown>).reason || (row as Record<string, unknown>).note || "-")}</td>
                          <td className="text-muted small">{String((row as Record<string, unknown>).moderator || (row as Record<string, unknown>).actor || "-")}</td>
                          <td className="small text-muted">
                            <span title={fmtDate((row as Record<string, unknown>).timestamp)} style={{ cursor: "help" }}>
                              {timeAgo(String((row as Record<string, unknown>).timestamp || ""))}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : <tr><td colSpan={4} className="text-center py-4 text-muted fw-bold">No mod actions recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <section className="section-card">
              <div className="section-card-header"><span><i className="fa-solid fa-timeline me-2 dashboard-purple" />Unified Event Timeline</span></div>
              <div className="p-4">
                {profile.timeline.length ? (
                  <div className="audit-timeline">
                    {profile.timeline.map((item, i) => (
                      <div key={i} className="audit-timeline-item">
                        <div className={`audit-timeline-dot badge-${item.severity === "critical" ? "danger" : item.severity === "warning" || item.severity === "attention" ? "warning" : "info"}`}>
                          <i className={`fa-solid ${timelineIcon(item.type)}`} />
                        </div>
                        <div className="audit-timeline-body">
                          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                            <span className="fw-bold">{item.title}</span>
                            <span className={`badge rounded-pill ${severityBadge(item.severity)}`}>{item.severity}</span>
                            <span className="badge rounded-pill bg-light text-muted border">{item.label || item.type}</span>
                          </div>
                          <div className="x-small text-muted">
                            <span title={fmtDate(item.timestamp)} style={{ cursor: "help" }}>{timeAgo(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty">No timeline events for this user.</div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPlayerLookup;
