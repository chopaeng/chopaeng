import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.webp";
import { useAuth } from "../context/useAuth";
import { THEME_OPTIONS, getStoredTheme, setStoredTheme, type ThemeMode } from "../utils/theme";
import { openSuggestionModal } from "../utils/suggestionsApi";
import { KKSliderJukebox } from "./audio/KKSliderJukebox";
import { AnimaleseVoiceModal } from "./audio/AnimaleseVoiceModal";
import { OnlineCommunityModal } from "./community/OnlineCommunityModal";
import { openCommunityModal } from "../utils/communityPresenceApi";
import { NookPhoneDock } from "./NookPhoneDock";
import { playChimeClick } from "../utils/kkAudioSynthesizer";
import { useNotificationHistory } from "../hooks/useNotificationHistory";
import "./Navbar.css";

/* ───────────────────────── Static data (module scope: no useMemo needed) ───────────────────────── */

const DESKTOP_BREAKPOINT = 1200; // must match Bootstrap's `xl` used by d-xl-none / d-xl-flex

const THEME_SHORT_LABEL: Record<string, string> = {
    nook: "Nook", celeste: "Celeste", roost: "Roost", sakura: "Sakura", dal: "DAL", nooklink: "NookLink",
};

interface NavItem { name: string; path: string; icon: string; color?: string; desc?: string; mobileName?: string }

const PRIMARY_LINKS: NavItem[] = [
    { name: "Home", path: "/", icon: "fa-house" },
    { name: "Islands", path: "/islands", icon: "fa-map-location-dot" },
    { name: "Order Bot", path: "/order", icon: "fa-paper-plane" },
    { name: "Drop Bot", path: "/drop", icon: "fa-parachute-box" },
    { name: "Catalogue", path: "/catalog", icon: "fa-boxes-stacked" },
];

const EXPLORE_LINKS: NavItem[] = [
    { name: "Builder", path: "/command-builder", icon: "fa-cubes", color: "#06b6d4", desc: "Sandbox command builder" },
    { name: "Trip Planner", path: "/trip-planner", icon: "fa-route", color: "#10b981", desc: "Optimal island flight routes" },
    { name: "Find Items", path: "/find", icon: "fa-magnifying-glass", color: "#6366f1", desc: "Instant item search", mobileName: "Find" },
    { name: "Critters", path: "/critters", icon: "fa-fish-fins", color: "#0ea5e9", desc: "Availability calendar" },
    { name: "Events", path: "/events", icon: "fa-calendar-days", color: "#f59e0b", desc: "Seasons & holidays" },
    { name: "NPCs", path: "/npcs", icon: "fa-users", color: "#64748b", desc: "Special characters & birthdays" },
    { name: "Guides", path: "/guides", icon: "fa-book-open", color: "#8b5cf6", desc: "Tips & tutorials" },
];

// Mobile list is derived from the two lists above so they can never drift apart.
const MOBILE_LINKS: NavItem[] = [...PRIMARY_LINKS, ...EXPLORE_LINKS.map(l => ({ ...l, name: l.mobileName ?? l.name }))];

const USER_QUICK_LINKS: NavItem[] = [
    { name: "My Profile", path: "/profile", icon: "fa-user", color: "#16a34a" },
    { name: "Order Bot", path: "/order", icon: "fa-paper-plane", color: "#06b6d4" },
    { name: "Drop Bot", path: "/drop", icon: "fa-parachute-box", color: "#10b981" },
    { name: "Trip Planner", path: "/trip-planner", icon: "fa-route", color: "#10b981" },
    { name: "My Wishlist", path: "/wishlist", icon: "fa-heart", color: "#ef4444" },
    { name: "My Collection", path: "/my-collection", icon: "fa-clipboard-check", color: "#f59e0b" },
    { name: "Pocket Inventory", path: "/pockets", icon: "fa-box-archive", color: "#3b82f6" },
];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* ───────────────────────── Helpers ───────────────────────── */

/** Calls onOutside when a pointer goes down outside `ref`. Only listens while `active`. */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
    useEffect(() => {
        if (!active) return;
        const handler = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
        };
        document.addEventListener("pointerdown", handler);
        return () => document.removeEventListener("pointerdown", handler);
    }, [ref, active, onOutside]);
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const SHORTCUT_LABEL = isMac ? "⌘K" : "Ctrl K";

/* ───────────────────────── Component ───────────────────────── */

export const Navbar: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);
    const [showThemeDropdown, setShowThemeDropdown] = useState(false);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showExploreDropdown, setShowExploreDropdown] = useState(false);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    const themeRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);
    const exploreRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const exploreTriggerRef = useRef<HTMLButtonElement>(null);
    const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hamburgerRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const drawerCloseRef = useRef<HTMLButtonElement>(null);

    const { notifications, unreadCount, markAllRead, clearAll } = useNotificationHistory();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();
    const isStaff = !!(user?.is_admin || user?.is_mod);
    const roleLabel = user?.is_admin ? "Administrator" : user?.is_mod ? "Moderator" : "Member";

    const activeTheme = THEME_OPTIONS.find(o => o.id === currentTheme) ?? THEME_OPTIONS[0];

    /* ── Theme sync ── */
    useEffect(() => {
        const sync = () => setCurrentTheme(getStoredTheme());
        window.addEventListener("chopaeng_theme_updated", sync);
        return () => window.removeEventListener("chopaeng_theme_updated", sync);
    }, []);

    const applyTheme = (id: ThemeMode) => {
        playChimeClick();
        setStoredTheme(id);
        setCurrentTheme(id);
    };

    /* ── Scroll state ── */
    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 15);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* ── Notifications: mark as read when the panel CLOSES, so unread highlights are actually visible ── */
    const closeNotif = useCallback(() => {
        setShowNotifDropdown(false);
        markAllRead();
    }, [markAllRead]);

    const toggleNotif = () => {
        playChimeClick();
        if (showNotifDropdown) closeNotif();
        else setShowNotifDropdown(true);
    };

    /* ── Close everything on route change ── */
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setShowThemeDropdown(false);
        setShowUserDropdown(false);
        setShowExploreDropdown(false);
        setShowNotifDropdown(false);
    }, [pathname]);

    /* ── Click outside ── */
    const closeTheme = useCallback(() => setShowThemeDropdown(false), []);
    const closeUser = useCallback(() => setShowUserDropdown(false), []);
    const closeExplore = useCallback(() => setShowExploreDropdown(false), []);
    useOutsideClick(themeRef, showThemeDropdown, closeTheme);
    useOutsideClick(userRef, showUserDropdown, closeUser);
    useOutsideClick(exploreRef, showExploreDropdown, closeExplore);
    useOutsideClick(notifRef, showNotifDropdown, closeNotif);

    /* ── Drawer: scroll lock, inert when closed, focus management ── */
    useEffect(() => {
        const drawer = drawerRef.current as (HTMLElement & { inert: boolean }) | null;
        if (drawer) drawer.inert = !isMobileMenuOpen; // removes hidden focusable items from tab order + a11y tree
        document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
        if (isMobileMenuOpen) drawerCloseRef.current?.focus();
        return () => { document.body.style.overflow = ""; };
    }, [isMobileMenuOpen]);

    /* ── Escape closes whatever is open and restores focus ── */
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (showExploreDropdown) {
                setShowExploreDropdown(false);
                exploreTriggerRef.current?.focus();
            }
            setShowThemeDropdown(false);
            setShowUserDropdown(false);
            if (showNotifDropdown) closeNotif();
            if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
                hamburgerRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isMobileMenuOpen, showExploreDropdown, showNotifDropdown, closeNotif]);

    /* ── Keep Tab focus inside the open drawer (it's aria-modal) ── */
    const trapFocus = (e: React.KeyboardEvent) => {
        if (e.key !== "Tab" || !drawerRef.current) return;
        const items = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    /* ── Drop the drawer when the viewport grows past the hamburger breakpoint ── */
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= DESKTOP_BREAKPOINT) setIsMobileMenuOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    /* ── Explore hover-intent (pointer) + focus-out close (keyboard) ── */
    useEffect(() => () => { if (exploreTimeoutRef.current) clearTimeout(exploreTimeoutRef.current); }, []);
    const handleExploreEnter = () => {
        if (exploreTimeoutRef.current) clearTimeout(exploreTimeoutRef.current);
        setShowExploreDropdown(true);
    };
    const handleExploreLeave = () => {
        exploreTimeoutRef.current = setTimeout(() => setShowExploreDropdown(false), 200);
    };
    const handleExploreBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowExploreDropdown(false);
    };

    const isExploreActive = EXPLORE_LINKS.some(l => pathname === l.path || pathname.startsWith(l.path + "/"));

    /* ── Actions ── */
    const closeDrawer = () => setIsMobileMenuOpen(false);
    const navClick = () => { playChimeClick(); closeDrawer(); };

    const handleLogout = async () => {
        try {
            playChimeClick();
            await logout();
            setShowUserDropdown(false);
            closeDrawer();
            navigate("/");
        } catch (e) {
            console.error("Logout failed:", e);
        }
    };

    const openJukebox = () => { playChimeClick(); window.dispatchEvent(new CustomEvent("chopaeng_toggle_jukebox")); };
    const openSearch = () => { playChimeClick(); window.dispatchEvent(new CustomEvent("chopaeng_open_search")); };
    const openShortcuts = () => { playChimeClick(); window.dispatchEvent(new CustomEvent("chopaeng_open_shortcuts_modal")); };

    const userAvatarUrl = useMemo(() => {
        if (!user?.avatar) return null;
        if (user.avatar.startsWith("http")) return user.avatar;
        return `https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`;
    }, [user]);

    const Avatar: React.FC<{ size: number; font: string }> = ({ size, font }) =>
        userAvatarUrl ? (
            <img src={userAvatarUrl} alt="" className="rounded-circle" style={{ width: size, height: size, objectFit: "cover" }} />
        ) : (
            <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: size, height: size, fontSize: font }} aria-hidden="true">
                {user?.username.charAt(0).toUpperCase()}
            </div>
        );

    const shortcutHint = `Quick Search (${isMac ? "⌘K" : "Ctrl+K"} or /)`;

    return (
        <>
            <nav
                className={`navbar sticky-top py-2 chopaeng-navbar ${isScrolled || isMobileMenuOpen ? "scrolled" : ""}`}
                style={{ zIndex: 1050 }}
                aria-label="Main Navigation"
            >
                <div className="container-xl d-flex flex-nowrap align-items-center justify-content-between gap-2">
                    {/* Brand */}
                    <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0" onClick={navClick} aria-label="Chopaeng Home">
                        <div className="rounded-circle overflow-hidden bg-white p-1 d-flex align-items-center justify-content-center" style={{ width: 34, height: 34, border: "2px solid rgba(22, 163, 74, 0.15)" }}>
                            <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </div>
                        <div className="flex-column d-none d-sm-flex">
                            <span className="ac-font fw-black lh-1 chopaeng-brand-title">CHOPAENG</span>
                            <span className="fw-bold text-uppercase" style={{ letterSpacing: "0.06em", fontSize: "0.58rem", color: "var(--nb-highlight)" }}>
                                Treasure Islands
                            </span>
                        </div>
                    </Link>

                    {/* Tablet (md → xl): compact icon rail */}
                    <div className="d-none d-md-flex d-xl-none align-items-center chopaeng-nav-pill-container chopaeng-nav-compact">
                        {PRIMARY_LINKS.map(link => (
                            <NavLink
                                key={link.path}
                                to={link.path}
                                end={link.path === "/"}
                                className={({ isActive }) => `chopaeng-nav-item ${isActive ? "active" : ""}`}
                                onClick={playChimeClick}
                                title={link.name}
                                aria-label={link.name}
                            >
                                <i className={`fa-solid ${link.icon}`} style={{ fontSize: "0.8rem" }} aria-hidden="true" />
                            </NavLink>
                        ))}
                        {isStaff && (
                            <NavLink
                                to="/dashboard"
                                className={({ isActive }) => `chopaeng-nav-item chopaeng-nav-item--staff ${isActive ? "active" : ""}`}
                                onClick={playChimeClick}
                                title="Dashboard"
                                aria-label="Admin Dashboard"
                            >
                                <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.8rem" }} aria-hidden="true" />
                            </NavLink>
                        )}
                    </div>

                    {/* Desktop (xl+): pills + Explore disclosure */}
                    <div className="d-none d-xl-flex align-items-center chopaeng-nav-pill-container">
                        {PRIMARY_LINKS.map(link => (
                            <NavLink
                                key={link.path}
                                to={link.path}
                                end={link.path === "/"}
                                className={({ isActive }) => `chopaeng-nav-item ${isActive ? "active" : ""}`}
                                onClick={playChimeClick}
                            >
                                <i className={`fa-solid ${link.icon}`} style={{ fontSize: "0.72rem" }} aria-hidden="true" />
                                <span>{link.name}</span>
                            </NavLink>
                        ))}

                        {isStaff && (
                            <NavLink
                                to="/dashboard"
                                className={({ isActive }) => `chopaeng-nav-item chopaeng-nav-item--staff ${isActive ? "active" : ""}`}
                                onClick={playChimeClick}
                            >
                                <i className="fa-solid fa-shield-halved" style={{ fontSize: "0.72rem" }} aria-hidden="true" />
                                <span>Dashboard</span>
                            </NavLink>
                        )}

                        <div
                            className="position-relative"
                            ref={exploreRef}
                            onMouseEnter={handleExploreEnter}
                            onMouseLeave={handleExploreLeave}
                            onBlur={handleExploreBlur}
                        >
                            <button
                                ref={exploreTriggerRef}
                                type="button"
                                className={`chopaeng-explore-trigger ${showExploreDropdown ? "open" : ""} ${isExploreActive ? "has-active" : ""}`}
                                onClick={() => { playChimeClick(); setShowExploreDropdown(p => !p); }}
                                aria-expanded={showExploreDropdown}
                                aria-controls="chopaeng-explore-panel"
                            >
                                <i className="fa-solid fa-compass" style={{ fontSize: "0.72rem" }} aria-hidden="true" />
                                <span>Explore</span>
                                <i className="fa-solid fa-chevron-down chevron-icon" aria-hidden="true" />
                            </button>

                            <div id="chopaeng-explore-panel" className={`chopaeng-explore-dropdown ${showExploreDropdown ? "show" : ""}`}>
                                {EXPLORE_LINKS.map(link => (
                                    <NavLink
                                        key={link.path}
                                        to={link.path}
                                        className={({ isActive }) => `chopaeng-explore-link ${isActive ? "active-link" : ""}`}
                                        onClick={() => { playChimeClick(); setShowExploreDropdown(false); }}
                                    >
                                        <div className="explore-icon" style={{ backgroundColor: `${link.color}1f`, color: link.color }}>
                                            <i className={`fa-solid ${link.icon}`} aria-hidden="true" />
                                        </div>
                                        <div>
                                            <div className="fw-bold" style={{ fontSize: "0.84rem" }}>{link.name}</div>
                                            <div className="chopaeng-explore-desc">{link.desc}</div>
                                        </div>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right controls */}
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        {/* Notifications */}
                        <div className="position-relative" ref={notifRef}>
                            <button
                                type="button"
                                className="chopaeng-action-btn chopaeng-action-btn--round position-relative"
                                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                                aria-expanded={showNotifDropdown}
                                aria-controls="chopaeng-notif-panel"
                                onClick={toggleNotif}
                            >
                                <i className="fa-solid fa-bell" aria-hidden="true" />
                                {unreadCount > 0 && <span className="chopaeng-badge-dot" aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                            </button>

                            {showNotifDropdown && (
                                <div id="chopaeng-notif-panel" className="chopaeng-user-dropdown chopaeng-notif-dropdown" role="region" aria-label="Notification history">
                                    <div className="chopaeng-notif-head">
                                        <span className="chopaeng-dropdown-title">
                                            <i className="fa-solid fa-bell me-2" style={{ color: "#f59e0b" }} aria-hidden="true" />
                                            Notifications
                                        </span>
                                        {notifications.length > 0 && (
                                            <button type="button" className="chopaeng-link-btn" onClick={clearAll}>Clear all</button>
                                        )}
                                    </div>
                                    {notifications.length === 0 ? (
                                        <div className="chopaeng-notif-empty">
                                            <i className="fa-solid fa-bell-slash d-block fs-4 mb-2 opacity-50" aria-hidden="true" />
                                            No notifications yet
                                        </div>
                                    ) : (
                                        <ul className="chopaeng-notif-list">
                                            {notifications.map(n => (
                                                <li key={n.id} className={`chopaeng-notif-item ${!n.read ? "unread" : ""}`}>
                                                    <span className={`chopaeng-notif-dot ${n.type}`} aria-hidden="true" />
                                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                        <div className="chopaeng-dropdown-title text-truncate" style={{ fontSize: "0.8rem" }}>{n.title}</div>
                                                        <div className="chopaeng-dropdown-sub text-truncate">{n.body}</div>
                                                        <div className="chopaeng-dropdown-sub mt-1" style={{ fontSize: "0.65rem" }}>
                                                            {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Account */}
                        {user ? (
                            <div className="position-relative" ref={userRef}>
                                <button
                                    type="button"
                                    onClick={() => { playChimeClick(); setShowUserDropdown(p => !p); }}
                                    className="chopaeng-user-pill"
                                    aria-expanded={showUserDropdown}
                                    aria-haspopup="menu"
                                    aria-label={`Account menu for ${user.username}`}
                                >
                                    <Avatar size={28} font="0.72rem" />
                                    <i className="fa-solid fa-chevron-down chevron" aria-hidden="true" />
                                </button>

                                {showUserDropdown && (
                                    <div className="chopaeng-user-dropdown" role="menu">
                                        <div className="chopaeng-dropdown-head">
                                            <div className="chopaeng-dropdown-title text-truncate">{user.username}</div>
                                            <div className="chopaeng-dropdown-sub text-truncate">{roleLabel}</div>
                                        </div>

                                        {isStaff && (
                                            <>
                                                <Link to="/dashboard" role="menuitem" className="chopaeng-user-dropdown-item chopaeng-user-dropdown-item--staff" onClick={closeUser}>
                                                    <div className="dropdown-icon" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                                                        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                                                    </div>
                                                    <div className="flex-grow-1">
                                                        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>Dashboard</div>
                                                        <div style={{ fontSize: "0.65rem", color: "#f59e0b" }}>{user.is_admin ? "Admin Panel" : "Mod Panel"}</div>
                                                    </div>
                                                    <i className="fa-solid fa-chevron-right" style={{ fontSize: "0.55rem", color: "#f59e0b", opacity: 0.7 }} aria-hidden="true" />
                                                </Link>
                                                <div className="chopaeng-dropdown-divider" />
                                            </>
                                        )}

                                        {USER_QUICK_LINKS.map(link => (
                                            <Link key={link.path} to={link.path} role="menuitem" className="chopaeng-user-dropdown-item" onClick={closeUser}>
                                                <div className="dropdown-icon" style={{ backgroundColor: `${link.color}1f`, color: link.color }}>
                                                    <i className={`fa-solid ${link.icon}`} aria-hidden="true" />
                                                </div>
                                                <span>{link.name}</span>
                                            </Link>
                                        ))}

                                        <div className="chopaeng-dropdown-divider" />
                                        <button type="button" onClick={handleLogout} role="menuitem" className="chopaeng-user-dropdown-item danger">
                                            <div className="dropdown-icon" style={{ backgroundColor: "#ef44441f", color: "#ef4444" }}>
                                                <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                                            </div>
                                            <span>Logout</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={login}
                                className="btn btn-nook text-white rounded-pill fw-bold btn-sm d-none d-md-inline-flex align-items-center gap-2 px-3"
                                style={{ height: 36, fontSize: "0.82rem" }}
                            >
                                <i className="fa-brands fa-discord" style={{ fontSize: "0.95rem" }} aria-hidden="true" />
                                <span>Login</span>
                            </button>
                        )}

                        {/* Search */}
                        <button type="button" onClick={openSearch} className="chopaeng-action-btn" title={shortcutHint} aria-label="Open search">
                            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                            <span className="d-none d-xl-inline-block chopaeng-kbd">{SHORTCUT_LABEL}</span>
                        </button>

                        {/* Secondary toolbar (xl+). Below xl these live in the drawer. */}
                        <div className="chopaeng-toolbar d-none d-xl-inline-flex">
                            <button type="button" onClick={() => openCommunityModal("online")} className="chopaeng-toolbar-btn position-relative" title="Live Island Radar & Online Residents" aria-label="Open Live Island Radar & Online Residents">
                                <i className="fa-solid fa-satellite-dish text-success" aria-hidden="true" />
                                <span className="position-absolute top-0 end-0 rounded-circle bg-success" style={{ width: 7, height: 7, transform: "translate(20%, -20%)", boxShadow: "0 0 6px #22c55e" }} aria-hidden="true" />
                            </button>

                            <button type="button" onClick={openJukebox} className="chopaeng-toolbar-btn" title="K.K. Slider Jukebox" aria-label="Open K.K. Slider Jukebox">
                                <i className="fa-solid fa-guitar text-success" aria-hidden="true" />
                            </button>

                            <div className="position-relative" ref={themeRef}>
                                <button
                                    type="button"
                                    onClick={() => { playChimeClick(); setShowThemeDropdown(p => !p); }}
                                    className="chopaeng-toolbar-btn"
                                    title={`Theme: ${activeTheme.name}`}
                                    aria-label={`Change theme (current: ${activeTheme.name})`}
                                    aria-haspopup="menu"
                                    aria-expanded={showThemeDropdown}
                                >
                                    <i className={`fa-solid ${activeTheme.icon}`} style={{ color: activeTheme.badgeColor }} aria-hidden="true" />
                                </button>

                                {showThemeDropdown && (
                                    <div className="chopaeng-user-dropdown chopaeng-user-dropdown--wide" role="menu">
                                        <div className="chopaeng-dropdown-head" style={{ borderBottom: "none", paddingBottom: 4 }}>
                                            <div className="chopaeng-dropdown-sub text-uppercase fw-bold" style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}>Island Theme</div>
                                        </div>
                                        {THEME_OPTIONS.map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={currentTheme === opt.id}
                                                onClick={() => { applyTheme(opt.id); setShowThemeDropdown(false); }}
                                                className="chopaeng-user-dropdown-item"
                                            >
                                                <div className="dropdown-icon" style={{ backgroundColor: `${opt.badgeColor}26`, color: opt.badgeColor }}>
                                                    <i className={`fa-solid ${opt.icon}`} aria-hidden="true" />
                                                </div>
                                                <div className="flex-grow-1">
                                                    <div style={{ fontSize: "0.82rem" }}>{opt.name}</div>
                                                    <div className="chopaeng-dropdown-sub" style={{ fontSize: "0.65rem" }}>{opt.description}</div>
                                                </div>
                                                {currentTheme === opt.id && <i className="fa-solid fa-circle-check text-success" style={{ fontSize: "0.75rem" }} aria-hidden="true" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <a href="https://discord.gg/chopaeng" target="_blank" rel="noopener noreferrer" className="chopaeng-toolbar-btn" title="Join our Discord Community" aria-label="Discord Community (opens in a new tab)">
                                <i className="fa-brands fa-discord text-primary" aria-hidden="true" />
                            </a>

                            <button type="button" onClick={openShortcuts} className="chopaeng-toolbar-btn" title="Keyboard Shortcuts (?)" aria-label="Keyboard Shortcuts">
                                <i className="fa-solid fa-keyboard" aria-hidden="true" />
                            </button>
                        </div>

                        {/* Hamburger (below xl) */}
                        <button
                            ref={hamburgerRef}
                            type="button"
                            className={`chopaeng-hamburger d-xl-none ${isMobileMenuOpen ? "open" : ""}`}
                            onClick={() => { playChimeClick(); setIsMobileMenuOpen(o => !o); }}
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="chopaeng-mobile-drawer"
                            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                        >
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Drawer backdrop */}
            <div className={`chopaeng-mobile-overlay ${isMobileMenuOpen ? "open" : ""}`} onClick={closeDrawer} aria-hidden="true" />

            {/* Drawer — header/footer fixed, body scrolls */}
            <aside
                ref={drawerRef}
                id="chopaeng-mobile-drawer"
                className={`chopaeng-mobile-drawer ${isMobileMenuOpen ? "open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                onKeyDown={trapFocus}
            >
                <div className="chopaeng-drawer-header p-3 border-bottom d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                        <img src={logo} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                        <span className="ac-font fw-black chopaeng-brand-title" style={{ fontSize: "1rem" }}>CHOPAENG</span>
                    </div>
                    <div className="chopaeng-drawer-header-actions">
                        {/* Visible at every drawer width: the top-bar toolbar is hidden below xl, incl. tablets */}
                        <button type="button" onClick={openJukebox} className="chopaeng-action-btn chopaeng-action-btn--round" title="K.K. Slider Jukebox" aria-label="Open K.K. Slider Jukebox">
                            <i className="fa-solid fa-guitar text-success" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={openShortcuts} className="chopaeng-action-btn chopaeng-action-btn--round d-none d-md-inline-flex" title="Keyboard Shortcuts" aria-label="Keyboard Shortcuts">
                            <i className="fa-solid fa-keyboard" aria-hidden="true" />
                        </button>
                        <button ref={drawerCloseRef} type="button" className="btn-close" onClick={closeDrawer} aria-label="Close menu" style={{ fontSize: "0.7rem" }} />
                    </div>
                </div>

                <div className="chopaeng-drawer-body">
                    {/* User card */}
                    <div className="p-3 border-bottom">
                        {user ? (
                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                    <Avatar size={34} font="0.75rem" />
                                    <div style={{ minWidth: 0 }}>
                                        <strong className="chopaeng-drawer-name text-truncate">{user.username}</strong>
                                        <span className="chopaeng-drawer-role">{roleLabel}</span>
                                    </div>
                                </div>
                                <button type="button" onClick={handleLogout} className="btn btn-outline-danger rounded-pill fw-bold px-3 py-1 flex-shrink-0" style={{ fontSize: "0.72rem" }}>
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => { closeDrawer(); login(); }}
                                className="btn btn-nook text-white rounded-pill fw-bold btn-sm w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                            >
                                <i className="fa-brands fa-discord fs-6" aria-hidden="true" />
                                <span>Login with Discord</span>
                            </button>
                        )}
                    </div>

                    {user && (
                        <div className="px-3 pt-3">
                            <div className="mobile-quick-links">
                                {USER_QUICK_LINKS.slice(0, 3).map(link => (
                                    <Link key={link.path} to={link.path} className="mobile-quick-link" onClick={navClick}>
                                        <i className={`fa-solid ${link.icon}`} style={{ color: link.color, fontSize: "0.9rem" }} aria-hidden="true" />
                                        <span>{link.name.replace("My ", "")}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-3">
                        <button
                            type="button"
                            className="chopaeng-action-btn w-100 mb-3 justify-content-between px-3"
                            onClick={() => { closeDrawer(); openSearch(); }}
                        >
                            <span className="d-flex align-items-center gap-2 fw-bold small" style={{ color: "var(--nb-muted)" }}>
                                <i className="fa-solid fa-magnifying-glass text-success" aria-hidden="true" />
                                <span>Search pages, items, villagers…</span>
                            </span>
                            <span className="chopaeng-kbd">{SHORTCUT_LABEL}</span>
                        </button>

                        <div className="chopaeng-drawer-label">Navigation</div>
                        <div className="d-flex flex-column gap-1 mb-3">
                            {isStaff && (
                                <NavLink to="/dashboard" className={({ isActive }) => `mobile-nav-link mobile-nav-link--staff ${isActive ? "active" : ""}`} onClick={navClick}>
                                    <div className="mobile-nav-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                                        <i className="fa-solid fa-shield-halved" style={{ color: "#f59e0b" }} aria-hidden="true" />
                                    </div>
                                    <span>Dashboard</span>
                                    <span className="badge ms-auto rounded-pill fw-bold" style={{ fontSize: "0.58rem", background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                                        {user?.is_admin ? "Admin" : "Mod"}
                                    </span>
                                </NavLink>
                            )}
                            {MOBILE_LINKS.map(link => (
                                <NavLink key={link.path} to={link.path} end={link.path === "/"} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`} onClick={navClick}>
                                    <div className="mobile-nav-icon">
                                        <i className={`fa-solid ${link.icon} text-success`} aria-hidden="true" />
                                    </div>
                                    <span>{link.name}</span>
                                </NavLink>
                            ))}
                        </div>

                        <div className="chopaeng-drawer-label">Island Theme</div>
                        <div className="mobile-theme-grid">
                            {THEME_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    aria-pressed={currentTheme === opt.id}
                                    onClick={() => applyTheme(opt.id)}
                                    className={`mobile-theme-btn ${currentTheme === opt.id ? "active" : ""}`}
                                >
                                    <i className={`fa-solid ${opt.icon}`} style={{ color: currentTheme === opt.id ? "#fff" : opt.badgeColor, fontSize: "0.72rem" }} aria-hidden="true" />
                                    <span>{THEME_SHORT_LABEL[opt.id] ?? opt.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="chopaeng-drawer-footer p-3 border-top d-flex flex-column gap-2">
                    <button type="button" onClick={() => { closeDrawer(); openCommunityModal("online"); }} className="btn btn-sm btn-outline-success w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2" style={{ fontSize: "0.8rem" }}>
                        <i className="fa-solid fa-satellite-dish" aria-hidden="true" />
                        <span>Live Radar &amp; Who's Online</span>
                    </button>
                    <button type="button" onClick={() => { closeDrawer(); openSuggestionModal(); }} className="btn btn-sm btn-outline-warning w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2" style={{ fontSize: "0.8rem" }}>
                        <i className="fa-solid fa-lightbulb" aria-hidden="true" />
                        <span>Suggest Feature</span>
                    </button>
                    <a href="https://discord.gg/chopaeng" target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2 text-decoration-none" style={{ fontSize: "0.8rem" }}>
                        <i className="fa-brands fa-discord" aria-hidden="true" />
                        <span>Join Discord</span>
                    </a>
                </div>
            </aside>

            <KKSliderJukebox />
            <AnimaleseVoiceModal />
            <OnlineCommunityModal />
            <NookPhoneDock />
        </>
    );
};

export default Navbar;