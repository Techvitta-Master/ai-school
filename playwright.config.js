/* global process */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PW_BASE_URL || 'http://127.0.0.1:5173';

const webServer =
  process.env.PW_SKIP_WEBSERVER
    ? undefined
    : {
        command:
          process.env.PW_WEB_SERVER_COMMAND ||
          'npm run dev:web -- --host 0.0.0.0 --port 5173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      };

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
    baseURL,
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

  // Start **Vite only** (not `npm run dev`, which also runs the API server with
  // `node --env-file=.env`). CI often has no `.env`, so that process exits 1 and
  // Playwright fails with "webServer was not able to start".
  // Full stack: run `npm run dev` in another terminal and set PW_SKIP_WEBSERVER=1,
  // or set PW_WEB_SERVER_COMMAND when `.env` exists.
  ...(webServer ? { webServer } : {}),
});
