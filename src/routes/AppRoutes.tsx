import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IndexLayout } from "../layouts/IndexLayout.tsx";
import RequireMod from "../components/RequireMod.tsx";
import DashboardLayout from "../layouts/DashboardLayout.tsx";
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { PageSkeleton } from '../components/Skeletons';

// Eagerly loaded — on the critical path for every visit
import Chopaeng404 from "../errors/404.tsx";

// --- Public pages (lazy-loaded) ---
const Home            = lazy(() => import("../pages/Home.tsx"));
const About           = lazy(() => import("../pages/About.tsx"));
const Guides          = lazy(() => import("../pages/Guides.tsx"));
const Catalogue       = lazy(() => import("../pages/Catalogue.tsx"));
const Maps            = lazy(() => import("../pages/Maps.tsx"));
const TreasureIslands = lazy(() => import("../pages/TreasureIslands.tsx"));
const IslandDetail    = lazy(() => import("../pages/IslandDetail.tsx"));
const Membership      = lazy(() => import("../pages/Membership.tsx"));
const FindItems       = lazy(() => import("../pages/FindItems.tsx"));
const CommandBuilder  = lazy(() => import("../pages/CommandBuilder.tsx"));
const PocketInventory = lazy(() => import("../pages/PocketInventory.tsx"));
const CatalogDetail   = lazy(() => import("../pages/CatalogDetail.tsx"));
const Contact         = lazy(() => import("../pages/Contact.tsx"));
const DodoDecryptor   = lazy(() => import("../pages/DodoDecryptor.tsx"));
const OrderBot        = lazy(() => import("../pages/OrderBot.tsx"));
const DropBot         = lazy(() => import("../pages/DropBot.tsx"));
const Profile         = lazy(() => import("../pages/Profile.tsx"));
const PublicProfile   = lazy(() => import("../pages/PublicProfile.tsx"));
const TripPlanner     = lazy(() => import("../pages/TripPlanner.tsx"));
const AuthCallback    = lazy(() => import("../pages/AuthCallback.tsx"));
const BlogList        = lazy(() => import("../pages/BlogList.tsx"));
const BlogPost        = lazy(() => import("../pages/BlogPost.tsx"));
const PrivacyPolicy   = lazy(() => import("../pages/PrivacyPolicy.tsx"));
const TermsOfService  = lazy(() => import("../pages/TermsOfService.tsx"));
const CookiesPolicy   = lazy(() => import("../pages/CookiesPolicy.tsx"));

// --- Community & Phase 2 pages (lazy-loaded) ---
const Critters        = lazy(() => import("../pages/Critters.tsx"));
const Events          = lazy(() => import("../pages/Events.tsx"));
const NPCs            = lazy(() => import("../pages/NPCs.tsx"));
const MyCollection    = lazy(() => import("../pages/MyCollection.tsx"));
const Wishlist        = lazy(() => import("../pages/Wishlist.tsx"));

// --- Dashboard pages (lazy-loaded) ---
const DashboardHome          = lazy(() => import("../pages/dashboard/DashboardHome.tsx"));
const DashboardIslands       = lazy(() => import("../pages/dashboard/DashboardIslands.tsx"));
const DashboardIslandDetail  = lazy(() => import("../pages/dashboard/DashboardIslandDetail.tsx"));
const DashboardLogs          = lazy(() => import("../pages/dashboard/DashboardLogs.tsx"));
const DashboardWebsiteLogins = lazy(() => import("../pages/dashboard/DashboardWebsiteLogins.tsx"));
const DashboardAnalytics     = lazy(() => import("../pages/dashboard/DashboardAnalytics.tsx"));
const DashboardDatabase      = lazy(() => import("../pages/dashboard/DashboardDatabase.tsx"));
const DashboardForbidden     = lazy(() => import("../pages/dashboard/DashboardForbidden.tsx"));
const DashboardOps           = lazy(() => import("../pages/dashboard/DashboardOps.tsx"));
const DashboardIncidents     = lazy(() => import("../pages/dashboard/DashboardIncidents.tsx"));
const DashboardTrust         = lazy(() => import("../pages/dashboard/DashboardTrust.tsx"));
const DashboardBundles       = lazy(() => import("../pages/dashboard/DashboardBundles.tsx"));
const DashboardPlayerLookup  = lazy(() => import("../pages/dashboard/DashboardPlayerLookup.tsx"));
const DashboardLeaderboard   = lazy(() => import("../pages/dashboard/DashboardLeaderboard.tsx"));
const DashboardBulkActions   = lazy(() => import("../pages/dashboard/DashboardBulkActions.tsx"));
const DashboardAuditLog      = lazy(() => import("../pages/dashboard/DashboardAuditLog.tsx"));
const DashboardScheduled     = lazy(() => import("../pages/dashboard/DashboardScheduled.tsx"));
const DashboardMaintenance   = lazy(() => import("../pages/dashboard/DashboardMaintenance.tsx"));
const DashboardDevices       = lazy(() => import("../pages/dashboard/DashboardDevices.tsx"));


const AppRoutes = () => {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <Routes>
                <Route element={<IndexLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/guides" element={<Guides />} />
                    <Route path="/catalog" element={<Catalogue />} />
                    <Route path="/catalogue" element={<Catalogue />} />
                    <Route path="/maps" element={<Maps />} />
                    <Route path="/islands" element={<TreasureIslands />} />
                    <Route path="/island/:id" element={<IslandDetail />} />
                    <Route path="/membership" element={<Membership />} />
                    <Route path="/find" element={<FindItems />} />
                    <Route path="/command-builder" element={<AppErrorBoundary label="Command Builder"><CommandBuilder /></AppErrorBoundary>} />
                    <Route path="/pockets" element={<AppErrorBoundary label="Pocket Inventory"><PocketInventory /></AppErrorBoundary>} />
                    <Route path="/pocket-inventory" element={<AppErrorBoundary label="Pocket Inventory"><PocketInventory /></AppErrorBoundary>} />
                    <Route path="/item/:id" element={<AppErrorBoundary label="Item Details"><CatalogDetail /></AppErrorBoundary>} />
                    <Route path="/villager/:id" element={<AppErrorBoundary label="Villager Details"><CatalogDetail /></AppErrorBoundary>} />
                    <Route path="/catalog/:entityType/:id" element={<AppErrorBoundary label="Catalog Details"><CatalogDetail /></AppErrorBoundary>} />
                    <Route path="/command-builder/:entityType/:id" element={<AppErrorBoundary label="Command Builder"><CatalogDetail /></AppErrorBoundary>} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/dodo" element={<DodoDecryptor />} />
                    <Route path="/order" element={<AppErrorBoundary label="Order Bot"><OrderBot /></AppErrorBoundary>} />
                    <Route path="/drop" element={<AppErrorBoundary label="Drop Bot"><DropBot /></AppErrorBoundary>} />
                    <Route path="/profile" element={<AppErrorBoundary label="Profile"><Profile /></AppErrorBoundary>} />
                    <Route path="/u/:username" element={<PublicProfile />} />
                    <Route path="/profile/:username" element={<PublicProfile />} />
                    <Route path="/trip-planner" element={<AppErrorBoundary label="Trip Planner"><TripPlanner /></AppErrorBoundary>} />
                    <Route path="/planner" element={<AppErrorBoundary label="Trip Planner"><TripPlanner /></AppErrorBoundary>} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    <Route path="/blog" element={<BlogList />} />
                    <Route path="/blog/:id" element={<BlogPost />} />

                    {/* Phase 2 pages */}
                    <Route path="/critters" element={<AppErrorBoundary label="Critters"><Critters /></AppErrorBoundary>} />
                    <Route path="/events" element={<AppErrorBoundary label="Events Calendar"><Events /></AppErrorBoundary>} />
                    <Route path="/npcs" element={<AppErrorBoundary label="NPCs & Birthdays"><NPCs /></AppErrorBoundary>} />
                    <Route path="/my-collection" element={<AppErrorBoundary label="My Collection"><MyCollection /></AppErrorBoundary>} />
                    <Route path="/wishlist" element={<AppErrorBoundary label="Wishlist"><Wishlist /></AppErrorBoundary>} />

                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/cookies" element={<CookiesPolicy />} />
                </Route>

                <Route element={<RequireMod />}>
                    <Route path="/dashboard" element={<DashboardLayout />}>
                        <Route index element={<DashboardHome />} />
                        <Route path="login" element={<DashboardHome />} />
                        <Route path="islands" element={<DashboardIslands />} />
                        <Route path="bundles" element={<DashboardBundles />} />
                        <Route path="islands/:id" element={<DashboardIslandDetail />} />
                        <Route path="logs" element={<DashboardLogs />} />
                        <Route path="auth-log" element={<DashboardWebsiteLogins />} />
                        <Route path="status" element={<Navigate to="/dashboard/islands" replace />} />
                        <Route path="analytics" element={<DashboardAnalytics />} />
                        <Route path="database" element={<DashboardDatabase />} />
                        <Route path="ops" element={<DashboardOps />} />
                        <Route path="incidents" element={<DashboardIncidents />} />
                        <Route path="trust" element={<DashboardTrust />} />
                        <Route path="player" element={<DashboardPlayerLookup />} />
                        <Route path="leaderboard" element={<DashboardLeaderboard />} />
                        <Route path="bulk" element={<DashboardBulkActions />} />
                        <Route path="audit" element={<DashboardAuditLog />} />
                        <Route path="scheduled" element={<DashboardScheduled />} />
                        <Route path="maintenance" element={<DashboardMaintenance />} />
                        <Route path="devices" element={<DashboardDevices />} />
                    </Route>
                </Route>
                <Route path="/dashboard/forbidden" element={<DashboardForbidden />} />
                <Route path="*" element={<Chopaeng404 />} />
            </Routes>
        </Suspense>
    );
};
export default AppRoutes;
