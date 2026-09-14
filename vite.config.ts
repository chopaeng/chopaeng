import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

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
    plugins: [react()],
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
                        if (id.includes('Items.json')) {
                            return 'ac-items';
                        }
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

