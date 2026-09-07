import "../../assets/css/command-palette.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface PaletteItem {
  id: string;
  label: string;
  icon: string;
  to?: string;
  action?: () => void;
  keywords?: string;
  category: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: "home", label: "Overview", icon: "fa-house", to: "/dashboard", category: "Pages", keywords: "home overview dashboard" },
  { id: "islands", label: "Islands & Status", icon: "fa-location-dot", to: "/dashboard/islands", category: "Pages", keywords: "islands status fleet online offline toggle test sync" },
  { id: "incidents", label: "Incidents", icon: "fa-triangle-exclamation", to: "/dashboard/incidents", category: "Pages", keywords: "incidents warnings alerts" },
  { id: "analytics", label: "Analytics", icon: "fa-chart-line", to: "/dashboard/analytics", category: "Pages", keywords: "analytics charts stats metrics" },
  { id: "trust", label: "Trust Profile", icon: "fa-id-card", to: "/dashboard/trust", category: "Pages", keywords: "trust profile user risk" },
  { id: "logs", label: "XLog Reports", icon: "fa-clipboard-list", to: "/dashboard/logs", category: "Pages", keywords: "logs xlog warnings flights" },
  { id: "auth-log", label: "Website Logins", icon: "fa-user-check", to: "/dashboard/auth-log", category: "Pages", keywords: "logins auth discord website" },
  { id: "ops", label: "Ops", icon: "fa-server", to: "/dashboard/ops", category: "Pages", keywords: "ops server maintenance" },
  { id: "database", label: "Database", icon: "fa-database", to: "/dashboard/database", category: "Pages", keywords: "database migration" },
  { id: "bundles", label: "Pocket Bundles", icon: "fa-boxes-stacked", to: "/dashboard/bundles", category: "Pages", keywords: "bundles pocket items" },
  { id: "player", label: "Player Lookup", icon: "fa-magnifying-glass", to: "/dashboard/player", category: "Tools", keywords: "player lookup search user profile" },
  { id: "leaderboard", label: "Mod Leaderboard", icon: "fa-ranking-star", to: "/dashboard/leaderboard", category: "Tools", keywords: "leaderboard moderator stats ranking" },
  { id: "bulk", label: "Bulk Actions", icon: "fa-bolt", to: "/dashboard/bulk", category: "Tools", keywords: "bulk actions incidents queue apply" },
  { id: "audit", label: "Audit Log", icon: "fa-scroll", to: "/dashboard/audit", category: "Monitor", keywords: "audit log timeline actions history" },
  { id: "scheduled", label: "Scheduled Announcements", icon: "fa-bullhorn", to: "/dashboard/scheduled", category: "System", keywords: "scheduled announcements queue plan" },
  { id: "maintenance", label: "Maintenance Windows", icon: "fa-wrench", to: "/dashboard/maintenance", category: "System", keywords: "maintenance window downtime plan" },
  { id: "devices", label: "IP Device Fingerprints", icon: "fa-fingerprint", to: "/dashboard/devices", category: "Monitor", keywords: "devices ip fingerprint alt accounts" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

const CommandPalette = ({ open, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Recent pages stored in localStorage
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("db-palette-recent") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Show recents first, then all
      const recentItems = recent
        .map((id) => NAV_ITEMS.find((i) => i.id === id))
        .filter(Boolean) as PaletteItem[];
      const rest = NAV_ITEMS.filter((i) => !recent.includes(i.id));
      return [...recentItems, ...rest];
    }
    return NAV_ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.keywords || "").toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [query, recent]);

  const safeIdx = Math.max(0, Math.min(selectedIdx, filtered.length - 1));

  const execute = (item: PaletteItem) => {
    if (item.to) {
      navigate(item.to);
      // Update recents
      const next = [item.id, ...recent.filter((id) => id !== item.id)].slice(0, 5);
      localStorage.setItem("db-palette-recent", JSON.stringify(next));
      setRecent(next);
    }
    if (item.action) item.action();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && filtered[safeIdx]) { execute(filtered[safeIdx]); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered, safeIdx]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filtered]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div
      className="command-palette-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="command-palette-container">
        {/* Search */}
        <div className="command-palette-header">
          <i className="fa-solid fa-magnifying-glass text-muted" />
          <input
            id="command-palette-input"
            ref={inputRef}
            className="command-palette-input"
            placeholder="Search pages and tools…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            autoComplete="off"
          />
          <span
            style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", cursor: "pointer", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 4, padding: "0.15rem 0.4rem", fontFamily: "monospace" }}
            onClick={onClose}
          >
            ESC
          </span>
        </div>

        {/* Results */}
        <div className="command-palette-body">
          {filtered.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
              <i className="fa-solid fa-magnifying-glass me-2 opacity-50" />No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => {
              return (
                <div key={category}>
                  <div className="command-palette-section-title">{category}</div>
                  {items.map((item) => {
                    const idx = globalIdx++;
                    const isActive = idx === safeIdx;
                    return (
                      <div
                        key={item.id}
                        className={`command-palette-item ${isActive ? "active" : ""}`}
                        onClick={() => execute(item)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        role="button"
                        tabIndex={-1}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span className="command-palette-item-icon">
                            <i className={`fa-solid ${item.icon}`} />
                          </span>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                        </div>
                        {isActive && (
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                            <i className="fa-solid fa-turn-down fa-rotate-90" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <span><span className="command-palette-kbd">↑↓</span> navigate</span>
          <span><span className="command-palette-kbd">↵</span> select</span>
          <span><span className="command-palette-kbd">Esc</span> close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
