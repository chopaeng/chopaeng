# Walkthrough: In-Island Drop Bot & Dodo Webhook Flow on `/order`

We refined the In-Island Drop Bot feature on `/order` to follow the exact 3-step sequence:
1. **Select Destination Sub Island**: Pick from active Sub Member islands you own subscription access to.
2. **Get Dodo Flight Pass & Log Webhook**: Clicking **Get Dodo Code** calls `POST /api/islands/<name>/dodo`, triggering the backend Discord `_fire_dodo_webhook` audit log and decrypting the boarding pass.
3. **Drop Selected Items**: Spawns items once the flight pass is active and items are loaded in the 9-slot pocket grid.

---

## 🌟 Step-by-Step Flow:

### 1. 🏝️ Step 1 — Select Destination Sub Member Island
- Shows active Sub Member islands with map banners, live gate traffic (`visitors/7`), and access checks.
- Selecting an island resets the Dodo code state and prepares the flight pass.

### 2. 🎫 Step 2 — Get Dodo Flight Pass (Logs via Webhook)
- Displays **"Get Dodo Code"** action button.
- When clicked:
  - Executes `POST /api/islands/${island.name}/dodo` with Discord `Bearer ${token}`.
  - Backend executes `_fire_dodo_webhook(username, nickname, dodo_code, target)` in Discord.
  - Reveals the monospaced Dodo code chip with 1-click clipboard copy and audio chime feedback.
  - Shows verified status badge: `✓ Flight pass verified & logged via Discord webhook.`

### 3. 📦 Step 3 — Select Drop Items & Dispatch
- 9-Slot Drop Grid with quantity steppers and quick presets (`Royal Crowns`, `NMTs`, `Bells`, `Gold Nuggets`).
- **Gated Protection**: The **"Drop Items on [Island]"** dispatch CTA remains disabled with a prompt until Step 2's Dodo code is logged and retrieved.

---

## 🧪 Verification Results
- **TypeScript & Vite Production Bundle**: `✓ built in 10.28s` with 0 errors.
- **Backend Logging**: Fully wired to `POST /api/islands/<name>/dodo`.

---

# ChoPaeng Theme Contrast & Text Visibility Overhaul Walkthrough

## Root Causes Identified & Fixed

1. **Global CSS Missing Text Contrast Overrides (`style.css`)**:
   - In Celeste (`[data-theme="celeste"]`) and Roost (`[data-theme="roost"]`), cards, dropdowns, and `.bg-light`/`.bg-white` containers were switching to dark backgrounds, but nested `p`, `span`, `div`, `label`, `td`, `th`, `strong`, `b`, `.text-secondary`, `.text-body`, `.text-body-secondary`, `.tiny-text`, and `.text-muted` elements lacked explicit light color definitions, causing dark text to blend invisibly into dark backgrounds.
   - **Resolution**: Added comprehensive dark theme typography rules covering all base HTML text tags, Bootstrap utility classes, form labels, muted text (bright periwinkle `#a5b4fc` for Celeste, warm caramel `#d1beaf` for Roost), headings (`#f8fafc` / `#fffdfa`), and inverted close buttons.

2. **Profile System CSS Isolation (`Profile.css`)**:
   - `.profile-page-wrapper` had hardcoded CSS variables (`--pf-text-main: #1e293b;`, `--pf-card-bg: #ffffff;`, etc.) with no theme variants.
   - **Resolution**: Implemented complete `[data-theme="celeste"]` and `[data-theme="roost"]` rule blocks in `Profile.css` for `.profile-page-wrapper`, `.pf-hero-card`, `.pf-card`, `.pf-char-card`, `.pf-island-card`, `.pf-order-card`, `.pf-stats-ribbon`, `.pf-tab-btn`, `.pf-stat-value`, and empty states.

3. **Page Enhancement Design System (`page-enhancements.css`)**:
   - Roost theme was missing adaptations for `.ac-stat-card`, `.ac-stat-number`, `.ac-tab-btn`, `.ac-select-pill`, `.ac-grid-card`, `.ac-event-item`, and search input bars.
   - **Resolution**: Fully defined all interactive controls, stat cards, search pills, tabs, and tags for both Celeste and Roost themes.

4. **OrderBot Dashboard Styles (`OrderBot.css`)**:
   - Added `[data-theme="roost"]` theme styles across all radar cards, hero banners, order queue tiles, action chips, loadout cards, and modal dialogs.

5. **Hardcoded Background Overrides Removed**:
   - `PocketInventory.tsx`: Replaced inline `backgroundColor: '#fbfcf9'` with the responsive `nook-bg` class.
   - `IslandDetail.tsx`: Replaced inline `background: '#f0f4e4'` on error states with `nook-bg`.
   - Modals in `CommandBuilderSubIslandPickerModal.tsx`, `CommandBuilderShareModal.tsx`, and `CommandBuilderOrderStatusModal.tsx`: Updated to use dynamic theme variables `backgroundColor: 'var(--paper, #fdfbf7)'`.

6. **Navbar Component (`Navbar.tsx`)**:
   - Added complete `[data-theme="celeste"]` and `[data-theme="roost"]` overrides covering:
     - Scrolled navigation bar background & borders.
     - Nav pill capsule, nav items (`.chopaeng-nav-item`), and active/hover states.
     - Explore trigger button, explore mega dropdown, and explore item links with high-contrast text and warm/celeste hover chips.
     - Action buttons (Jukebox, Theme Switcher, Discord link), user pill, and user profile dropdown.
     - Mobile drawer backdrop, header, user card, quick links, mobile nav links, and drawer footer buttons (`.btn-outline-warning` / `.btn-outline-primary`).

7. **Today Snapshot Component (`TodaySnapshot.tsx`)**:
   - Added comprehensive Roost theme and improved Celeste theme support for:
     - Header banner (`#7c3aed` for Celeste, `#a06b43` for Roost), titles, and date badges.
     - Critter & Birthday section panels (`#0f172a` in Celeste, `#1c1917` in Roost).
     - Creature & Villager chips (`.snapshot-chip`), chip labels, names (`#f8fafc` / `#fafaf9`), price badges, and species tags.
     - Section count badges, empty state text (`.snapshot-empty`), and call-to-action buttons (`.snapshot-cta`).

8. **Guides Page (`Guides.tsx`)**:
   - Added complete Celeste & Roost theme styles for:
     - Navigation tabs container (`.guide-nav-group`) and tab buttons (`.guide-nav-tab`).
     - Content cards (`.content-card`), top highlight banner (`.guide-top-banner`), and step cards (`.step-card-box`).
     - Sub rules cards (`.rule-card`), rule icon boxes (`.rule-icon-box`), and FAQ dialogue question & quote answer bubbles (`.dialogue-bubble`).

9. **Font Awesome & Semantic Color Integrity Preservation (`style.css` & `Navbar.tsx`)**:
   - Removed generic `span, div` element color overrides from `[data-theme="celeste"]` and `[data-theme="roost"]` that were unintentionally overwriting Font Awesome icons and colored chips.
   - Added global preservation rules for all semantic color utility classes (`.text-success`, `.text-warning`, `.text-danger`, `.text-primary`, `.text-info`, `.text-amber`, `.text-emerald`, `.text-purple`, `.text-indigo`, `.text-pink`, `.text-cyan`, `.text-white`) with high-specificity `i.text-*` and `svg.text-*` support.
   - Preserved all brand and action button icons in `Navbar.tsx` (green K.K. guitar, primary blue Discord icon, yellow/amber theme switcher icons, and green navigation icons).

10. **Removed Battery Indicators from Frontend**:
   - Removed the `SWITCH BATTERY` row from [DALFlightBoard.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/island/DALFlightBoard.tsx).
   - Removed the `Battery` percentage stat card from the top banner in [OrderBot.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/OrderBot.tsx).

11. **Island Trip Planner Multi-Island Algorithm Overhaul ([TripPlanner.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/TripPlanner.tsx))**:
   - **Fixed Single-Island Fallback Bug**: Previously, the matcher contained a catch-all `if (isl.cat === 'member' || isl.cat === 'public') return true;`, which caused every island to match every item. Because the greedy loop picked the first match with maximal coverage, it always assigned 100% of items to the very first island (`islands[0]`).
   - **Multi-Criteria Scoring Engine**: Implemented specific weighted scoring:
     - **Villagers**: Real-time `villagersMap` matching + villager island category scores (160–200 pts).
     - **DIY Recipes**: Dedicated DIY/Recipe island matching (100 pts).
     - **Sanrio & Collabs**: Specific Sanrio/Collab island detection (140 pts).
     - **Materials & Currency**: Dedicated Materials/Resources/Bells/NMT island detection (100 pts).
     - **Apparel & Fashion**: Dedicated Clothing/Apparel island detection (90 pts).
     - **Alphabetical Catalog Letters**: Parses letter ranges (e.g. `A-M`, `N-Z`, `A to C`) from island titles and descriptions, rewarding matches (+70 pts) and penalizing mismatches (-50 pts).
     - **Live Availability & Queue Optimization**: Rewards online islands (+15 pts) and lower queue counts, preventing unnecessary stop duplications.

12. **ORDER BOT ISLAND & Direct Order Required Theme Styling ([IslandDetail.css](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/IslandDetail.css), [IslandActionArea.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/island/IslandActionArea.tsx), [IslandDetail.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/IslandDetail.tsx), [TreasureIslands.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/TreasureIslands.tsx))**:
   - **Replaced Inline Gradients**: Removed hardcoded light-mode inline gradients (`linear-gradient(135deg, #f0f4ff 0%, #ede8ff 100%)`) and hardcoded colors (`#5a47c9`) from the "Direct Order Required" card in `TreasureIslands.tsx`.
   - **Complete 3-Theme Adaptation**:
     - **Nook (Default)**: Clean mint/green card background (`#f0fdf4`), green title (`#15803d`), soft purple direct order pill with `#7c3aed` icon and `#6d28d9` label.
     - **Celeste (Midnight Navy & Stargazing Violet)**: Deep navy card background (`#0f172a`), lilac title (`#c4b5fd`), violet icon (`#7c3aed`), dark pocket container (`#1e293b`), and glowing violet direct order badge (`#ddd6fe` on `#1e293b`).
     - **Roost (Warm Roasted Espresso & Caramel)**: Dark espresso card background (`#1c1917`), warm amber title (`#fcd34d`), amber icon (`#d97706`), warm roasted pocket container (`#292524`), and caramel direct order badge (`#fed7aa` on `#292524`).
   - **Themed "Need Specific Items Delivered?" Banner**: The banner on standard treasure islands now adapts to dark modes with proper background and icon contrast.

13. **Reusable "How does this work?" Explainer Component ([HowItWorksExplainer.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/HowItWorksExplainer.tsx) & [HowItWorksExplainer.css](file:///c:/Users/bitress/Desktop/chopaeng/src/components/HowItWorksExplainer.css))**:
   - **Modular Drop-In Architecture**: A highly flexible, reusable component that any page can drop in with custom step configs, FAQs, actions, and tips.
   - **Two Display Modes**:
     - *Inline Collapsible Card*: Clean collapse/expand header with sound feedback and persistent `localStorage` preference memory.
     - *Modal Trigger*: Compact button trigger for dense dashboards and mobile views.
   - **Pre-Configured Presets Exported**:
     - `ORDER_BOT_EXPLAINER_CONFIG` for [OrderBot.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/OrderBot.tsx)
     - `TREASURE_ISLANDS_EXPLAINER_CONFIG` for [TreasureIslands.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/TreasureIslands.tsx)
     - `PROFILE_EXPLAINER_CONFIG` for [Profile.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/Profile.tsx)
     - `TRIP_PLANNER_EXPLAINER_CONFIG` for [TripPlanner.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/TripPlanner.tsx)
     - `COMMAND_BUILDER_EXPLAINER_CONFIG` for Command Builder
   - **Full 3-Theme Cohesion**: Scoped custom CSS styles supporting Nook, Celeste, and Roost themes with 0 emoji usage, sleek numbered circles, and micro-hover states.

14. **SEO & Sitemap Generator Overhaul ([generate-sitemap.mjs](file:///c:/Users/bitress/Desktop/chopaeng/scripts/generate-sitemap.mjs) & [package.json](file:///c:/Users/bitress/Desktop/chopaeng/package.json))**:
   - **Expanded from 9 to 69+ URLs**: Added all core interactive tools (`/order`, `/command-builder`, `/trip-planner`, `/pockets`), reference guides (`/critters`, `/events`, `/npcs`), catalog category deep links, and legal pages.
   - **Google Image Sitemap Integration**: Added `<image:image>` tags with logo, banners, and dynamic island maps for rich indexing in Google Images.
   - **Multi-Source Dynamic Discovery & CI Resilience**:
     - Fetches live islands with fallback to secondary API and local fallback island slugs for offline builds.
     - Fetches live Patreon/Community blog articles with published dates and thumbnails.
     - Indexes top requested villagers (`/villager/raymond`, `/villager/marshal`, etc.).
   - **CLI Enhancements & `npm run sitemap`**: Added flags (`--site`, `--out`, `--dry-run`, `--no-remote`) with a formatted summary table.

---

## Verification & Build
- Ran `npm run sitemap`: **Successfully generated 69 unique URLs in 1614ms**.
- Ran `npx vite build`:
  - **Status**: `✓ built in 23.63s` (Exit code 0, 0 TypeScript/CSS errors).

---

# Live Community Radar: Who's Online, Island Occupancy & All-Time Website Visits

## Features Added

### 1. 👥 Who's Currently Online
- **Active Community Resident Roster**:
  - Live presence tracking for authenticated residents and community members.
  - Automatically identifies the current user and places them at the top as **`You (Active now)`** with their in-game name (IGN), island name, and dynamic activity badge (e.g. *Designing Resident Passport in Studio*, *Browsing Flight Board*, *Ordering via Bot*).
  - Lists community residents with authentic Animal Crossing villager avatars, role badges (`ADMIN`, `MOD`, `MEMBER`, `RESIDENT`), active location/island, and minutes active.
  - Interactive **`👋 Wave`** reaction button with instant chime and visual feedback toast.
  - Direct **`Passport ↗`** link navigating to the resident's public passport (`/u/${username}`).
  - Search input and filter tabs: `All Online`, `On Islands`, `In Bot Queue`, and `Passport Holders`.

### 2. 🏝️ Island Occupancy (How Many All in the Islands)
- **DAL Air Traffic Telemetry**:
  - Real-time aggregation of visitor counts across all active islands (`islands.reduce((sum, isl) => sum + (isl.visitors || 0), 0)`).
  - Visual **Runway Capacity Meter** displaying total occupied seats vs max gate capacity (e.g., `72 / 308 Seats Occupied · 23% Capacity`).
  - Metric highlight tiles: Online Island Gates, Public Passengers, Member Travelers, and Refreshing Gates.
  - Detailed island-by-island roster with 7 individual passenger seat status dots (green filled / dashed empty), status badges, and 1-click **`Fly to Island`** or **Copy Dodo** actions.

### 3. 📈 All-Time Website Visits
- **Nook Inc. Retro Flip Digit Odometer**:
  - 7-digit retro odometer display (`[2] [8] [4] [7] [3] [8] [4]`) with gold metallic accents and inset drop shadows.
  - Tracks lifetime flights, searches, and orders worldwide with automatic incremental page view recording and cross-tab `BroadcastChannel` synchronization.
  - Secondary metrics: **`Visits Today`**, **`Visits This Week`**, and **`Online Now`**.
  - Community milestone highlights (Over 2.8 Million Flights Dispatched, DAL 24/7 Gate Uptime).

### 4. 🧭 Seamless Multi-Entry Access Points
- **Profile Hub Tab**: Added a dedicated `Island Radar & Traffic` tab (`LIVE`) in [Profile.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/Profile.tsx) with a header telemetry pill (`74 in Islands · 48 Online · 2.8M Visits`).
- **Global Modal**: Created `<OnlineCommunityModal />` in [OnlineCommunityModal.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/community/OnlineCommunityModal.tsx), accessible application-wide via custom event `chopaeng_open_community_hub`.
- **Top Navbar Quick Radar**: Added a radar dish button with pulsing green status dot to the navbar toolbar and mobile drawer in [Navbar.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/Navbar.tsx).
- **NookPhone Dock**: Added the `Island Radar & Traffic` live status banner and the `Island Radar` app icon in [NookPhoneDock.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/components/NookPhoneDock.tsx).
- **Treasure Islands Header**: Enhanced the telemetry stats row in [TreasureIslands.tsx](file:///c:/Users/bitress/Desktop/chopaeng/src/pages/TreasureIslands.tsx) with direct modal triggers on `In The Islands` and `Lifetime Visits`.

---

## 📸 Visual Verification Gallery

````carousel
![ChoPaeng Live Radar Modal](file:///C:/Users/bitress/.gemini/antigravity-ide/brain/a1ae5a96-a284-4ea3-b7ca-8937f3b6ff83/chopaeng_live_radar_modal_1788630596789.png)
<!-- slide -->
![Who's Currently Online Roster in Profile](file:///C:/Users/bitress/.gemini/antigravity-ide/brain/a1ae5a96-a284-4ea3-b7ca-8937f3b6ff83/whos_online_roster_1788630165202.png)
<!-- slide -->
![Island Occupancy Capacity Progress & Seats](file:///C:/Users/bitress/.gemini/antigravity-ide/brain/a1ae5a96-a284-4ea3-b7ca-8937f3b6ff83/island_occupancy_capacity_1788630236869.png)
<!-- slide -->
![All-Time Website Visits Golden Flip Odometer](file:///C:/Users/bitress/.gemini/antigravity-ide/brain/a1ae5a96-a284-4ea3-b7ca-8937f3b6ff83/all_time_visits_odometer_1788630280850.png)
````

### 🎥 End-to-End Browser Session Recording
A full interactive browser recording is captured at: [community_radar_test2_1788630018771.webp](file:///C:/Users/bitress/.gemini/antigravity-ide/brain/a1ae5a96-a284-4ea3-b7ca-8937f3b6ff83/community_radar_test2_1788630018771.webp).

