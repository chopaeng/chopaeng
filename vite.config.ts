import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'https://console.chopaeng.com',
                changeOrigin: true,
                secure: false,
            },
            '/dashboard/api': {
                target: 'https://console.chopaeng.com',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    resolve: {
        alias: [
            { find: 'react-helmet-async', replacement: path.resolve(__dirname, 'node_modules/react-helmet-async/lib/index.js') },
            { find: '@bitress/animal-crossing/lib', replacement: path.resolve(__dirname, 'node_modules/@bitress/animal-crossing/lib') },
            { find: /^@bitress\/animal-crossing$/, replacement: path.resolve(__dirname, 'node_modules/@bitress/animal-crossing/lib/index.js') },
        ]
    },
    plugins: [
        react(),
        {
            // Split Items.json from node_modules into two lean public assets:
            //   • Items-data.json        – all fields except `translations` (used by explorerDataLoader)
            //   • Items-translations.json – only `name` + `translations`   (used by translationSearch)
            //
            // The raw Items.json is ~29 MiB which exceeds Cloudflare Workers' 25 MiB per-asset
            // limit even as a plain static file, so we cannot serve it directly.
            name: 'split-items-json',
            buildStart() {
                const src = path.resolve(__dirname, 'node_modules/@bitress/animal-crossing/lib/data/Items.json');
                if (!fs.existsSync(src)) {
                    console.warn('[split-items-json] Items.json not found in node_modules');
                    return;
                }

                const items: any[] = JSON.parse(fs.readFileSync(src, 'utf-8'));

                // Items-data.json — strip translations to keep the catalog data lean
                const dataItems = items.map(({ translations: _t, ...rest }) => rest);
                fs.writeFileSync(
                    path.resolve(__dirname, 'public/Items-data.json'),
                    JSON.stringify(dataItems),
                );

                // Items-translations.json — only the fields needed for cross-language search
                const translationItems = items.map((item: any) => ({
                    name: item.name,
                    translations: item.translations ?? {},
                }));
                fs.writeFileSync(
                    path.resolve(__dirname, 'public/Items-translations.json'),
                    JSON.stringify(translationItems),
                );

                console.log('[split-items-json] Wrote Items-data.json and Items-translations.json to public/');
            },
        },
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // Animal Crossing Database - granular chunks for on-demand loading
                    if (id.includes('@bitress/animal-crossing')) {
                        if (id.includes('Villagers.json') || id.includes('NPCs.json')) {
                            return 'ac-villagers';
                        }
                        if (id.includes('Creatures.json')) {
                            return 'ac-creatures';
                        }
                        if (id.includes('Recipes.json')) {
                            return 'ac-recipes';
                        }
                        if (id.includes('SeasonsAndEvents.json')) {
                            return 'ac-events';
                        }
                        if (id.includes('Construction.json') || id.includes('Reactions.json') || id.includes('Achievements.json')) {
                            return 'ac-misc';
                        }
                        // Items.json is NOT bundled — it is served as a static public
                        // asset (public/Items.json) and fetched at runtime to stay under
                        // the Cloudflare Workers 25 MiB per-asset limit.
                        if (id.includes('Translations.json')) {
                            return 'ac-translations';
                        }
                        return 'ac-core';
                    }
                    // Simple-datatables (only used on Profile page)
                    if (id.includes('node_modules/simple-datatables')) {
                        return 'vendor-datatables';
                    }
                    // All other node_modules go into a unified vendor chunk to avoid circular chunk dependencies with React
                    if (id.includes('node_modules/')) {
                        return 'vendor';
                    }
                },
            },
        },
    },
})

