/* global process */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Per-test timeout: 90 s (happy-path is long)
  timeout: 90_000,

  // Keep retries off locally, 1 retry on CI
  retries: process.env.CI ? 1 : 0,

  // Run tests serially (1 worker) to avoid race conditions with the shared Vite dev server
  // on Windows. CI can override via the PW_WORKERS env var if a multi-worker setup is used.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,

  // Readable failure output
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    // Screenshot on failure only
    screenshot: 'only-on-failure',
    // Capture trace on first retry
    trace: 'on-first-retry',
    // Viewport close to a typical laptop
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Create fixtures + any teardown before/after the full run
  globalSetup: './e2e/global-setup.js',

  // On Windows, Vite/Tailwind v4 can't be spawned from Playwright's webServer
  // due to an ERR_WORKER_INIT_FAILED issue. Run `npm run dev` in a separate
  // terminal first, then execute `npm run test:e2e`.
  // In CI the server is expected to be started externally before the test run.
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0 --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,   // always reuse rather than re-spawn
    timeout: 30_000,
  },
});
