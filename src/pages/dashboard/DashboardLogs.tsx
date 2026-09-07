import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import { dashboardApi, type DashboardLogs as LogsPayload } from "../../lib/dashboardApi";

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

const DashboardLogs = () => {
  const [type, setType] = useState("flights");
  const [data, setData] = useState<LogsPayload | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const perPage = 25;

  const load = useCallback(() => {
    setRefreshing(true);
    dashboardApi
      .logs(new URLSearchParams({ type, page: String(page), per_page: String(perPage) }).toString())
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, [type, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <div className="alert alert-danger fw-bold">{error}</div>;

  return (
    <section className="section-card">
      <div className="section-card-header flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <span><i className="fa-solid fa-clipboard-list me-2 text-success" />XLog Reports</span>
          {data && <span className="badge rounded-pill bg-light text-muted border">{data.total || data.entries.length} records</span>}
        </div>
        <div className="d-flex align-items-center gap-2">
          <select
            className="db-input dashboard-select py-1"
            value={type}
            onChange={(e) => {
              setData(null);
              setPage(1);
              setType(e.target.value);
            }}
          >
            <option value="flights">Flights</option>
            <option value="warnings">Warnings</option>
          </select>
          <button
            className="btn btn-sm btn-sub rounded-pill fw-bold"
            disabled={refreshing}
            onClick={load}
            title="Refresh logs"
          >
            <i className={`fa-solid fa-arrows-rotate me-1 ${refreshing ? "fa-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
      {!data ? (
        <div className="p-5 text-center"><div className="spinner-border text-success" /></div>
      ) : (
        <div className="table-responsive">
          <table className="db-table">
            <thead><tr><th>User</th><th>Detail</th><th>When</th></tr></thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-muted fw-bold">
                    No log entries found.
                  </td>
                </tr>
              ) : (
                data.entries.map((entry, idx) => {
                  const userName = String(entry.ign || entry.user_name || "Unknown");
                  const hasTrustLink = Boolean(entry.user_id);
                  const rawTime = String(entry.timestamp || "");
                  let badge = null;
                  if (entry.action_type || entry.type) {
                    const action = String(entry.action_type || entry.type).toUpperCase();
                    let badgeClass = "badge bg-secondary";
                    if (["WARN", "KICK"].includes(action)) badgeClass = "badge bg-warning text-dark";
                    if (["BAN"].includes(action)) badgeClass = "badge bg-danger";
                    if (["NOTE"].includes(action)) badgeClass = "badge bg-info text-dark";
                    if (["ADMIT"].includes(action)) badgeClass = "badge bg-success";
                    badge = <span className={`${badgeClass} me-2`}>{action}</span>;
                  }

                  return (
                    <tr key={idx}>
                      <td className="fw-bold">
                        {hasTrustLink ? (
                          <Link to={`/dashboard/trust?user_id=${entry.user_id}`} className="text-decoration-none">
                            {userName}
                          </Link>
                        ) : (
                          userName
                        )}
                      </td>
                      <td>
                        {badge}
                        {String(entry.destination || entry.reason || entry.event || "")}
                      </td>
                      <td className="text-muted small">
                        <span title={fmtDate(rawTime)} style={{ cursor: "help" }}>
                          {timeAgo(rawTime)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {data && <DashboardPagination page={data.page || page} perPage={data.per_page || perPage} totalItems={data.total || data.entries.length} onPageChange={setPage} />}
    </section>
  );
};

export default DashboardLogs;
