import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPagination from "../../components/dashboard/DashboardPagination";
import {
  dashboardApi,
  type DashboardAccessTestResult,
  type DashboardIsland,
  type DashboardIslandRoleStatus,
  type DashboardStatusSummary,
} from "../../lib/dashboardApi";

const statusClass = (status: string) => {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("online")) return "online";
  if (normalized.includes("sub")) return "sub-only";
  if (normalized.includes("refresh")) return "refreshing";
  return "offline";
};

const DashboardIslands = () => {
  const [islands, setIslands] = useState<DashboardIsland[]>([]);
  const [roleStatus, setRoleStatus] = useState<Record<string, DashboardIslandRoleStatus>>({});
  const [statusSummary, setStatusSummary] = useState<DashboardStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncingRoles, setSyncingRoles] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  // Access tester state
  const [showAccessTester, setShowAccessTester] = useState(true);
  const [testUserId, setTestUserId] = useState("");
  const [testRoles, setTestRoles] = useState("");
  const [testingAccess, setTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<DashboardAccessTestResult | null>(null);
  const [testError, setTestError] = useState("");
  const accessTesterRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [islandRows, rolePayload, summary] = await Promise.all([
        dashboardApi.islands(),
        dashboardApi.roleStatus().catch(() => ({ items: [] })),
        dashboardApi.statusSummary().catch(() => null),
      ]);

      const statusMap = summary
        ? new Map(summary.islands.map((i) => [i.id, i.status]))
        : new Map<string, string>();

      const merged = islandRows.map((island) => {
        const liveStatus = statusMap.get(island.id);
        return liveStatus ? { ...island, status: liveStatus } : island;
      });

      setIslands(merged);
      setRoleStatus(Object.fromEntries(rolePayload.items.map((item) => [item.id, item])));
      if (summary) setStatusSummary(summary);
      setLastRefreshed(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load island fleet data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Periodic status poll (every 20s) with visibility check
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const summary = await dashboardApi.statusSummary();
        setStatusSummary(summary);
        const statusMap = new Map(summary.islands.map((i) => [i.id, i.status]));
        setIslands((prev) =>
          prev.map((island) => {
            const live = statusMap.get(island.id);
            return live && live !== island.status ? { ...island, status: live } : island;
          }),
        );
        setLastRefreshed(new Date());
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("401")) {
          setError("Session expired. Please refresh.");
        }
      }
    };

    let timer = window.setInterval(pollStatus, 20000);
    const handleVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        pollStatus();
        timer = window.setInterval(pollStatus, 20000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const counts = useMemo(
    () => ({
      public: islands.filter((i) => i.cat === "public").length,
      member: islands.filter((i) => i.cat === "member").length,
      order: islands.filter((i) => i.cat === "order").length,
    }),
    [islands],
  );

  const filteredIslands = useMemo(() => {
    return islands.filter((island) => {
      if (warningsOnly) {
        const access = roleStatus[island.id];
        const hasWarning = (access?.warnings && access.warnings.length > 0) || (island.access_status?.warnings && island.access_status.warnings.length > 0);
        if (!hasWarning) return false;
      }
      if (statusFilter && island.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (catFilter && island.cat.toLowerCase() !== catFilter.toLowerCase()) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = island.name.toLowerCase().includes(q);
        const matchDisplay = (island.display_name || "").toLowerCase().includes(q);
        const matchType = (island.type || "").toLowerCase().includes(q);
        if (!matchName && !matchDisplay && !matchType) return false;
      }
      return true;
    });
  }, [islands, statusFilter, catFilter, search, warningsOnly, roleStatus]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, catFilter, warningsOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredIslands.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedIslands = useMemo(
    () => filteredIslands.slice((safePage - 1) * perPage, safePage * perPage),
    [filteredIslands, safePage],
  );

  const toggleVisibility = async (island: DashboardIsland) => {
    const nextVisible = island.is_visible === false;
    setTogglingId(island.id);
    setError("");
    try {
      await dashboardApi.updateIsland(island.id, { is_visible: nextVisible });
      setIslands((prev) =>
        prev.map((item) => (item.id === island.id ? { ...item, is_visible: nextVisible } : item)),
      );
      setNotice(`Updated visibility for ${island.display_name || island.name}: ${nextVisible ? "Visible" : "Hidden"}`);
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle visibility");
    } finally {
      setTogglingId(null);
    }
  };

  const syncMaps = async () => {
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const result = await dashboardApi.syncMaps();
      setNotice(
        `Synced ${result.synced} map(s), skipped ${result.skipped}${
          result.errors?.length ? `, ${result.errors.length} error(s)` : ""
        }.`,
      );
      if (result.synced > 0) load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Map sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncRoles = async () => {
    setSyncingRoles(true);
    setError("");
    setNotice("");
    try {
      const result = await dashboardApi.syncRoles();
      setNotice(
        `Synced ${result.synced} island role set(s), skipped ${result.skipped}${
          result.errors?.length ? `, ${result.errors.length} warning(s)` : ""
        }.`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role sync failed");
    } finally {
      setSyncingRoles(false);
    }
  };

  const runAccessTest = async () => {
    setTestingAccess(true);
    setTestError("");
    setTestResult(null);
    try {
      const roles = testRoles.split(/[,\s]+/).map((r) => r.trim()).filter(Boolean);
      const res = await dashboardApi.testAccess({ user_id: testUserId.trim() || undefined, roles });
      setTestResult(res);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Access test failed");
    } finally {
      setTestingAccess(false);
    }
  };

  const scrollToTester = () => {
    setShowAccessTester(true);
    setTimeout(() => {
      accessTesterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const onlineCount = statusSummary?.online_count ?? islands.filter((i) => i.status.toUpperCase() === "ONLINE").length;
  const refreshingCount = statusSummary?.refreshing_count ?? islands.filter((i) => i.status.toUpperCase() === "REFRESHING").length;
  const offlineCount = statusSummary?.offline_count ?? islands.filter((i) => i.status.toUpperCase() === "OFFLINE").length;
  const warningsCount = statusSummary?.access_problem_count ?? islands.filter((i) => (roleStatus[i.id]?.warnings?.length || 0) > 0).length;

  const statCards = [
    {
      key: "ONLINE",
      label: "Online",
      value: onlineCount,
      pct: statusSummary ? `${statusSummary.online_pct}%` : `${Math.round((onlineCount / (islands.length || 1)) * 100)}%`,
      icon: "fa-circle-check",
      color: "text-nook-green",
      active: statusFilter === "ONLINE" && !warningsOnly,
      onClick: () => {
        setWarningsOnly(false);
        setStatusFilter((curr) => (curr === "ONLINE" ? "" : "ONLINE"));
      },
    },
    {
      key: "REFRESHING",
      label: "Refreshing",
      value: refreshingCount,
      pct: statusSummary ? `${statusSummary.refreshing_pct}%` : `${Math.round((refreshingCount / (islands.length || 1)) * 100)}%`,
      icon: "fa-arrows-rotate",
      color: "dashboard-blue",
      active: statusFilter === "REFRESHING" && !warningsOnly,
      onClick: () => {
        setWarningsOnly(false);
        setStatusFilter((curr) => (curr === "REFRESHING" ? "" : "REFRESHING"));
      },
    },
    {
      key: "OFFLINE",
      label: "Offline",
      value: offlineCount,
      pct: statusSummary ? `${statusSummary.off_pct}%` : `${Math.round((offlineCount / (islands.length || 1)) * 100)}%`,
      icon: "fa-circle-xmark",
      color: "text-danger",
      active: statusFilter === "OFFLINE" && !warningsOnly,
      onClick: () => {
        setWarningsOnly(false);
        setStatusFilter((curr) => (curr === "OFFLINE" ? "" : "OFFLINE"));
      },
    },
    {
      key: "WARNINGS",
      label: "Access Warnings",
      value: warningsCount,
      pct: "role sync",
      icon: "fa-shield-halved",
      color: warningsCount > 0 ? "dashboard-yellow" : "text-nook-green",
      active: warningsOnly,
      onClick: () => {
        setStatusFilter("");
        setWarningsOnly((curr) => !curr);
      },
    },
  ];

  if (loading && islands.length === 0) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" />
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      {notice && <div className="alert alert-success dashboard-alert mb-3">{notice}</div>}
      {error && <div className="alert alert-danger dashboard-alert mb-3">{error}</div>}

      {/* Top Live Fleet Status Cards */}
      <div className="row g-3 mb-4">
        {statCards.map((card) => (
          <div className="col-6 col-md-3" key={card.key}>
            <div
              className={`stat-card h-100 position-relative cursor-pointer transition-all ${
                card.active ? "border-success shadow-sm" : ""
              }`}
              style={{ cursor: "pointer", border: card.active ? "2px solid #5cb85c" : undefined }}
              onClick={card.onClick}
              title={`Click to ${card.active ? "clear filter" : `filter by ${card.label}`}`}
            >
              <div className="d-flex align-items-center justify-content-between">
                <span className="stat-label mb-0">{card.label}</span>
                {card.active && (
                  <span className="badge bg-success rounded-pill x-small" style={{ fontSize: "0.65rem" }}>
                    Filtered
                  </span>
                )}
              </div>
              <div className="d-flex align-items-end justify-content-between mt-2">
                <div className={`stat-value ${card.color}`}>{card.value}</div>
                <span className="badge rounded-pill bg-light text-dark border">{card.pct}</span>
              </div>
              <i className={`fa-solid ${card.icon} dashboard-card-watermark`} />
            </div>
          </div>
        ))}
      </div>

      {/* Action Toolbar & Category Selector */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-black dashboard-table-count me-2">{islands.length} islands</span>
          <button
            className={`btn btn-sm rounded-pill fw-bold ${!catFilter ? "btn-dark text-white" : "btn-sub"}`}
            onClick={() => setCatFilter("")}
          >
            All
          </button>
          <button
            className={`btn btn-sm rounded-pill fw-bold ${catFilter === "public" ? "btn-dark text-white" : "btn-sub"}`}
            onClick={() => setCatFilter(catFilter === "public" ? "" : "public")}
          >
            {counts.public} Public
          </button>
          <button
            className={`btn btn-sm rounded-pill fw-bold ${catFilter === "member" ? "btn-dark text-white" : "btn-sub"}`}
            onClick={() => setCatFilter(catFilter === "member" ? "" : "member")}
          >
            {counts.member} Member
          </button>
          <button
            className={`btn btn-sm rounded-pill fw-bold ${catFilter === "order" ? "btn-dark text-white" : "btn-sub"}`}
            onClick={() => setCatFilter(catFilter === "order" ? "" : "order")}
          >
            {counts.order} Order
          </button>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          {lastRefreshed && (
            <span className="x-small text-muted fw-bold d-none d-lg-inline me-1">
              Updated {lastRefreshed.toLocaleTimeString()} (20s poll)
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm dashboard-sync-btn"
            disabled={syncingRoles}
            onClick={syncRoles}
            title="Sync role permissions from Discord / config"
          >
            {syncingRoles ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="fa-solid fa-shield-halved me-1" />}
            {syncingRoles ? "Syncing" : "Sync Roles"}
          </button>
          <button
            type="button"
            className="btn btn-sm dashboard-sync-btn"
            disabled={syncing}
            onClick={syncMaps}
            title="Sync island map layout data"
          >
            {syncing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="fa-solid fa-cloud-arrow-down me-1" />}
            {syncing ? "Syncing" : "Sync Maps"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-sub rounded-pill fw-bold"
            onClick={scrollToTester}
            title="Jump to user access permission tester"
          >
            <i className="fa-solid fa-user-shield me-1 text-success" />
            Test Access
          </button>
          <button
            type="button"
            className="btn btn-sm btn-sub rounded-pill fw-bold"
            onClick={load}
            title="Refresh fleet status now"
          >
            <i className="fa-solid fa-arrows-rotate me-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="dashboard-filter-strip mb-4">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: 400 }}>
          <div className="position-relative w-100">
            <input
              type="text"
              className="db-input pe-4"
              placeholder="Search by island name or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn btn-sm position-absolute end-0 top-50 translate-middle-y me-1 border-0 text-muted"
                onClick={() => setSearch("")}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center gap-1 flex-wrap">
          <span className="x-small text-muted fw-bold me-1">Status:</span>
          {["", "ONLINE", "REFRESHING", "OFFLINE"].map((st) => (
            <button
              key={st || "all"}
              className={`btn btn-sm rounded-pill fw-bold ${statusFilter === st && !warningsOnly ? "btn-dark text-white" : "btn-sub"}`}
              onClick={() => {
                setWarningsOnly(false);
                setStatusFilter(statusFilter === st ? "" : st);
              }}
            >
              {st || "ALL"}
            </button>
          ))}
          {warningsOnly && (
            <button
              className="btn btn-sm rounded-pill fw-bold btn-warning text-dark ms-1"
              onClick={() => setWarningsOnly(false)}
            >
              <i className="fa-solid fa-triangle-exclamation me-1" />
              Warnings Filtered ✕
            </button>
          )}
        </div>
      </div>

      {/* Island Fleet Table */}
      <section className="section-card mb-4">
        <div className="section-card-header flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span>
              <i className="fa-solid fa-location-dot me-2 text-success" />
              Island Fleet Overview
            </span>
            <span className="text-muted small fw-bold">
              ({filteredIslands.length} {filteredIslands.length === 1 ? "island" : "islands"} shown)
            </span>
          </div>
        </div>

        {filteredIslands.length === 0 ? (
          <div className="dashboard-empty py-5">
            <i className="fa-solid fa-location-dot d-block mb-2 fs-2 opacity-50" />
            No islands matched your current filters.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="db-table">
              <thead>
                <tr>
                  <th className="dashboard-map-col">Map</th>
                  <th>Name & Visibility</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Access Configuration</th>
                  <th>Status</th>
                  <th className="text-center">Visitors</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedIslands.map((island) => {
                  const access = roleStatus[island.id];
                  const warnings = access?.warnings || island.access_status?.warnings || [];
                  const roleCount = access?.role_count ?? island.required_roles?.length ?? 0;
                  const isVis = island.is_visible !== false;

                  return (
                    <tr key={island.id}>
                      <td>
                        {island.map_url ? (
                          <img
                            src={island.map_url}
                            alt={island.name}
                            loading="lazy"
                            className="dashboard-island-thumb"
                            style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px" }}
                          />
                        ) : (
                          <div className="dashboard-island-thumb-empty" style={{ width: "48px", height: "48px" }}>
                            <i className="fa-solid fa-umbrella-beach" />
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <Link
                            to={`/dashboard/islands/${island.id}`}
                            className="fw-bold text-decoration-none ac-font text-nook-green fs-6"
                          >
                            {island.display_name || island.name}
                          </Link>
                          {island.display_name && (
                            <span className="x-small text-muted fw-bold ms-2">({island.name})</span>
                          )}
                        </div>
                        <div className="mt-1 d-flex align-items-center gap-2">
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill px-2 py-0 x-small fw-bold border ${
                              !isVis ? "btn-light text-muted" : "btn-nook-primary"
                            }`}
                            disabled={togglingId === island.id}
                            onClick={() => toggleVisibility(island)}
                            title={!isVis ? "Click to show on website" : "Click to hide from website"}
                            style={{ fontSize: "0.68rem" }}
                          >
                            {togglingId === island.id ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                            ) : (
                              <i className={`fa-solid ${!isVis ? "fa-eye-slash" : "fa-eye"} me-1`} />
                            )}
                            {!isVis ? "Hidden on site" : "Shown on site"}
                          </button>
                        </div>
                      </td>
                      <td className="dashboard-muted-cell">{island.type || "-"}</td>
                      <td>
                        <span
                          className={`badge rounded-pill ${
                            island.cat === "member" ? "dashboard-member-badge" : "badge-auth"
                          }`}
                        >
                          {island.cat}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          <span
                            className={`badge rounded-pill ${
                              warnings.length
                                ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                : "badge-auth"
                            }`}
                          >
                            {roleCount} role{roleCount === 1 ? "" : "s"}
                          </span>
                          <span className="badge rounded-pill bg-light text-muted border">
                            {access?.access_source || island.access_source || "database"}
                          </span>
                        </div>
                        {warnings.length > 0 && (
                          <div className="x-small text-warning fw-bold mt-1">
                            <i className="fa-solid fa-triangle-exclamation me-1" />
                            {warnings.map((w) => w.replaceAll("_", " ")).join(", ")}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${statusClass(island.status)} dashboard-static-pill`}>
                          {island.status}
                        </span>
                      </td>
                      <td className="text-center dashboard-muted-cell">{island.visitors ?? "-"}</td>
                      <td className="text-end">
                        <Link className="btn btn-sm dashboard-edit-btn" to={`/dashboard/islands/${island.id}`}>
                          <i className="fa-solid fa-pen me-1" />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DashboardPagination
          page={safePage}
          perPage={perPage}
          totalItems={filteredIslands.length}
          onPageChange={setPage}
        />
      </section>

      {/* User Island Access Tester */}
      <section className="section-card" ref={accessTesterRef}>
        <div className="section-card-header flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span>
              <i className="fa-solid fa-user-shield me-2 text-success" />
              Test User Island Access
            </span>
            <span className="text-muted small fw-bold">Test permissions by Discord user ID or role IDs</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-sub rounded-pill fw-bold"
            onClick={() => setShowAccessTester((prev) => !prev)}
          >
            <i className={`fa-solid ${showAccessTester ? "fa-chevron-up" : "fa-chevron-down"} me-1`} />
            {showAccessTester ? "Collapse" : "Expand"}
          </button>
        </div>

        {showAccessTester && (
          <div className="p-4">
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="db-label">Discord User ID</label>
                <input
                  className="db-input"
                  value={testUserId}
                  onChange={(event) => setTestUserId(event.target.value)}
                  placeholder="e.g. 2382103810238102"
                />
              </div>
              <div className="col-md-5">
                <label className="db-label">Role IDs</label>
                <input
                  className="db-input"
                  value={testRoles}
                  onChange={(event) => setTestRoles(event.target.value)}
                  placeholder="comma or space separated role IDs"
                />
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-nook-primary w-100 fw-bold"
                  type="button"
                  disabled={testingAccess}
                  onClick={runAccessTest}
                >
                  {testingAccess ? <span className="spinner-border spinner-border-sm" /> : "Test Access"}
                </button>
              </div>
            </div>

            {testError && <div className="alert alert-danger dashboard-alert mt-3">{testError}</div>}

            {testResult && (
              <div className="mt-4 p-3 rounded border bg-light-subtle">
                <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                  <span className="badge rounded-pill badge-auth fs-6 px-3 py-1">
                    {testResult.accessible_count} accessible island{testResult.accessible_count === 1 ? "" : "s"}
                  </span>
                  {testResult.is_mod && (
                    <span className="badge rounded-pill bg-dark px-3 py-1">
                      <i className="fa-solid fa-crown me-1 text-warning" />
                      Mod/Admin bypass
                    </span>
                  )}
                  {testResult.roles?.map((role) => (
                    <span key={role.id} className="badge rounded-pill bg-light text-dark border">
                      {role.name}
                    </span>
                  ))}
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {testResult.items?.filter((item) => item.accessible).map((item) => (
                    <Link
                      key={item.id}
                      to={`/dashboard/islands/${item.id}`}
                      className="badge rounded-pill dashboard-member-badge px-3 py-2 text-decoration-none"
                    >
                      <i className="fa-solid fa-location-dot me-1" />
                      {item.name}
                    </Link>
                  ))}
                  {testResult.accessible_count === 0 && (
                    <span className="dashboard-empty py-2">No accessible member islands matched these credentials.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardIslands;
