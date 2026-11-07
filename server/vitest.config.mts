import { defineConfig } from 'vitest/config'
import { testDatabaseUrl } from './test/env'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/test/**/*.test.ts'],
    globalSetup: ['server/test/global-setup.ts'],
    // Tes konkurensi butuh koneksi paralel ke database yang sama, tetapi tiap
    // file membersihkan tabel di beforeEach, jadi file dijalankan berurutan.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      NODE_ENV: 'test',
    },
  },
})
