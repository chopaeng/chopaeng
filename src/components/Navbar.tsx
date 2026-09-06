import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from '../assets/logo.webp';
import { useAuth } from "../context/useAuth";
import { THEME_OPTIONS, getStoredTheme, setStoredTheme, type ThemeMode } from "../utils/theme";
import { openSuggestionModal } from "../utils/suggestionsApi";
import { KKSliderJukebox } from "./audio/KKSliderJukebox";
import { AnimaleseVoiceModal } from "./audio/AnimaleseVoiceModal";
import { OnlineCommunityModal } from "./community/OnlineCommunityModal";
import { openCommunityModal } from "../utils/communityPresenceApi";
import { NookPhoneDock } from "./NookPhoneDock";
import { playChimeClick } from "../utils/kkAudioSynthesizer";

// Short, stable labels for the theme chips — derived from the theme id rather than
// splitting the display name (which broke for multi-word names like "The Roost Cozy").
const THEME_SHORT_LABEL: Record<string, string> = {
    nook: "Nook",
    celeste: "Celeste",
    roost: "Roost",
    sakura: "Sakura",
    dal: "DAL",
    nooklink: "NookLink",
};

export const Navbar: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getStoredTheme);
    const [showThemeDropdown, setShowThemeDropdown] = useState(false);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [showExploreDropdown, setShowExploreDropdown] = useState(false);

    const themeDropdownRef = useRef<HTMLDivElement>(null);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const exploreDropdownRef = useRef<HTMLDivElement>(null);
    const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hamburgerRef = useRef<HTMLButtonElement>(null);
    const drawerCloseRef = useRef<HTMLButtonElement>(null);

    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();

    useEffect(() => {
        const handleThemeUpdate = () => setCurrentTheme(getStoredTheme());
        window.addEventListener('chopaeng_theme_updated', handleThemeUpdate);
        return () => window.removeEventListener('chopaeng_theme_updated', handleThemeUpdate);
    }, []);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 15);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close mobile menu and dropdowns on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setShowThemeDropdown(false);
        setShowUserDropdown(false);
        setShowExploreDropdown(false);
    }, [pathname]);

    // Handle body scroll locking on mobile menu open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = "hidden";
            // Move focus into the drawer for keyboard/screen-reader users
            drawerCloseRef.current?.focus();
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isMobileMenuOpen]);

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
                setShowThemeDropdown(false);
            }
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setShowUserDropdown(false);
            }
            if (exploreDropdownRef.current && !exploreDropdownRef.current.contains(e.target as Node)) {
                setShowExploreDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Escape key closes any open dropdown or the mobile drawer
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setShowThemeDropdown(false);
            setShowUserDropdown(false);
            setShowExploreDropdown(false);
            if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
                hamburgerRef.current?.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isMobileMenuOpen]);

    // Safety net: if the viewport grows into desktop width, drop the mobile drawer
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 992 && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isMobileMenuOpen]);

    const handleLogout = async () => {
        try {
            playChimeClick();
            await logout();
            setShowUserDropdown(false);
            navigate("/");
        } catch (e) {
            console.error("Logout failed:", e);
        }
    };

    const openJukebox = () => {
        playChimeClick();
        window.dispatchEvent(new CustomEvent('chopaeng_toggle_jukebox'));
    };

    const openSearch = () => {
        playChimeClick();
        window.dispatchEvent(new CustomEvent('chopaeng_open_search'));
    };

    const userAvatarUrl = useMemo(() => {
        if (!user || !user.avatar) return null;
        if (user.avatar.startsWith("http")) return user.avatar;
        return `https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`;
    }, [user]);

    // Primary nav links — always visible in the pill
    const primaryLinks = useMemo(() => [
        { name: "Home", path: "/", icon: "fa-house" },
        { name: "Islands", path: "/islands", icon: "fa-map-location-dot" },
        { name: "Catalogue", path: "/catalog", icon: "fa-boxes-stacked" },
        { name: "Builder", path: "/command-builder", icon: "fa-cubes" },
    ], []);

    // "Explore" dropdown links — secondary features
    const exploreLinks = useMemo(() => [
        { name: "Trip Planner", path: "/trip-planner", icon: "fa-route", color: "#10b981", desc: "Optimal island flight routes" },
        { name: "Find Items", path: "/find", icon: "fa-magnifying-glass", color: "#6366f1", desc: "Instant item search" },
        { name: "Critters", path: "/critters", icon: "fa-fish-fins", color: "#0ea5e9", desc: "Availability calendar" },
        { name: "Events", path: "/events", icon: "fa-calendar-days", color: "#f59e0b", desc: "Seasons & holidays" },
        { name: "NPCs", path: "/npcs", icon: "fa-users", color: "#ec4899", desc: "Villager gallery" },
        { name: "Guides", path: "/guides", icon: "fa-book-open", color: "#8b5cf6", desc: "Tips & tutorials" },
    ], []);

    // User-only quick links for the dropdown
    const userQuickLinks = useMemo(() => [
        { name: "My Profile", path: "/profile", icon: "fa-user", color: "#16a34a" },
        { name: "Trip Planner", path: "/trip-planner", icon: "fa-route", color: "#10b981" },
        { name: "My Wishlist", path: "/wishlist", icon: "fa-heart", color: "#ef4444" },
        { name: "My Collection", path: "/my-collection", icon: "fa-clipboard-check", color: "#f59e0b" },
        { name: "Pocket Inventory", path: "/pockets", icon: "fa-box-archive", color: "#3b82f6" },
        { name: "Order Bot", path: "/order", icon: "fa-paper-plane", color: "#06b6d4" },
    ], []);

    // All links for mobile
    const allNavLinks = useMemo(() => [
        { name: "Home", path: "/", icon: "fa-house" },
        { name: "Islands", path: "/islands", icon: "fa-map-location-dot" },
        { name: "Trip Planner", path: "/trip-planner", icon: "fa-route" },
        { name: "Find", path: "/find", icon: "fa-magnifying-glass" },
        { name: "Catalogue", path: "/catalog", icon: "fa-boxes-stacked" },
        { name: "Critters", path: "/critters", icon: "fa-fish-fins" },
        { name: "Events", path: "/events", icon: "fa-calendar-days" },
        { name: "NPCs", path: "/npcs", icon: "fa-users" },
        { name: "Builder", path: "/command-builder", icon: "fa-cubes" },
        { name: "Guides", path: "/guides", icon: "fa-book-open" },
    ], []);

    // Is the current route one of the "Explore" dropdown routes?
    const isExploreActive = exploreLinks.some(l => pathname === l.path || pathname.startsWith(l.path + '/'));

    const handleExploreEnter = () => {
        if (exploreTimeoutRef.current) clearTimeout(exploreTimeoutRef.current);
        setShowExploreDropdown(true);
    };
    const handleExploreLeave = () => {
        exploreTimeoutRef.current = setTimeout(() => setShowExploreDropdown(false), 200);
    };

    return (
        <>
            <style>{`
                .chopaeng-navbar {
                    transition: background-color 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease, box-shadow 0.25s ease;
                }

                .chopaeng-navbar.scrolled {
                    background-color: var(--nav-scrolled-bg, rgba(255, 255, 255, 0.92));
                    border-bottom: 1px solid var(--card-border, rgba(0, 0, 0, 0.06));
                    backdrop-filter: blur(18px) saturate(180%);
                    -webkit-backdrop-filter: blur(18px) saturate(180%);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 24px rgba(0, 0, 0, 0.03);
                }

                .chopaeng-nav-pill-container {
                    background: var(--nav-pill-bg, rgba(255, 255, 255, 0.85));
                    border: 1px solid var(--card-border, rgba(0, 0, 0, 0.06));
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    padding: 3px;
                    border-radius: 50px;
                    gap: 1px;
                }

                /* Compact icon-only rail shown between mobile and full desktop widths (md → lg) */
                .chopaeng-nav-compact .chopaeng-nav-item {
                    padding: 8px 12px;
                }

                .chopaeng-nav-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 14px;
                    border-radius: 50px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-muted, #64748b);
                    text-decoration: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                    position: relative;
                }

                .chopaeng-nav-item:hover {
                    color: var(--text-dark, #1e293b);
                    background-color: rgba(0, 0, 0, 0.04);
                }

                .chopaeng-nav-item.active {
                    color: #ffffff !important;
                    background: linear-gradient(135deg, #16a34a, #15803d);
                    box-shadow: 0 2px 8px rgba(22, 163, 74, 0.25);
                }

                .chopaeng-nav-item.active i {
                    color: #ffffff !important;
                }

                /* Explore "More" trigger */
                .chopaeng-explore-trigger {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 7px 12px;
                    border-radius: 50px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-muted, #64748b);
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                    border: none;
                    background: transparent;
                }

                .chopaeng-explore-trigger:hover,
                .chopaeng-explore-trigger.open {
                    color: var(--text-dark, #1e293b);
                    background-color: rgba(0, 0, 0, 0.04);
                }

                .chopaeng-explore-trigger.has-active {
                    color: #16a34a;
                }

                .chopaeng-explore-trigger .chevron-icon {
                    font-size: 0.6rem;
                    transition: transform 0.2s ease;
                }

                .chopaeng-explore-trigger.open .chevron-icon {
                    transform: rotate(180deg);
                }

                /* Explore mega dropdown */
                .chopaeng-explore-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    margin-top: 10px;
                    width: 340px;
                    max-width: calc(100vw - 32px);
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border, rgba(0,0,0,0.08));
                    border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04);
                    padding: 6px;
                    z-index: 1060;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateX(-50%) translateY(4px);
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .chopaeng-explore-dropdown.show {
                    opacity: 1;
                    visibility: visible;
                    transform: translateX(-50%) translateY(0);
                }

                .chopaeng-explore-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: var(--text-dark, #1e293b);
                    transition: all 0.15s ease;
                }

                .chopaeng-explore-link:hover {
                    background: var(--bg-cream, #f8faf6);
                    transform: translateX(2px);
                }

                .chopaeng-explore-link.active-link {
                    background: rgba(22, 163, 74, 0.08);
                }

                .chopaeng-explore-link .explore-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }

                /* Standalone action button (search) */
                .chopaeng-action-btn {
                    width: 36px;
                    height: 36px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border, rgba(0, 0, 0, 0.07));
                    color: var(--text-dark, #334155);
                    transition: all 0.18s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }

                .chopaeng-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
                    color: var(--nook-green, #16a34a);
                    border-color: rgba(22, 163, 74, 0.2);
                }

                /* Grouped secondary-actions toolbar (jukebox / theme / discord) — one pill,
                   one shadow, instead of three separate floating circles */
                .chopaeng-toolbar {
                    background: var(--nav-pill-bg, rgba(255, 255, 255, 0.85));
                    border: 1px solid var(--card-border, rgba(0, 0, 0, 0.06));
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
                    border-radius: 50px;
                    padding: 3px;
                    display: inline-flex;
                    align-items: center;
                    gap: 1px;
                }

                .chopaeng-toolbar-btn {
                    width: 30px;
                    height: 30px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    border: none;
                    background: transparent;
                    color: var(--text-muted, #64748b);
                    font-size: 0.82rem;
                    transition: all 0.16s ease;
                    text-decoration: none;
                }

                .chopaeng-toolbar-btn:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--nook-green, #16a34a);
                }

                /* Mobile Flyout Navigation */
                .chopaeng-mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(6px);
                    z-index: 1040;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.25s ease, visibility 0.25s ease;
                }

                .chopaeng-mobile-overlay.open {
                    opacity: 1;
                    visibility: visible;
                }

                .chopaeng-mobile-drawer {
                    position: fixed;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 88%;
                    max-width: 380px;
                    background: var(--card-bg, #ffffff);
                    box-shadow: -10px 0 40px rgba(0, 0, 0, 0.12);
                    z-index: 1045;
                    transform: translateX(100%);
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .chopaeng-mobile-drawer.open {
                    transform: translateX(0);
                }

                .chopaeng-drawer-header {
                    flex-shrink: 0;
                }

                .chopaeng-drawer-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .chopaeng-drawer-body {
                    flex: 1 1 auto;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    min-height: 0;
                }

                .chopaeng-drawer-footer {
                    flex-shrink: 0;
                    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
                }

                .mobile-nav-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: var(--text-dark, #1e293b);
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.15s ease;
                }

                .mobile-nav-link:hover {
                    background: rgba(0, 0, 0, 0.03);
                }

                .mobile-nav-link.active {
                    background: linear-gradient(135deg, #16a34a, #15803d);
                    color: #ffffff !important;
                }

                .mobile-nav-link.active i {
                    color: #ffffff !important;
                }

                .mobile-nav-link .mobile-nav-icon {
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: var(--bg-cream, #f1f5f0);
                    font-size: 0.85rem;
                    flex-shrink: 0;
                }

                .mobile-nav-link.active .mobile-nav-icon {
                    background: rgba(255, 255, 255, 0.2);
                }

                /* Hamburger Button */
                .chopaeng-hamburger {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border, rgba(0, 0, 0, 0.08));
                    border-radius: 50%;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }

                .chopaeng-hamburger span {
                    display: block;
                    width: 16px;
                    height: 2px;
                    background: var(--text-dark, #334155);
                    border-radius: 2px;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .chopaeng-hamburger.open span:nth-child(1) {
                    transform: translateY(7px) rotate(45deg);
                }

                .chopaeng-hamburger.open span:nth-child(2) {
                    opacity: 0;
                    transform: translateX(-10px);
                }

                .chopaeng-hamburger.open span:nth-child(3) {
                    transform: translateY(-7px) rotate(-45deg);
                }

                /* User pill button */
                .chopaeng-user-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 10px 3px 3px;
                    border-radius: 50px;
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border, rgba(0, 0, 0, 0.07));
                    cursor: pointer;
                    transition: all 0.18s ease;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
                    height: 36px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-dark, #1e293b);
                }

                .chopaeng-user-pill:hover {
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
                    border-color: rgba(22, 163, 74, 0.2);
                }

                /* User dropdown menu */
                .chopaeng-user-dropdown {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    margin-top: 8px;
                    width: 240px;
                    max-width: calc(100vw - 32px);
                    background: var(--card-bg, #ffffff);
                    border: 1px solid var(--card-border, rgba(0,0,0,0.08));
                    border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04);
                    padding: 6px;
                    z-index: 1060;
                    animation: dropdownSlideUp 0.18s ease;
                }

                .chopaeng-user-dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 12px;
                    border-radius: 10px;
                    text-decoration: none;
                    color: var(--text-dark, #1e293b);
                    font-weight: 600;
                    font-size: 0.84rem;
                    transition: all 0.12s ease;
                    border: none;
                    background: none;
                    width: 100%;
                    text-align: left;
                    cursor: pointer;
                }

                .chopaeng-user-dropdown-item:hover {
                    background: var(--bg-cream, #f8faf6);
                }

                .chopaeng-user-dropdown-item.danger {
                    color: #ef4444;
                }

                .chopaeng-user-dropdown-item .dropdown-icon {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    flex-shrink: 0;
                }

                @keyframes dropdownSlideUp {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Mobile user quick links grid */
                .mobile-quick-links {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                }

                .mobile-quick-link {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    padding: 12px 6px;
                    border-radius: 12px;
                    text-decoration: none;
                    color: var(--text-dark, #1e293b);
                    font-weight: 600;
                    font-size: 0.7rem;
                    background: var(--bg-cream, #f8faf6);
                    border: 1px solid var(--card-border, rgba(0,0,0,0.05));
                    transition: all 0.15s ease;
                }

                .mobile-quick-link:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }

                /* Visible keyboard focus for every interactive nav element */
                .chopaeng-nav-item:focus-visible,
                .chopaeng-explore-trigger:focus-visible,
                .chopaeng-explore-link:focus-visible,
                .chopaeng-action-btn:focus-visible,
                .chopaeng-toolbar-btn:focus-visible,
                .chopaeng-user-pill:focus-visible,
                .chopaeng-hamburger:focus-visible,
                .chopaeng-user-dropdown-item:focus-visible,
                .mobile-nav-link:focus-visible,
                .mobile-quick-link:focus-visible {
                    outline: 2px solid #16a34a;
                    outline-offset: 2px;
                }

                @media (prefers-reduced-motion: reduce) {
                    .chopaeng-navbar,
                    .chopaeng-nav-item,
                    .chopaeng-explore-trigger,
                    .chopaeng-explore-trigger .chevron-icon,
                    .chopaeng-explore-dropdown,
                    .chopaeng-explore-link,
                    .chopaeng-mobile-overlay,
                    .chopaeng-mobile-drawer,
                    .chopaeng-hamburger span,
                    .chopaeng-user-dropdown,
                    .chopaeng-user-dropdown-item,
                    .mobile-nav-link,
                    .chopaeng-action-btn,
                    .chopaeng-toolbar-btn,
                    .chopaeng-user-pill,
                    .mobile-quick-link {
                        transition: none !important;
                        animation: none !important;
                    }
                }

                /* ═══════════════════════════════════════════════════════════
                   CELESTE THEME OVERRIDES (Navbar.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="celeste"] .chopaeng-navbar.scrolled {
                    background-color: rgba(11, 15, 25, 0.95);
                    border-bottom-color: rgba(167, 139, 250, 0.25);
                }
                [data-theme="celeste"] .chopaeng-nav-pill-container,
                [data-theme="celeste"] .chopaeng-toolbar {
                    background: rgba(30, 41, 59, 0.88);
                    border-color: rgba(167, 139, 250, 0.3);
                }
                [data-theme="celeste"] .chopaeng-nav-item {
                    color: #cbd5e1;
                }
                [data-theme="celeste"] .chopaeng-nav-item:hover {
                    color: #f8fafc;
                    background-color: rgba(167, 139, 250, 0.18);
                }
                [data-theme="celeste"] .chopaeng-nav-item.active {
                    background: #7c3aed;
                    color: #ffffff !important;
                    box-shadow: 0 2px 10px rgba(124, 58, 237, 0.45);
                }
                [data-theme="celeste"] .chopaeng-explore-trigger {
                    color: #cbd5e1;
                }
                [data-theme="celeste"] .chopaeng-explore-trigger:hover,
                [data-theme="celeste"] .chopaeng-explore-trigger.open {
                    color: #f8fafc;
                    background-color: rgba(167, 139, 250, 0.18);
                }
                [data-theme="celeste"] .chopaeng-explore-trigger.has-active {
                    color: #a78bfa;
                }
                [data-theme="celeste"] .chopaeng-explore-dropdown,
                [data-theme="celeste"] .chopaeng-user-dropdown {
                    background: #1e293b;
                    border-color: rgba(167, 139, 250, 0.3);
                }
                [data-theme="celeste"] .chopaeng-explore-link,
                [data-theme="celeste"] .chopaeng-user-dropdown-item {
                    color: #f8fafc;
                }
                [data-theme="celeste"] .chopaeng-explore-link:hover,
                [data-theme="celeste"] .chopaeng-user-dropdown-item:hover {
                    background: #2b3658;
                    color: #fcd34d;
                }
                [data-theme="celeste"] .chopaeng-action-btn,
                [data-theme="celeste"] .chopaeng-hamburger,
                [data-theme="celeste"] .chopaeng-user-pill {
                    background: #1e293b;
                    border-color: rgba(167, 139, 250, 0.3);
                    color: #f8fafc;
                }
                [data-theme="celeste"] .chopaeng-action-btn:hover,
                [data-theme="celeste"] .chopaeng-user-pill:hover {
                    background: #2b3658;
                    color: #fcd34d;
                    border-color: #a78bfa;
                }
                [data-theme="celeste"] .chopaeng-toolbar-btn {
                    color: #cbd5e1;
                }
                [data-theme="celeste"] .chopaeng-toolbar-btn:hover {
                    background: rgba(167, 139, 250, 0.18);
                    color: #fcd34d;
                }
                [data-theme="celeste"] .chopaeng-hamburger span {
                    background: #f8fafc;
                }
                [data-theme="celeste"] .chopaeng-mobile-drawer {
                    background: #1e293b;
                    color: #f8fafc;
                }
                [data-theme="celeste"] .chopaeng-drawer-header,
                [data-theme="celeste"] .chopaeng-drawer-footer {
                    background: #0f172a !important;
                    border-color: rgba(167, 139, 250, 0.25) !important;
                }
                [data-theme="celeste"] .mobile-nav-link {
                    color: #f8fafc;
                }
                [data-theme="celeste"] .mobile-nav-link:hover {
                    background: rgba(167, 139, 250, 0.18);
                    color: #fcd34d;
                }
                [data-theme="celeste"] .mobile-nav-link.active {
                    background: #7c3aed;
                    color: #ffffff !important;
                }
                [data-theme="celeste"] .mobile-nav-link .mobile-nav-icon {
                    background: #0f172a;
                }
                [data-theme="celeste"] .mobile-quick-link {
                    color: #f8fafc;
                    background: #0f172a;
                    border-color: rgba(167, 139, 250, 0.25);
                }
                [data-theme="celeste"] .mobile-quick-link:hover {
                    background: #2b3658;
                    color: #fcd34d;
                }

                /* ═══════════════════════════════════════════════════════════
                   ROOST THEME OVERRIDES (Navbar.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="roost"] .chopaeng-navbar.scrolled {
                    background-color: rgba(20, 18, 16, 0.95);
                    border-bottom-color: rgba(217, 119, 6, 0.25);
                }
                [data-theme="roost"] .chopaeng-nav-pill-container,
                [data-theme="roost"] .chopaeng-toolbar {
                    background: rgba(41, 37, 36, 0.88);
                    border-color: rgba(217, 119, 6, 0.3);
                }
                [data-theme="roost"] .chopaeng-nav-item {
                    color: #d1beaf;
                }
                [data-theme="roost"] .chopaeng-nav-item:hover {
                    color: #fafaf9;
                    background-color: rgba(217, 119, 6, 0.18);
                }
                [data-theme="roost"] .chopaeng-nav-item.active {
                    background: #a06b43;
                    color: #ffffff !important;
                    box-shadow: 0 2px 10px rgba(160, 107, 67, 0.45);
                }
                [data-theme="roost"] .chopaeng-explore-trigger {
                    color: #d1beaf;
                }
                [data-theme="roost"] .chopaeng-explore-trigger:hover,
                [data-theme="roost"] .chopaeng-explore-trigger.open {
                    color: #fafaf9;
                    background-color: rgba(217, 119, 6, 0.18);
                }
                [data-theme="roost"] .chopaeng-explore-trigger.has-active {
                    color: #f59e0b;
                }
                [data-theme="roost"] .chopaeng-explore-dropdown,
                [data-theme="roost"] .chopaeng-user-dropdown {
                    background: #292524;
                    border-color: rgba(217, 119, 6, 0.3);
                }
                [data-theme="roost"] .chopaeng-explore-link,
                [data-theme="roost"] .chopaeng-user-dropdown-item {
                    color: #fafaf9;
                }
                [data-theme="roost"] .chopaeng-explore-link:hover,
                [data-theme="roost"] .chopaeng-user-dropdown-item:hover {
                    background: #40362f;
                    color: #e6be94;
                }
                [data-theme="roost"] .chopaeng-action-btn,
                [data-theme="roost"] .chopaeng-hamburger,
                [data-theme="roost"] .chopaeng-user-pill {
                    background: #292524;
                    border-color: rgba(217, 119, 6, 0.3);
                    color: #fafaf9;
                }
                [data-theme="roost"] .chopaeng-action-btn:hover,
                [data-theme="roost"] .chopaeng-user-pill:hover {
                    background: #40362f;
                    color: #e6be94;
                    border-color: #f59e0b;
                }
                [data-theme="roost"] .chopaeng-toolbar-btn {
                    color: #d1beaf;
                }
                [data-theme="roost"] .chopaeng-toolbar-btn:hover {
                    background: rgba(217, 119, 6, 0.18);
                    color: #e6be94;
                }
                [data-theme="roost"] .chopaeng-hamburger span {
                    background: #fafaf9;
                }
                [data-theme="roost"] .chopaeng-mobile-drawer {
                    background: #292524;
                    color: #fafaf9;
                }
                [data-theme="roost"] .chopaeng-drawer-header,
                [data-theme="roost"] .chopaeng-drawer-footer {
                    background: #1c1917 !important;
                    border-color: rgba(217, 119, 6, 0.25) !important;
                }
                [data-theme="roost"] .mobile-nav-link {
                    color: #fafaf9;
                }
                [data-theme="roost"] .mobile-nav-link:hover {
                    background: rgba(217, 119, 6, 0.18);
                    color: #e6be94;
                }
                [data-theme="roost"] .mobile-nav-link.active {
                    background: #a06b43;
                    color: #ffffff !important;
                }
                [data-theme="roost"] .mobile-nav-link .mobile-nav-icon {
                    background: #1c1917;
                }
                [data-theme="roost"] .mobile-quick-link {
                    color: #fafaf9;
                    background: #1c1917;
                    border-color: rgba(217, 119, 6, 0.25);
                }
                [data-theme="roost"] .mobile-quick-link:hover {
                    background: #40362f;
                    color: #e6be94;
                }

                /* ═══════════════════════════════════════════════════════════
                   SAKURA, DAL, AND NOOKLINK THEME OVERRIDES (Navbar.tsx)
                   ═══════════════════════════════════════════════════════════ */
                [data-theme="sakura"] .chopaeng-navbar.scrolled {
                    background-color: rgba(253, 242, 248, 0.95);
                    border-bottom-color: rgba(236, 72, 153, 0.25);
                }
                [data-theme="sakura"] .chopaeng-nav-pill-container,
                [data-theme="sakura"] .chopaeng-toolbar {
                    background: rgba(255, 255, 255, 0.92);
                    border-color: rgba(236, 72, 153, 0.25);
                }
                [data-theme="sakura"] .chopaeng-nav-item {
                    color: #9d4e7f;
                }
                [data-theme="sakura"] .chopaeng-nav-item:hover {
                    color: #3b072c;
                    background-color: rgba(236, 72, 153, 0.12);
                }
                [data-theme="sakura"] .chopaeng-nav-item.active {
                    background: linear-gradient(135deg, #ec4899, #db2777);
                    color: #ffffff !important;
                    box-shadow: 0 2px 10px rgba(236, 72, 153, 0.35);
                }
                [data-theme="sakura"] .chopaeng-explore-trigger {
                    color: #9d4e7f;
                }
                [data-theme="sakura"] .chopaeng-explore-trigger:hover,
                [data-theme="sakura"] .chopaeng-explore-trigger.open {
                    color: #3b072c;
                    background-color: rgba(236, 72, 153, 0.12);
                }
                [data-theme="sakura"] .chopaeng-explore-trigger.has-active {
                    color: #ec4899;
                }
                [data-theme="sakura"] .chopaeng-explore-dropdown,
                [data-theme="sakura"] .chopaeng-user-dropdown {
                    background: #ffffff;
                    border-color: rgba(236, 72, 153, 0.28);
                }
                [data-theme="sakura"] .chopaeng-explore-link,
                [data-theme="sakura"] .chopaeng-user-dropdown-item {
                    color: #3b072c;
                }
                [data-theme="sakura"] .chopaeng-explore-link:hover,
                [data-theme="sakura"] .chopaeng-user-dropdown-item:hover {
                    background: #fdf2f8;
                    color: #db2777;
                }
                [data-theme="sakura"] .chopaeng-action-btn,
                [data-theme="sakura"] .chopaeng-hamburger,
                [data-theme="sakura"] .chopaeng-user-pill {
                    background: #ffffff;
                    border-color: rgba(236, 72, 153, 0.28);
                    color: #3b072c;
                }
                [data-theme="sakura"] .chopaeng-action-btn:hover,
                [data-theme="sakura"] .chopaeng-user-pill:hover {
                    background: #fdf2f8;
                    color: #ec4899;
                    border-color: #ec4899;
                }
                [data-theme="sakura"] .chopaeng-toolbar-btn {
                    color: #9d4e7f;
                }
                [data-theme="sakura"] .chopaeng-toolbar-btn:hover {
                    background: rgba(236, 72, 153, 0.15);
                    color: #ec4899;
                }
                [data-theme="sakura"] .chopaeng-hamburger span {
                    background: #3b072c;
                }
                [data-theme="sakura"] .chopaeng-mobile-drawer {
                    background: #ffffff;
                    color: #3b072c;
                }
                [data-theme="sakura"] .chopaeng-drawer-header,
                [data-theme="sakura"] .chopaeng-drawer-footer {
                    background: #fdf2f8 !important;
                    border-color: rgba(236, 72, 153, 0.25) !important;
                }
                [data-theme="sakura"] .mobile-nav-link {
                    color: #3b072c;
                }
                [data-theme="sakura"] .mobile-nav-link:hover {
                    background: rgba(236, 72, 153, 0.12);
                    color: #ec4899;
                }
                [data-theme="sakura"] .mobile-nav-link.active {
                    background: #ec4899;
                    color: #ffffff !important;
                }
                [data-theme="sakura"] .mobile-nav-link .mobile-nav-icon {
                    background: #fdf2f8;
                }
                [data-theme="sakura"] .mobile-quick-link {
                    color: #3b072c;
                    background: #fdf2f8;
                    border-color: rgba(236, 72, 153, 0.25);
                }
                [data-theme="sakura"] .mobile-quick-link:hover {
                    background: #fce7f3;
                    color: #ec4899;
                }

                [data-theme="dal"] .chopaeng-navbar.scrolled {
                    background-color: rgba(15, 23, 42, 0.95);
                    border-bottom-color: rgba(56, 189, 248, 0.25);
                }
                [data-theme="dal"] .chopaeng-nav-pill-container,
                [data-theme="dal"] .chopaeng-toolbar {
                    background: rgba(30, 41, 59, 0.9);
                    border-color: rgba(56, 189, 248, 0.25);
                }
                [data-theme="dal"] .chopaeng-nav-item {
                    color: #94a3b8;
                }
                [data-theme="dal"] .chopaeng-nav-item:hover {
                    color: #f8fafc;
                    background-color: rgba(56, 189, 248, 0.15);
                }
                [data-theme="dal"] .chopaeng-nav-item.active {
                    background: linear-gradient(135deg, #0284c7, #0369a1);
                    color: #ffffff !important;
                    box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);
                }
                [data-theme="dal"] .chopaeng-explore-trigger {
                    color: #94a3b8;
                }
                [data-theme="dal"] .chopaeng-explore-trigger:hover,
                [data-theme="dal"] .chopaeng-explore-trigger.open {
                    color: #f8fafc;
                    background-color: rgba(56, 189, 248, 0.15);
                }
                [data-theme="dal"] .chopaeng-explore-trigger.has-active {
                    color: #38bdf8;
                }
                [data-theme="dal"] .chopaeng-explore-dropdown,
                [data-theme="dal"] .chopaeng-user-dropdown {
                    background: #1e293b;
                    border-color: rgba(56, 189, 248, 0.3);
                }
                [data-theme="dal"] .chopaeng-explore-link,
                [data-theme="dal"] .chopaeng-user-dropdown-item {
                    color: #f8fafc;
                }
                [data-theme="dal"] .chopaeng-explore-link:hover,
                [data-theme="dal"] .chopaeng-user-dropdown-item:hover {
                    background: #0f172a;
                    color: #38bdf8;
                }
                [data-theme="dal"] .chopaeng-action-btn,
                [data-theme="dal"] .chopaeng-hamburger,
                [data-theme="dal"] .chopaeng-user-pill {
                    background: #1e293b;
                    border-color: rgba(56, 189, 248, 0.3);
                    color: #f8fafc;
                }
                [data-theme="dal"] .chopaeng-action-btn:hover,
                [data-theme="dal"] .chopaeng-user-pill:hover {
                    background: #0f172a;
                    color: #38bdf8;
                    border-color: #38bdf8;
                }
                [data-theme="dal"] .chopaeng-toolbar-btn {
                    color: #94a3b8;
                }
                [data-theme="dal"] .chopaeng-toolbar-btn:hover {
                    background: rgba(56, 189, 248, 0.15);
                    color: #38bdf8;
                }
                [data-theme="dal"] .chopaeng-hamburger span {
                    background: #f8fafc;
                }
                [data-theme="dal"] .chopaeng-mobile-drawer {
                    background: #1e293b;
                    color: #f8fafc;
                }
                [data-theme="dal"] .chopaeng-drawer-header,
                [data-theme="dal"] .chopaeng-drawer-footer {
                    background: #0f172a !important;
                    border-color: rgba(56, 189, 248, 0.25) !important;
                }
                [data-theme="dal"] .mobile-nav-link {
                    color: #f8fafc;
                }
                [data-theme="dal"] .mobile-nav-link:hover {
                    background: rgba(56, 189, 248, 0.15);
                    color: #38bdf8;
                }
                [data-theme="dal"] .mobile-nav-link.active {
                    background: #0284c7;
                    color: #ffffff !important;
                }
                [data-theme="dal"] .mobile-nav-link .mobile-nav-icon {
                    background: #0f172a;
                }
                [data-theme="dal"] .mobile-quick-link {
                    color: #f8fafc;
                    background: #0f172a;
                    border-color: rgba(56, 189, 248, 0.25);
                }
                [data-theme="dal"] .mobile-quick-link:hover {
                    background: #162033;
                    color: #38bdf8;
                }

                [data-theme="nooklink"] .chopaeng-navbar.scrolled {
                    background-color: rgba(9, 13, 22, 0.95);
                    border-bottom-color: rgba(16, 185, 129, 0.3);
                }
                [data-theme="nooklink"] .chopaeng-nav-pill-container,
                [data-theme="nooklink"] .chopaeng-toolbar {
                    background: rgba(17, 24, 39, 0.92);
                    border-color: rgba(16, 185, 129, 0.3);
                }
                [data-theme="nooklink"] .chopaeng-nav-item {
                    color: #94a3b8;
                }
                [data-theme="nooklink"] .chopaeng-nav-item:hover {
                    color: #f8fafc;
                    background-color: rgba(16, 185, 129, 0.15);
                }
                [data-theme="nooklink"] .chopaeng-nav-item.active {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #ffffff !important;
                    box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4);
                }
                [data-theme="nooklink"] .chopaeng-explore-trigger {
                    color: #94a3b8;
                }
                [data-theme="nooklink"] .chopaeng-explore-trigger:hover,
                [data-theme="nooklink"] .chopaeng-explore-trigger.open {
                    color: #f8fafc;
                    background-color: rgba(16, 185, 129, 0.15);
                }
                [data-theme="nooklink"] .chopaeng-explore-trigger.has-active {
                    color: #10b981;
                }
                [data-theme="nooklink"] .chopaeng-explore-dropdown,
                [data-theme="nooklink"] .chopaeng-user-dropdown {
                    background: #111827;
                    border-color: rgba(16, 185, 129, 0.35);
                }
                [data-theme="nooklink"] .chopaeng-explore-link,
                [data-theme="nooklink"] .chopaeng-user-dropdown-item {
                    color: #f8fafc;
                }
                [data-theme="nooklink"] .chopaeng-explore-link:hover,
                [data-theme="nooklink"] .chopaeng-user-dropdown-item:hover {
                    background: #090d16;
                    color: #34d399;
                }
                [data-theme="nooklink"] .chopaeng-action-btn,
                [data-theme="nooklink"] .chopaeng-hamburger,
                [data-theme="nooklink"] .chopaeng-user-pill {
                    background: #111827;
                    border-color: rgba(16, 185, 129, 0.35);
                    color: #f8fafc;
                }
                [data-theme="nooklink"] .chopaeng-action-btn:hover,
                [data-theme="nooklink"] .chopaeng-user-pill:hover {
                    background: #090d16;
                    color: #10b981;
                    border-color: #10b981;
                }
                [data-theme="nooklink"] .chopaeng-toolbar-btn {
                    color: #94a3b8;
                }
                [data-theme="nooklink"] .chopaeng-toolbar-btn:hover {
                    background: rgba(16, 185, 129, 0.15);
                    color: #34d399;
                }
                [data-theme="nooklink"] .chopaeng-hamburger span {
                    background: #f8fafc;
                }
                [data-theme="nooklink"] .chopaeng-mobile-drawer {
                    background: #111827;
                    color: #f8fafc;
                }
                [data-theme="nooklink"] .chopaeng-drawer-header,
                [data-theme="nooklink"] .chopaeng-drawer-footer {
                    background: #090d16 !important;
                    border-color: rgba(16, 185, 129, 0.25) !important;
                }
                [data-theme="nooklink"] .mobile-nav-link {
                    color: #f8fafc;
                }
                [data-theme="nooklink"] .mobile-nav-link:hover {
                    background: rgba(16, 185, 129, 0.15);
                    color: #34d399;
                }
                [data-theme="nooklink"] .mobile-nav-link.active {
                    background: #10b981;
                    color: #ffffff !important;
                }
                [data-theme="nooklink"] .mobile-nav-link .mobile-nav-icon {
                    background: #090d16;
                }
                [data-theme="nooklink"] .mobile-quick-link {
                    color: #f8fafc;
                    background: #090d16;
                    border-color: rgba(16, 185, 129, 0.25);
                }
                [data-theme="nooklink"] .mobile-quick-link:hover {
                    background: #1f2937;
                    color: #34d399;
                }

                /* Preserve Action Button & Nav Icons Across All Themes */
                .chopaeng-action-btn i.text-success,
                [data-theme="celeste"] .chopaeng-action-btn i.text-success,
                [data-theme="roost"] .chopaeng-action-btn i.text-success,
                [data-theme="sakura"] .chopaeng-action-btn i.text-success,
                [data-theme="dal"] .chopaeng-action-btn i.text-success,
                [data-theme="nooklink"] .chopaeng-action-btn i.text-success {
                    color: #22c55e !important;
                }
                .chopaeng-toolbar-btn i.text-success,
                [data-theme="celeste"] .chopaeng-toolbar-btn i.text-success,
                [data-theme="roost"] .chopaeng-toolbar-btn i.text-success,
                [data-theme="sakura"] .chopaeng-toolbar-btn i.text-success,
                [data-theme="dal"] .chopaeng-toolbar-btn i.text-success,
                [data-theme="nooklink"] .chopaeng-toolbar-btn i.text-success {
                    color: #22c55e !important;
                }
                .chopaeng-toolbar-btn i.text-warning,
                [data-theme="celeste"] .chopaeng-toolbar-btn i.text-warning,
                [data-theme="roost"] .chopaeng-toolbar-btn i.text-warning,
                [data-theme="sakura"] .chopaeng-toolbar-btn i.text-warning,
                [data-theme="dal"] .chopaeng-toolbar-btn i.text-warning,
                [data-theme="nooklink"] .chopaeng-toolbar-btn i.text-warning {
                    color: #f59e0b !important;
                }
                .chopaeng-toolbar-btn i.text-amber,
                [data-theme="celeste"] .chopaeng-toolbar-btn i.text-amber,
                [data-theme="roost"] .chopaeng-toolbar-btn i.text-amber,
                [data-theme="sakura"] .chopaeng-toolbar-btn i.text-amber,
                [data-theme="dal"] .chopaeng-toolbar-btn i.text-amber,
                [data-theme="nooklink"] .chopaeng-toolbar-btn i.text-amber {
                    color: #f59e0b !important;
                }
                .chopaeng-toolbar-btn i.text-primary,
                [data-theme="celeste"] .chopaeng-toolbar-btn i.text-primary,
                [data-theme="roost"] .chopaeng-toolbar-btn i.text-primary,
                [data-theme="sakura"] .chopaeng-toolbar-btn i.text-primary,
                [data-theme="dal"] .chopaeng-toolbar-btn i.text-primary,
                [data-theme="nooklink"] .chopaeng-toolbar-btn i.text-primary {
                    color: #3b82f6 !important;
                }
                .mobile-nav-icon i.text-success,
                [data-theme="celeste"] .mobile-nav-icon i.text-success,
                [data-theme="roost"] .mobile-nav-icon i.text-success,
                [data-theme="sakura"] .mobile-nav-icon i.text-success,
                [data-theme="dal"] .mobile-nav-icon i.text-success,
                [data-theme="nooklink"] .mobile-nav-icon i.text-success {
                    color: #22c55e !important;
                }
            `}</style>

            <nav
                className={`navbar sticky-top py-2 chopaeng-navbar ${isScrolled || isMobileMenuOpen ? "scrolled" : ""}`}
                style={{ zIndex: 1050 }}
                role="navigation"
                aria-label="Main Navigation"
            >
                <div className="container-xl d-flex align-items-center justify-content-between gap-2">
                    {/* Brand Logo */}
                    <Link
                        to="/"
                        className="d-flex align-items-center gap-2 text-decoration-none flex-shrink-0"
                        onClick={() => {
                            playChimeClick();
                            setIsMobileMenuOpen(false);
                        }}
                        aria-label="Chopaeng Home"
                    >
                        <div
                            className="logo-box shadow-xs rounded-circle overflow-hidden bg-white p-1 d-flex align-items-center justify-content-center"
                            style={{ width: 34, height: 34, border: '2px solid rgba(22, 163, 74, 0.15)' }}
                        >
                            <img src={logo} alt="Chopaeng Leaf Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <div className="d-flex flex-column d-none d-sm-flex">
                            <span className="ac-font text-dark fw-black lh-1" style={{ letterSpacing: '0.02em', fontSize: '1.1rem' }}>
                                CHOPAENG
                            </span>
                            <span className="fw-bold text-success text-uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.58rem' }}>
                                Treasure Islands
                            </span>
                        </div>
                    </Link>

                    {/* Compact icon-only nav for tablet widths (md up to lg) so the bar isn't hamburger-only there */}
                    <div className="d-none d-md-flex d-lg-none align-items-center chopaeng-nav-pill-container chopaeng-nav-compact" role="menubar" aria-label="Quick navigation">
                        {primaryLinks.map((link) => (
                            <NavLink
                                key={link.name}
                                to={link.path}
                                end={link.path === "/"}
                                className={({ isActive }) => `chopaeng-nav-item ${isActive ? "active" : ""}`}
                                onClick={() => playChimeClick()}
                                role="menuitem"
                                title={link.name}
                                aria-label={link.name}
                            >
                                <i className={`fa-solid ${link.icon}`} style={{ fontSize: '0.8rem' }} aria-hidden="true" />
                                <span className="visually-hidden">{link.name}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Desktop Navigation — Primary Pills + Explore Dropdown */}
                    <div className="d-none d-lg-flex align-items-center chopaeng-nav-pill-container" role="menubar">
                        {primaryLinks.map((link) => (
                            <NavLink
                                key={link.name}
                                to={link.path}
                                end={link.path === "/"}
                                className={({ isActive }) => `chopaeng-nav-item ${isActive ? "active" : ""}`}
                                onClick={() => playChimeClick()}
                                role="menuitem"
                            >
                                <i className={`fa-solid ${link.icon}`} style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                                <span>{link.name}</span>
                            </NavLink>
                        ))}

                        {/* Explore "More" Dropdown Trigger */}
                        <div
                            className="position-relative"
                            ref={exploreDropdownRef}
                            onMouseEnter={handleExploreEnter}
                            onMouseLeave={handleExploreLeave}
                        >
                            <button
                                type="button"
                                className={`chopaeng-explore-trigger ${showExploreDropdown ? 'open' : ''} ${isExploreActive ? 'has-active' : ''}`}
                                onClick={() => {
                                    playChimeClick();
                                    setShowExploreDropdown(prev => !prev);
                                }}
                                aria-expanded={showExploreDropdown}
                                aria-haspopup="menu"
                                aria-label="More navigation options"
                            >
                                <i className="fa-solid fa-compass" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                                <span>Explore</span>
                                <i className="fa-solid fa-chevron-down chevron-icon" aria-hidden="true" />
                            </button>

                            <div
                                className={`chopaeng-explore-dropdown ${showExploreDropdown ? 'show' : ''}`}
                                role="menu"
                                onMouseEnter={handleExploreEnter}
                                onMouseLeave={handleExploreLeave}
                            >
                                {exploreLinks.map((link) => (
                                    <NavLink
                                        key={link.name}
                                        to={link.path}
                                        role="menuitem"
                                        className={({ isActive }) => `chopaeng-explore-link ${isActive ? 'active-link' : ''}`}
                                        onClick={() => {
                                            playChimeClick();
                                            setShowExploreDropdown(false);
                                        }}
                                    >
                                        <div
                                            className="explore-icon"
                                            style={{ backgroundColor: `${link.color}15`, color: link.color }}
                                        >
                                            <i className={`fa-solid ${link.icon}`} />
                                        </div>
                                        <div>
                                            <div className="fw-bold" style={{ fontSize: '0.84rem' }}>{link.name}</div>
                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{link.desc}</div>
                                        </div>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Action Controls */}
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        {/* User Account */}
                        {user ? (
                            <div className="position-relative" ref={userDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        setShowUserDropdown((prev) => !prev);
                                    }}
                                    className="chopaeng-user-pill"
                                    aria-expanded={showUserDropdown}
                                    aria-haspopup="menu"
                                    aria-label="User Account Menu"
                                >
                                    {userAvatarUrl ? (
                                        <img
                                            src={userAvatarUrl}
                                            alt={user.username}
                                            className="rounded-circle"
                                            style={{ width: 28, height: 28, objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div
                                            className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold"
                                            style={{ width: 28, height: 28, fontSize: '0.72rem' }}
                                        >
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="d-none d-md-inline text-truncate" style={{ maxWidth: '80px' }}>
                                        {user.username}
                                    </span>
                                    <i className={`fa-solid fa-chevron-down text-muted`} style={{ fontSize: '0.55rem', transition: 'transform 0.2s', transform: showUserDropdown ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
                                </button>

                                {/* User Dropdown */}
                                {showUserDropdown && (
                                    <div className="chopaeng-user-dropdown" role="menu">
                                        <div className="px-3 py-2 border-bottom mb-1" style={{ borderColor: 'var(--card-border, rgba(0,0,0,0.06))' }}>
                                            <div className="fw-black text-dark text-truncate" style={{ fontSize: '0.85rem' }}>{user.username}</div>
                                            <div className="text-muted text-truncate" style={{ fontSize: '0.7rem' }}>
                                                {user.is_admin ? "Administrator" : user.is_mod ? "Moderator" : "Member"}
                                            </div>
                                        </div>

                                        {userQuickLinks.map((link) => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                role="menuitem"
                                                className="chopaeng-user-dropdown-item"
                                                onClick={() => setShowUserDropdown(false)}
                                            >
                                                <div className="dropdown-icon" style={{ backgroundColor: `${link.color}12`, color: link.color }}>
                                                    <i className={`fa-solid ${link.icon}`} />
                                                </div>
                                                <span>{link.name}</span>
                                            </Link>
                                        ))}

                                        <div className="border-top mt-1 pt-1" style={{ borderColor: 'var(--card-border, rgba(0,0,0,0.06))' }}>
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                role="menuitem"
                                                className="chopaeng-user-dropdown-item danger"
                                            >
                                                <div className="dropdown-icon" style={{ backgroundColor: '#ef444412', color: '#ef4444' }}>
                                                    <i className="fa-solid fa-right-from-bracket" />
                                                </div>
                                                <span>Logout</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={login}
                                className="btn btn-nook text-white rounded-pill fw-bold btn-sm shadow-2xs d-none d-md-inline-flex align-items-center gap-2 px-3"
                                style={{ height: '36px', fontSize: '0.82rem' }}
                                title="Login with Discord"
                            >
                                <i className="fa-brands fa-discord" style={{ fontSize: '0.95rem' }} aria-hidden="true" />
                                <span>Login</span>
                            </button>
                        )}

                        {/* Quick Search Spotlight (Ctrl+K / ⌘K) — kept standalone, it's the one secondary
                            action worth a dedicated, always-visible button */}
                        <button
                            type="button"
                            onClick={openSearch}
                            className="chopaeng-action-btn d-inline-flex align-items-center gap-1.5 px-2.5"
                            style={{ height: '36px' }}
                            title="Quick Search (Ctrl+K or /)"
                            aria-label="Open Search Command Palette"
                        >
                            <i className="fa-solid fa-magnifying-glass text-muted" aria-hidden="true" />
                            <span className="d-none d-lg-inline-block font-monospace text-muted" style={{ fontSize: '0.68rem', fontWeight: 700 }}>⌘K</span>
                        </button>

                        {/* Secondary actions toolbar — jukebox / theme / discord grouped into one pill
                            instead of three separate floating circles. Tablet/desktop only; on phones
                            these live in the drawer where there's room. */}
                        <div className="chopaeng-toolbar d-none d-md-inline-flex">
                            <button
                                type="button"
                                onClick={() => openCommunityModal('online')}
                                className="chopaeng-toolbar-btn position-relative"
                                title="Live Island Radar & Online Residents"
                                aria-label="Open Live Island Radar & Online Residents"
                            >
                                <i className="fa-solid fa-satellite-dish text-success" aria-hidden="true" />
                                <span
                                    className="position-absolute top-0 end-0 rounded-circle bg-success"
                                    style={{
                                        width: 7,
                                        height: 7,
                                        transform: 'translate(20%, -20%)',
                                        boxShadow: '0 0 6px #22c55e',
                                    }}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={openJukebox}
                                className="chopaeng-toolbar-btn"
                                title="K.K. Slider Jukebox"
                                aria-label="Open K.K. Slider Jukebox"
                            >
                                <i className="fa-solid fa-guitar text-success" aria-hidden="true" />
                            </button>

                            <div className="position-relative" ref={themeDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        playChimeClick();
                                        setShowThemeDropdown((prev) => !prev);
                                    }}
                                    className="chopaeng-toolbar-btn"
                                    title={`Theme: ${currentTheme === 'celeste' ? 'Celeste Stargazing' : currentTheme === 'roost' ? 'The Roost Cozy' : 'Nook Day'}`}
                                    aria-label="Toggle Theme"
                                    aria-haspopup="menu"
                                    aria-expanded={showThemeDropdown}
                                >
                                    <i className={`fa-solid ${
                                        currentTheme === 'celeste' ? 'fa-star text-warning' :
                                        currentTheme === 'roost' ? 'fa-mug-hot text-amber' :
                                        currentTheme === 'sakura' ? 'fa-heart text-danger' :
                                        currentTheme === 'dal' ? 'fa-plane text-info' :
                                        currentTheme === 'nooklink' ? 'fa-mobile-screen text-success' :
                                        'fa-leaf text-success'
                                    }`} aria-hidden="true" />
                                </button>

                                {showThemeDropdown && (
                                    <div
                                        className="chopaeng-user-dropdown"
                                        role="menu"
                                        style={{ width: '230px' }}
                                    >
                                        <div className="px-3 py-2 mb-1">
                                            <div className="fw-bold text-muted text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                                                Island Theme
                                            </div>
                                        </div>
                                        {THEME_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                role="menuitemradio"
                                                aria-checked={currentTheme === opt.id}
                                                onClick={() => {
                                                    playChimeClick();
                                                    setStoredTheme(opt.id);
                                                    setCurrentTheme(opt.id);
                                                    setShowThemeDropdown(false);
                                                }}
                                                className={`chopaeng-user-dropdown-item ${currentTheme === opt.id ? 'fw-bold' : ''}`}
                                            >
                                                <div className="dropdown-icon" style={{ backgroundColor: `${opt.badgeColor}15`, color: opt.badgeColor }}>
                                                    <i className={`fa-solid ${opt.icon}`} />
                                                </div>
                                                <div className="flex-grow-1">
                                                    <div style={{ fontSize: '0.82rem' }}>{opt.name}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.65rem' }}>{opt.description}</div>
                                                </div>
                                                {currentTheme === opt.id && (
                                                    <i className="fa-solid fa-circle-check text-success" style={{ fontSize: '0.75rem' }} aria-hidden="true" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <a
                                href="https://discord.gg/chopaeng"
                                target="_blank"
                                rel="noreferrer"
                                className="chopaeng-toolbar-btn"
                                title="Join our Discord Community"
                                aria-label="Discord Community"
                            >
                                <i className="fa-brands fa-discord text-primary" aria-hidden="true" />
                            </a>
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            ref={hamburgerRef}
                            type="button"
                            className={`chopaeng-hamburger d-lg-none ${isMobileMenuOpen ? 'open' : ''}`}
                            onClick={() => {
                                playChimeClick();
                                setIsMobileMenuOpen(!isMobileMenuOpen);
                            }}
                            aria-expanded={isMobileMenuOpen}
                            aria-controls="chopaeng-mobile-drawer"
                            aria-label="Toggle Mobile Navigation Menu"
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Drawer Backdrop */}
            <div
                className={`chopaeng-mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-hidden="true"
            />

            {/* Mobile Drawer — header/footer stay fixed, only the middle section scrolls */}
            <aside
                id="chopaeng-mobile-drawer"
                className={`chopaeng-mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-hidden={!isMobileMenuOpen}
                aria-label="Mobile Navigation Drawer"
            >
                {/* Drawer Header (fixed) — jukebox lives here on phones, since the top bar
                    toolbar is hidden below the md breakpoint */}
                <div className="chopaeng-drawer-header p-3 border-bottom d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-cream, #f8faf6)' }}>
                    <div className="d-flex align-items-center gap-2">
                        <img src={logo} alt="Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                        <span className="ac-font fw-black text-dark" style={{ fontSize: '1rem' }}>CHOPAENG</span>
                    </div>
                    <div className="chopaeng-drawer-header-actions">
                        <button
                            type="button"
                            onClick={openJukebox}
                            className="chopaeng-action-btn d-md-none"
                            title="K.K. Slider Jukebox"
                            aria-label="Open K.K. Slider Jukebox"
                        >
                            <i className="fa-solid fa-guitar text-success" aria-hidden="true" />
                        </button>
                        <button
                            ref={drawerCloseRef}
                            type="button"
                            className="btn-close"
                            onClick={() => setIsMobileMenuOpen(false)}
                            aria-label="Close menu"
                            style={{ fontSize: '0.7rem' }}
                        />
                    </div>
                </div>

                {/* Scrollable body: user card, quick links, nav list, theme selector */}
                <div className="chopaeng-drawer-body">
                    {/* Drawer User Card */}
                    <div className="p-3 border-bottom">
                        {user ? (
                            <div className="d-flex align-items-center justify-content-between gap-2">
                                <div className="d-flex align-items-center gap-2 min-w-0">
                                    {userAvatarUrl ? (
                                        <img src={userAvatarUrl} alt={user.username} className="rounded-circle" style={{ width: 34, height: 34 }} />
                                    ) : (
                                        <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 34, height: 34, fontSize: '0.75rem' }}>
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <strong className="d-block text-dark text-truncate" style={{ fontSize: '0.85rem' }}>{user.username}</strong>
                                        <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                                            {user.is_admin ? "Admin" : user.is_mod ? "Moderator" : "Member"}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="btn btn-xs btn-outline-danger rounded-pill fw-bold px-2.5 py-1 flex-shrink-0"
                                    style={{ fontSize: '0.72rem' }}
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    login();
                                }}
                                className="btn btn-nook text-white rounded-pill fw-bold btn-sm w-100 py-2 shadow-2xs d-flex align-items-center justify-content-center gap-2"
                            >
                                <i className="fa-brands fa-discord fs-6" aria-hidden="true" />
                                <span>Login with Discord</span>
                            </button>
                        )}
                    </div>

                    {/* User Quick Links (mobile) */}
                    {user && (
                        <div className="px-3 pt-3">
                            <div className="mobile-quick-links">
                                {userQuickLinks.slice(0, 3).map((link) => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className="mobile-quick-link"
                                        onClick={() => { playChimeClick(); setIsMobileMenuOpen(false); }}
                                    >
                                        <i className={`fa-solid ${link.icon}`} style={{ color: link.color, fontSize: '0.9rem' }} />
                                        <span>{link.name.replace('My ', '')}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Drawer Navigation List */}
                    <div className="p-3">
                        {/* Quick Search Action */}
                        <button
                            type="button"
                            className="btn btn-light border rounded-pill w-100 py-2 mb-3 text-start d-flex align-items-center justify-content-between px-3 shadow-2xs"
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                openSearch();
                            }}
                        >
                            <span className="d-flex align-items-center gap-2 text-muted fw-bold small">
                                <i className="fa-solid fa-magnifying-glass text-success" />
                                <span>Search pages, items, villagers...</span>
                            </span>
                            <span className="badge bg-dark text-white rounded-pill font-monospace" style={{ fontSize: '0.65rem' }}>⌘K</span>
                        </button>

                        <div className="fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.06em', fontSize: '0.62rem' }}>
                            Navigation
                        </div>
                        <div className="d-flex flex-column gap-1 mb-3">
                            {allNavLinks.map((link) => (
                                <NavLink
                                    key={link.name}
                                    to={link.path}
                                    end={link.path === "/"}
                                    className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}
                                    onClick={() => {
                                        playChimeClick();
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <div className="mobile-nav-icon">
                                        <i className={`fa-solid ${link.icon} text-success`} aria-hidden="true" />
                                    </div>
                                    <span>{link.name}</span>
                                </NavLink>
                            ))}
                        </div>

                        {/* Theme Selector (mobile) */}
                        <div className="fw-bold text-muted text-uppercase mb-2" style={{ letterSpacing: '0.06em', fontSize: '0.62rem' }}>
                            Theme
                        </div>
                        <div className="d-flex gap-1">
                            {THEME_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    aria-pressed={currentTheme === opt.id}
                                    onClick={() => {
                                        playChimeClick();
                                        setStoredTheme(opt.id);
                                        setCurrentTheme(opt.id);
                                    }}
                                    className={`btn btn-xs rounded-pill flex-grow-1 py-1.5 fw-bold transition-all d-flex align-items-center justify-content-center gap-1 ${currentTheme === opt.id ? 'btn-success text-white shadow-2xs' : 'btn-light text-dark border'
                                        }`}
                                    style={{ fontSize: '0.72rem' }}
                                >
                                    <i className={`fa-solid ${opt.icon}`} style={{ fontSize: '0.65rem' }} aria-hidden="true" />
                                    <span>{THEME_SHORT_LABEL[opt.id] ?? opt.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Drawer Footer (fixed): feedback / Discord — always reachable, never scrolled out of view */}
                <div className="chopaeng-drawer-footer p-3 border-top d-flex flex-column gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            openCommunityModal('online');
                        }}
                        className="btn btn-sm btn-outline-success w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                        style={{ fontSize: '0.8rem' }}
                    >
                        <i className="fa-solid fa-satellite-dish text-success" aria-hidden="true" />
                        <span>Live Radar &amp; Who's Online</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            openSuggestionModal();
                        }}
                        className="btn btn-sm btn-outline-warning w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                        style={{ fontSize: '0.8rem' }}
                    >
                        <i className="fa-solid fa-lightbulb text-warning" aria-hidden="true" />
                        <span>Suggest Feature</span>
                    </button>

                    <a
                        href="https://discord.gg/chopaeng"
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-primary w-100 rounded-pill fw-bold py-2 d-flex align-items-center justify-content-center gap-2 text-decoration-none"
                        style={{ fontSize: '0.8rem' }}
                    >
                        <i className="fa-brands fa-discord text-primary" aria-hidden="true" />
                        <span>Join Discord</span>
                    </a>
                </div>
            </aside>

            {/* K.K. Slider Jukebox & 24H Hourly Radio Audio */}
            <KKSliderJukebox />

            {/* Animalese Voice Studio Modal */}
            <AnimaleseVoiceModal />

            {/* Live Community & Island Traffic Radar Modal */}
            <OnlineCommunityModal />

            {/* NookPhone Quick App Dock */}
            <NookPhoneDock />
        </>
    );
};

export default Navbar;