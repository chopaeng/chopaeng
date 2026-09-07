import { useState } from "react";

interface ScheduledItem {
  id: string;
  body: string;
  channel: string;
  scheduledFor: string;
  status: "pending" | "sent" | "cancelled";
  createdAt: string;
}

const STORAGE_KEY = "db-scheduled-announcements";

const loadItems = (): ScheduledItem[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveItems = (items: ScheduledItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const fmtDate = (value: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const isPast = (scheduledFor: string) => new Date(scheduledFor).getTime() < Date.now();

const DashboardScheduled = () => {
  const [items, setItems] = useState<ScheduledItem[]>(loadItems);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "cancelled">("all");

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const update = (next: ScheduledItem[]) => {
    saveItems(next);
    setItems(next);
  };

  const add = () => {
    if (!body.trim() || !channel.trim() || !scheduledFor) return;
    const newItem: ScheduledItem = {
      id: `ann-${Date.now()}`,
      body: body.trim(),
      channel: channel.trim(),
      scheduledFor,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    update([...items, newItem]);
    setBody("");
    setChannel("");
    setScheduledFor("");
    showNotice("Announcement scheduled.");
  };

  const markStatus = (id: string, status: ScheduledItem["status"]) => {
    update(items.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const remove = (id: string) => {
    update(items.filter((i) => i.id !== id));
  };

  const filtered = items.filter((i) => filter === "all" || i.status === filter);

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const pastPending = items.filter((i) => i.status === "pending" && isPast(i.scheduledFor)).length;

  return (
    <div className="container-fluid px-0">
      {notice && (
        <div className="alert alert-success dashboard-alert mb-3">
          <i className="fa-solid fa-check me-2" />{notice}
        </div>
      )}

      {pastPending > 0 && (
        <div className="alert alert-warning dashboard-alert mb-3">
          <i className="fa-solid fa-clock me-2" />
          <strong>{pastPending} pending announcement{pastPending > 1 ? "s" : ""}</strong> passed their scheduled time.
          Mark them as Sent or Cancelled when done.
        </div>
      )}

      {/* Note about local-only */}
      <div className="alert dashboard-alert mb-4" style={{ background: "rgba(99,102,241,0.09)", border: "1px solid rgba(99,102,241,0.25)", color: "var(--bs-body-color)" }}>
        <i className="fa-solid fa-circle-info me-2 text-primary" />
        <strong>Local Queue:</strong> Announcements are stored locally in your browser. No backend API is connected yet.
        This acts as a planning tool — mark items as Sent manually after posting.
      </div>

      {/* Summary */}
      <div className="row g-3 mb-4">
        {[
          ["Pending", pendingCount, "fa-hourglass-half", "dashboard-yellow"],
          ["Sent", items.filter((i) => i.status === "sent").length, "fa-circle-check", "text-nook-green"],
          ["Cancelled", items.filter((i) => i.status === "cancelled").length, "fa-circle-xmark", "text-muted"],
          ["Total", items.length, "fa-bullhorn", "dashboard-blue"],
        ].map(([label, value, icon, color]) => (
          <div className="col-6 col-lg-3" key={String(label)}>
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
          <span><i className="fa-solid fa-plus me-2 text-success" />New Announcement</span>
        </div>
        <div className="p-4">
          <div className="row g-3">
            <div className="col-12">
              <label className="db-label">Message Body</label>
              <textarea
                className="db-input"
                rows={4}
                placeholder="Type announcement message here…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="col-md-5">
              <label className="db-label">Target Channel / Location</label>
              <input
                className="db-input"
                placeholder="#announcements or Discord channel ID"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              />
            </div>
            <div className="col-md-5">
              <label className="db-label">Scheduled For</label>
              <input
                className="db-input"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button
                className="btn btn-nook-primary w-100 fw-bold"
                disabled={!body.trim() || !channel.trim() || !scheduledFor}
                onClick={add}
              >
                <i className="fa-solid fa-calendar-plus me-1" />Schedule
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="section-card">
        <div className="section-card-header flex-wrap gap-2">
          <span><i className="fa-solid fa-list-check me-2 dashboard-blue" />Announcement Queue</span>
          <div className="btn-group btn-group-sm">
            {(["all", "pending", "sent", "cancelled"] as const).map((f) => (
              <button
                key={f}
                className={`btn fw-bold ${filter === f ? "btn-dark text-white" : "btn-sub"}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {filtered.length === 0 ? (
            <div className="dashboard-empty">
              <i className="fa-solid fa-bullhorn fa-2x mb-2 opacity-25" />
              <div>No announcements in this view.</div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {[...filtered].reverse().map((item) => {
                const past = isPast(item.scheduledFor) && item.status === "pending";
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded"
                    style={{
                      border: `1px solid ${past ? "#f59e0b44" : "var(--db-border)"}`,
                      background: past ? "rgba(245,158,11,0.06)" : "var(--db-card-bg)",
                    }}
                  >
                    <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className={`badge rounded-pill fw-bold ${item.status === "pending" ? (past ? "bg-warning text-dark" : "bg-light text-muted border") : item.status === "sent" ? "badge-auth" : "bg-secondary text-white"}`}>
                          {past && item.status === "pending" ? "⚠ OVERDUE" : item.status.toUpperCase()}
                        </span>
                        <span className="small text-muted">
                          <i className="fa-solid fa-hashtag me-1" />{item.channel}
                        </span>
                        <span className="small text-muted">
                          <i className="fa-solid fa-clock me-1" />{fmtDate(item.scheduledFor)}
                        </span>
                      </div>
                      <div className="d-flex gap-2">
                        {item.status === "pending" && (
                          <>
                            <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={() => markStatus(item.id, "sent")}>
                              <i className="fa-solid fa-circle-check me-1 text-success" />Mark Sent
                            </button>
                            <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={() => markStatus(item.id, "cancelled")}>
                              <i className="fa-solid fa-xmark me-1 text-danger" />Cancel
                            </button>
                          </>
                        )}
                        <button className="btn btn-sm btn-sub rounded-pill fw-bold" onClick={() => remove(item.id)}>
                          <i className="fa-solid fa-trash-can text-danger" />
                        </button>
                      </div>
                    </div>
                    <div className="fw-bold" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.body}</div>
                    <div className="x-small text-muted mt-2">Created {fmtDate(item.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardScheduled;
