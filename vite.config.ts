import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Set GITHUB_PAGES=true and optionally GH_PAGES_REPO=your-repo-name when building for GitHub Pages
const ghPages = process.env.GITHUB_PAGES === 'true'
const repoName = process.env.GH_PAGES_REPO || 'AirconDuctOrder'

export default defineConfig({
  base: ghPages ? `/${repoName}/` : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ECOVENT Dispatch',
        short_name: 'Dispatch',
        description: 'Mobile dispatch app for ECOVENT duct orders',
        theme_color: '#009888',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/m',
        scope: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
