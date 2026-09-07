import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import { dashboardApi, type WebsiteLoginEvents } from "../../lib/dashboardApi";

const accessOptions = [
  { value: "all", label: "All logins" },
  { value: "mod", label: "Mods" },
  { value: "admin", label: "Admins" },
  { value: "regular", label: "Regular users" },
];

const displayName = (entry: WebsiteLoginEvents["entries"][number]) =>
  entry.nickname || entry.username || entry.discord_name || entry.global_name || entry.account_name || "Unknown user";

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

const DashboardWebsiteLogins = () => {
  const [data, setData] = useState<WebsiteLoginEvents | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [access, setAccess] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const perPage = 25;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  const params = useMemo(() => {
    const search = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      access,
    });
    if (debouncedQuery.trim()) search.set("q", debouncedQuery.trim());
    if (dateFrom) search.set("from", dateFrom);
    if (dateTo) search.set("to", dateTo);
    return search.toString();
  }, [access, dateFrom, dateTo, page, debouncedQuery]);

  useEffect(() => {
    setError("");
    dashboardApi.websiteLogins(params).then(setData).catch((err) => setError(err.message));
  }, [params]);

  const resetPage = (fn: () => void) => {
    setPage(1);
    fn();
  };

  if (error) return <div className="alert alert-danger fw-bold">{error}</div>;

  return (
    <section className="section-card">
      <div className="section-card-header flex-wrap gap-2">
        <span><i className="fa-brands fa-discord me-2 text-primary" />Website Discord Logins</span>
        {data && (
          <div className="d-flex flex-wrap gap-2">
            <span className="badge rounded-pill badge-auth">{data.summary.total} total</span>
            <span className="badge rounded-pill dashboard-member-badge">{data.summary.mod_count} mod</span>
            <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle">{data.summary.admin_count} admin</span>
          </div>
        )}
      </div>

      <div className="p-3 border-bottom">
        <div className="row g-2 align-items-end">
          <div className="col-lg-4 col-md-6">
            <label className="db-label">Search</label>
            <input
              className="db-input"
              placeholder="Name, Discord ID, username, IP..."
              value={query}
              onChange={(event) => resetPage(() => setQuery(event.target.value))}
            />
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="db-label">Access</label>
            <select className="db-input" value={access} onChange={(event) => resetPage(() => setAccess(event.target.value))}>
              {accessOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="db-label">From</label>
            <input className="db-input" type="date" value={dateFrom} onChange={(event) => resetPage(() => setDateFrom(event.target.value))} />
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="db-label">To</label>
            <input className="db-input" type="date" value={dateTo} onChange={(event) => resetPage(() => setDateTo(event.target.value))} />
          </div>
          <div className="col-lg-2 col-md-12">
            <button
              type="button"
              className="btn btn-sm dashboard-sync-btn w-100"
              onClick={() => {
                setQuery("");
                setAccess("all");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              <i className="fa-solid fa-rotate-left me-1" />Reset
            </button>
          </div>
        </div>
      </div>

      {!data ? (
        <div className="p-5 text-center"><div className="spinner-border text-success" /></div>
      ) : (
        <div className="table-responsive">
          <table className="db-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Access</th>
                <th>IP</th>
                <th>Return URL</th>
                <th>Discord Log</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted fw-bold py-4">No website logins found.</td></tr>
              ) : data.entries.map((entry) => {
                const avatarSrc = entry.avatar?.startsWith("http")
                  ? entry.avatar
                  : entry.avatar
                  ? `https://cdn.discordapp.com/avatars/${entry.user_id}/${entry.avatar}.png?size=64`
                  : null;

                return (
                  <tr key={entry.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt=""
                            className="rounded-circle"
                            style={{ width: 32, height: 32, objectFit: "cover" }}
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        ) : (
                          <span className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
                            <i className="fa-brands fa-discord text-muted" />
                          </span>
                        )}
                        <div>
                          <Link to={`/dashboard/trust?user_id=${entry.user_id}`} className="fw-bold text-decoration-none">
                            {displayName(entry)}
                          </Link>
                          <div className="x-small text-muted font-monospace">{entry.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {entry.is_admin && <span className="badge rounded-pill bg-info-subtle text-info-emphasis border border-info-subtle">Admin</span>}
                        {entry.is_mod && <span className="badge rounded-pill dashboard-member-badge">Mod</span>}
                        {!entry.is_admin && !entry.is_mod && <span className="badge rounded-pill bg-light text-muted border">User</span>}
                        <span className="badge rounded-pill badge-auth">{entry.role_count} roles</span>
                      </div>
                    </td>
                    <td className="font-monospace small">{entry.ip_address || "-"}</td>
                    <td className="small text-truncate" style={{ maxWidth: 260 }} title={entry.return_to || ""}>{entry.return_to || "-"}</td>
                    <td>
                      {entry.discord_message_id && entry.discord_channel_id && entry.discord_guild_id ? (
                        <a
                          className="btn btn-sm dashboard-edit-btn"
                          href={`https://discord.com/channels/${entry.discord_guild_id}/${entry.discord_channel_id}/${entry.discord_message_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square me-1" />Open
                        </a>
                      ) : (
                        <span className="text-muted small">Not posted</span>
                      )}
                    </td>
                    <td className="text-muted small">
                      <span title={fmtDate(entry.created_at)} style={{ cursor: "help" }}>
                        {timeAgo(entry.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && <DashboardPagination page={data.page || page} perPage={data.per_page || perPage} totalItems={data.total || data.entries.length} onPageChange={setPage} />}
    </section>
  );
};

export default DashboardWebsiteLogins;
