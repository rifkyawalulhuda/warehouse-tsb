/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:4000'

/**
 * Browser untuk tes frontend. Default memakai Chrome yang terpasang di sistem
 * (`channel: 'chrome'`) supaya `npm test` tidak menuntut unduhan Chromium
 * khusus Playwright. Di CI: `npx playwright install chromium` lalu set
 * `PLAYWRIGHT_CHANNEL=` (kosong) agar memakai browser bawaan Playwright.
 */
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Frontend dan API satu origin saat dev, supaya cookie sesi ikut terkirim
    // tanpa perlu mengatur CORS atau SameSite=None.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: false },
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    // Tes API punya config sendiri (server/vitest.config.mts, environment Node).
    // Tanpa ini Vitest ikut memungutnya dan menjalankannya di dalam browser.
    include: ['src/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: browserChannel ? { channel: browserChannel } : {},
      }),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
})
