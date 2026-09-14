#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ChoPaeng XML Sitemap Generator v2.0
 * 
 * Generates an SEO-optimized sitemap.xml with:
 *  - High-priority interactive tools (Order Bot, Command Builder, Trip Planner)
 *  - 2.0 Catalog, Critters, Events, Maps, Guides & Community pages
 *  - Live & fallback Treasure Island dynamic routes with map images
 *  - Live Patreon/Community Blog articles with publication timestamps
 *  - Popular Villager directory entries
 *  - Google Image Sitemap extension tags for rich search result snippets
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLI Arguments & Options ───────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};
const hasFlag = (flag) => args.includes(flag);

const SITE = (getArg('--site', process.env.SITE_URL || 'https://www.chopaeng.com')).replace(/\/+$/, '');
const OUT_PATH = path.resolve(__dirname, getArg('--out', '../public/sitemap.xml'));
const DRY_RUN = hasFlag('--dry-run');
const NO_REMOTE = hasFlag('--no-remote');
const FETCH_TIMEOUT_MS = 6000;

// ─── Helpers ───────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();

const esc = (s) =>
    String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const formatXmlDate = (dateVal) => {
    if (!dateVal) return nowIso();
    try {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? nowIso() : d.toISOString();
    } catch {
        return nowIso();
    }
};

/**
 * Generates an individual <url> XML entry with optional image metadata
 */
const renderUrlEntry = ({ loc, lastmod, changefreq = 'weekly', priority = '0.7', image }) => {
    const lines = [
        '  <url>',
        `    <loc>${esc(loc)}</loc>`,
        `    <lastmod>${esc(formatXmlDate(lastmod))}</lastmod>`,
        `    <changefreq>${esc(changefreq)}</changefreq>`,
        `    <priority>${esc(priority)}</priority>`,
    ];

    if (image && image.loc) {
        lines.push('    <image:image>');
        lines.push(`      <image:loc>${esc(image.loc)}</image:loc>`);
        if (image.title) {
            lines.push(`      <image:title>${esc(image.title)}</image:title>`);
        }
        lines.push('    </image:image>');
    }

    lines.push('  </url>');
    return lines.join('\n');
};

/**
 * Safe fetch with timeout and fallback
 */
async function fetchJsonSafe(url, timeoutMs = FETCH_TIMEOUT_MS) {
    if (NO_REMOTE) return null;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'ChoPaeng-Sitemap-Generator/2.0' },
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        return null;
    }
}

// ─── 1. Static Core Pages ──────────────────────────────────────────────────
function getStaticPages() {
    const now = nowIso();

    return [
        // Top Priority Tier: Core Landing & Interactive Tools
        { loc: `${SITE}/`, changefreq: 'daily', priority: '1.0', lastmod: now, image: { loc: `${SITE}/logo.webp`, title: 'ChoPaeng Animal Crossing Community' } },
        { loc: `${SITE}/islands`, changefreq: 'daily', priority: '0.95', lastmod: now },
        { loc: `${SITE}/order`, changefreq: 'daily', priority: '0.95', lastmod: now },
        { loc: `${SITE}/drop`, changefreq: 'daily', priority: '0.95', lastmod: now },
        { loc: `${SITE}/command-builder`, changefreq: 'weekly', priority: '0.90', lastmod: now },
        { loc: `${SITE}/trip-planner`, changefreq: 'daily', priority: '0.90', lastmod: now },

        // High Priority Tier: Catalog, Finder & Inventory Tools
        { loc: `${SITE}/find`, changefreq: 'daily', priority: '0.85', lastmod: now },
        { loc: `${SITE}/catalog`, changefreq: 'weekly', priority: '0.85', lastmod: now },
        { loc: `${SITE}/maps`, changefreq: 'daily', priority: '0.85', lastmod: now },
        { loc: `${SITE}/pockets`, changefreq: 'weekly', priority: '0.80', lastmod: now },

        // Reference & Explorer Guides
        { loc: `${SITE}/critters`, changefreq: 'monthly', priority: '0.80', lastmod: now },
        { loc: `${SITE}/events`, changefreq: 'weekly', priority: '0.80', lastmod: now },
        { loc: `${SITE}/guides`, changefreq: 'weekly', priority: '0.80', lastmod: now },
        { loc: `${SITE}/npcs`, changefreq: 'monthly', priority: '0.75', lastmod: now },
        { loc: `${SITE}/blog`, changefreq: 'weekly', priority: '0.75', lastmod: now, image: { loc: `${SITE}/banner.png`, title: 'ChoPaeng News & Announcements' } },

        // Community & Account Tools
        { loc: `${SITE}/membership`, changefreq: 'monthly', priority: '0.70', lastmod: now },
        { loc: `${SITE}/my-collection`, changefreq: 'monthly', priority: '0.70', lastmod: now },
        { loc: `${SITE}/wishlist`, changefreq: 'monthly', priority: '0.70', lastmod: now },
        { loc: `${SITE}/dodo`, changefreq: 'monthly', priority: '0.65', lastmod: now },
        { loc: `${SITE}/about`, changefreq: 'monthly', priority: '0.60', lastmod: now },
        { loc: `${SITE}/contact`, changefreq: 'monthly', priority: '0.60', lastmod: now },

        // Legal & Compliance
        { loc: `${SITE}/privacy`, changefreq: 'yearly', priority: '0.30', lastmod: now },
        { loc: `${SITE}/terms`, changefreq: 'yearly', priority: '0.30', lastmod: now },
        { loc: `${SITE}/cookies`, changefreq: 'yearly', priority: '0.30', lastmod: now },
    ];
}

// ─── 2. Catalog Categories (SEO Deep Links) ────────────────────────────────
function getCatalogCategoryPages() {
    const categories = [
        'Housewares',
        'Miscellaneous',
        'Wall-mounted',
        'Ceiling-decor',
        'Clothing',
        'Recipes',
        'Villagers',
        'Art',
        'Fossils',
        'Gyroids',
        'Photos',
        'Materials',
    ];

    const now = nowIso();
    return categories.map((cat) => ({
        loc: `${SITE}/catalog?category=${encodeURIComponent(cat)}`,
        changefreq: 'weekly',
        priority: '0.75',
        lastmod: now,
    }));
}

// ─── 3. Dynamic Treasure Island URLs ────────────────────────────────────────
const cleanUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const match = String(rawUrl).match(/https?:\/\/[^\s)\]]+/);
    return match ? match[0] : String(rawUrl).trim();
};

const extractArray = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && typeof res === 'object') {
        for (const v of Object.values(res)) {
            if (Array.isArray(v)) return v;
        }
    }
    return [];
};

async function getIslandPages() {
    const now = nowIso();
    let rawRes = null;

    // Try primary console API
    rawRes = await fetchJsonSafe('https://console.chopaeng.com/api/islands');
    
    // Fallback to secondary API endpoints
    if (!rawRes) {
        rawRes = await fetchJsonSafe('https://api.chopaeng.com/api/islands');
    }

    const islands = extractArray(rawRes);

    // If API returned valid islands
    if (islands.length > 0) {
        return islands
            .filter((isl) => isl && (isl.id || isl.name))
            .map((isl) => {
                const islandId = isl.id || String(isl.name).toLowerCase().replace(/\s+/g, '-');
                const rawMap = cleanUrl(isl.map_url || isl.mapUrl);
                const updatedAt = isl.updated_at || isl.updatedAt;

                return {
                    loc: `${SITE}/island/${encodeURIComponent(islandId)}`,
                    lastmod: updatedAt ? formatXmlDate(updatedAt) : now,
                    changefreq: 'daily',
                    priority: '0.85',
                    image: rawMap ? {
                        loc: rawMap.startsWith('http') ? rawMap : `${SITE}${rawMap}`,
                        title: `${isl.name || islandId} Island Map`,
                    } : undefined,
                };
            });
    }

    console.log('ℹ️  [Sitemap] No live islands endpoint responded, skipping dynamic island subpages.');
    return [];
}

// ─── 4. Dynamic Blog Post URLs ──────────────────────────────────────────────
async function getBlogPostPages() {
    let postsData = null;

    postsData = await fetchJsonSafe('https://console.chopaeng.com/api/patreon/posts');
    if (!postsData?.data) {
        postsData = await fetchJsonSafe('https://api.chopaeng.com/api/patreon/posts');
    }

    if (postsData?.data && Array.isArray(postsData.data)) {
        return postsData.data
            .filter((p) => p && p.id)
            .map((p) => {
                const attr = p.attributes || {};
                const img = attr.image?.large_url || attr.image?.url;
                return {
                    loc: `${SITE}/blog/${p.id}`,
                    lastmod: attr.published_at ? formatXmlDate(attr.published_at) : nowIso(),
                    changefreq: 'monthly',
                    priority: '0.70',
                    image: img ? {
                        loc: img,
                        title: attr.title || `ChoPaeng Article #${p.id}`,
                    } : undefined,
                };
            });
    }

    return [];
}

// ─── 5. Villagers Directory (SEO Profile Pages) ─────────────────────────────
async function getVillagerPages() {
    const now = nowIso();
    try {
        const { villagers } = await import('@bitress/animal-crossing');
        if (Array.isArray(villagers) && villagers.length > 0) {
            return villagers
                .filter((v) => v && v.name)
                .map((v) => {
                    const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    const img = v.iconImage || v.photoImage;
                    return {
                        loc: `${SITE}/villager/${encodeURIComponent(slug)}`,
                        lastmod: now,
                        changefreq: 'monthly',
                        priority: '0.65',
                        image: img ? {
                            loc: img,
                            title: `${v.name} - Animal Crossing New Horizons Villager`,
                        } : undefined,
                    };
                });
        }
    } catch {
        console.log('ℹ️  [Sitemap] Animal Crossing dataset not loaded, falling back to popular villagers.');
    }

    const topVillagers = [
        'raymond', 'marshal', 'judy', 'ankha', 'coco', 'stitches',
        'fauna', 'sherb', 'punchy', 'bob', 'shino', 'sasha', 'ione', 'audie', 'dom'
    ];

    return topVillagers.map((v) => ({
        loc: `${SITE}/villager/${v}`,
        lastmod: now,
        changefreq: 'monthly',
        priority: '0.65',
    }));
}

// ─── Main Generator ────────────────────────────────────────────────────────
async function main() {
    const startTime = Date.now();

    console.log(`\n🏝️  Generating ChoPaeng Sitemap for: ${SITE}`);

    // Collect all URL sets in parallel
    const [staticPages, catalogCategories, islandPages, blogPages, villagerPages] = await Promise.all([
        Promise.resolve(getStaticPages()),
        Promise.resolve(getCatalogCategoryPages()),
        getIslandPages(),
        getBlogPostPages(),
        getVillagerPages(),
    ]);

    // Combine & deduplicate by location
    const urlMap = new Map();
    const allGroups = [
        ...staticPages,
        ...catalogCategories,
        ...islandPages,
        ...blogPages,
        ...villagerPages,
    ];

    for (const entry of allGroups) {
        if (!urlMap.has(entry.loc)) {
            urlMap.set(entry.loc, entry);
        }
    }

    const uniqueUrls = Array.from(urlMap.values());

    // Generate XML output
    const xmlContent = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset',
        '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '  xmlns:xhtml="http://www.w3.org/1999/xhtml"',
        '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
        '>',
        '',
        uniqueUrls.map(renderUrlEntry).join('\n\n'),
        '',
        '</urlset>',
        '',
    ].join('\n');

    if (!DRY_RUN) {
        // Ensure parent directory exists
        const dir = path.dirname(OUT_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(OUT_PATH, xmlContent, 'utf8');
    }

    const duration = Date.now() - startTime;
    const fileSizeKb = (Buffer.byteLength(xmlContent, 'utf8') / 1024).toFixed(2);

    // Formatted CLI Summary Report
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│             ChoPaeng XML Sitemap Generator v2.0             │
├─────────────────────────────────────────────────────────────┤
│  • Static Routes:        ${String(staticPages.length).padStart(4)} pages                        │
│  • Catalog Categories:   ${String(catalogCategories.length).padStart(4)} categories                   │
│  • Island Destinations:  ${String(islandPages.length).padStart(4)} islands                      │
│  • Blog Articles:        ${String(blogPages.length).padStart(4)} posts                        │
│  • Popular Villagers:    ${String(villagerPages.length).padStart(4)} profiles                     │
├─────────────────────────────────────────────────────────────┤
│  ✓ Total Unique URLs:    ${String(uniqueUrls.length).padStart(4)} URLs                         │
│  ✓ Output File:          ${path.relative(process.cwd(), OUT_PATH)} (${fileSizeKb} KB)
│  ✓ Generation Time:      ${duration}ms                                │
└─────────────────────────────────────────────────────────────┘
`);

    if (DRY_RUN) {
        console.log('🔍 [Dry-Run] Sitemap XML generated in-memory without writing to disk.');
    }
}

main().catch((err) => {
    console.error('❌ Failed to generate sitemap:', err);
    process.exit(1);
});
