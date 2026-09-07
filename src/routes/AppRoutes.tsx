import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IndexLayout } from "../layouts/IndexLayout.tsx";
import RequireMod from "../components/RequireMod.tsx";
import DashboardLayout from "../layouts/DashboardLayout.tsx";

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
const Profile         = lazy(() => import("../pages/Profile.tsx"));
const PublicProfile   = lazy(() => import("../pages/PublicProfile.tsx"));
const TripPlanner     = lazy(() => import("../pages/TripPlanner.tsx"));
const AuthCallback    = lazy(() => import("../pages/AuthCallback.tsx"));
const BlogList        = lazy(() => import("../pages/BlogList.tsx"));
const BlogPost        = lazy(() => import("../pages/BlogPost.tsx"));
const PrivacyPolicy   = lazy(() => import("../pages/PrivacyPolicy.tsx"));
const TermsOfService  = lazy(() => import("../pages/TermsOfService.tsx"));
const CookiesPolicy   = lazy(() => import("../pages/CookiesPolicy.tsx"));

// --- Phase 2 pages (lazy-loaded) ---
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

/** Lightweight spinner shown while a route chunk is downloading */
const PageLoader = () => (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading…</span>
        </div>
    </div>
);

const AppRoutes = () => {
    return (
        <Suspense fallback={<PageLoader />}>
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
                    <Route path="/command-builder" element={<CommandBuilder />} />
                    <Route path="/pockets" element={<PocketInventory />} />
                    <Route path="/pocket-inventory" element={<PocketInventory />} />
                    <Route path="/item/:id" element={<CatalogDetail />} />
                    <Route path="/villager/:id" element={<CatalogDetail />} />
                    <Route path="/catalog/:entityType/:id" element={<CatalogDetail />} />
                    <Route path="/command-builder/:entityType/:id" element={<CatalogDetail />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/dodo" element={<DodoDecryptor />} />
                    <Route path="/order" element={<OrderBot />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/u/:username" element={<PublicProfile />} />
                    <Route path="/profile/:username" element={<PublicProfile />} />
                    <Route path="/trip-planner" element={<TripPlanner />} />
                    <Route path="/planner" element={<TripPlanner />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />

                    <Route path="/blog" element={<BlogList />} />
                    <Route path="/blog/:id" element={<BlogPost />} />

                    {/* Phase 2 pages */}
                    <Route path="/critters" element={<Critters />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/npcs" element={<NPCs />} />
                    <Route path="/my-collection" element={<MyCollection />} />
                    <Route path="/wishlist" element={<Wishlist />} />

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
