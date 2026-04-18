#!/usr/bin/env node
/**
 * Runs Playwright e2e unless SKIP_E2E=1 (e.g. CI without browsers / flaky infra).
 * Usage: npm run test:e2e
 */
import { spawnSync } from 'node:child_process';

if (process.env.SKIP_E2E === '1' || process.env.SKIP_E2E === 'true') {
  console.log('[test:e2e] SKIP_E2E is set — skipping Playwright tests.');
  process.exit(0);
}

const extra = process.argv.slice(2);
const result = spawnSync('npx', ['playwright', 'test', ...extra], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
