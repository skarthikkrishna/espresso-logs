/**
 * Playwright global setup — real-login harness.
 *
 * Performs a real authentication cycle so every test runs with a genuine
 * browser session (rt httpOnly cookie) rather than the removed e2e-bypass
 * Authorization header.
 *
 * Steps:
 *   1. POST /api/e2e/seed-user  — ensure the E2E test user and household exist
 *   2. POST /api/e2e/session    — obtain access token + rt cookie (no rate limit)
 *   3. Save storageState        — write playwright/.auth/user.json for reuse
 *
 * Backend must be running with E2E_AUTH_BYPASS=1 and APP_ENV=local.
 */

import { chromium, type FullConfig } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

const AUTH_STATE_PATH = 'playwright/.auth/user.json';
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await mkdir('playwright/.auth', { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();

  try {
    // --- Step 1: ensure E2E seed user + household exist ---
    const seedRes = await context.request.post(`${BASE}/api/e2e/seed-user`, {
      data: { username: 'user', password: 'password' },
    });

    if (!seedRes.ok()) {
      const status = seedRes.status();
      const body = await seedRes.text();

      if (status === 404 || status === 502) {
        // Alex's endpoint not yet implemented — write empty state and warn.
        // auth-refresh-* tests (which mock all routes) will still pass.
        // Smoke and catalog tests will fail until the endpoint is available.
        console.warn(
          `\n[global-setup] WARNING: POST /api/e2e/seed-user returned ${status}.\n` +
            'Backend-backed E2E tests require the FastAPI test server; mocked specs can still run.\n' +
            'Writing empty storageState — auth-refresh-* tests will still pass.\n',
        );
        await writeFile(AUTH_STATE_PATH, EMPTY_STATE, 'utf8');
        return;
      }

      throw new Error(
        `[global-setup] POST /api/e2e/seed-user failed (${status}): ${body}`,
      );
    }

    // --- Step 2: create a fresh E2E session (no rate limit) ---
    const loginRes = await context.request.post(`${BASE}/api/e2e/session`);

    if (!loginRes.ok()) {
      const body = await loginRes.text();
      throw new Error(
        `[global-setup] POST /api/e2e/session failed (${loginRes.status()}): ${body}`,
      );
    }

    // --- Step 3: persist cookies (rt httpOnly cookie) for test contexts ---
    await context.storageState({ path: AUTH_STATE_PATH });

    console.log('[global-setup] storageState written to', AUTH_STATE_PATH);

    // --- Step 4: reset rate-limit counters so /auth/refresh isn't exhausted ---
    // Soft-guarded: if Alex's endpoint isn't merged yet, warn and continue.
    try {
      const rlRes = await context.request.post(`${BASE}/api/e2e/reset-limiter`);
      if (rlRes.status() === 204) {
        console.log('[global-setup] Rate-limit counters reset via /api/e2e/reset-limiter');
      } else {
        console.warn(
          `\n[global-setup] WARNING: POST /api/e2e/reset-limiter returned ${rlRes.status()} (expected 204).\n` +
            'Rate-limit counters were NOT reset — /auth/refresh may be exhausted mid-suite.\n' +
            'Alex must implement this endpoint to prevent rate-limit flakiness.\n',
        );
      }
    } catch {
      console.warn(
        '\n[global-setup] WARNING: POST /api/e2e/reset-limiter threw — endpoint may not exist yet.\n' +
          'Continuing without rate-limit reset.\n',
      );
    }
  } catch (err) {
    // If backend is not running, write empty state so auth-refresh tests still pass.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      console.warn(
        '\n[global-setup] WARNING: Backend not reachable at', BASE,
        '\nWriting empty storageState — auth-refresh-* tests will still pass.\n',
      );
      await writeFile(AUTH_STATE_PATH, EMPTY_STATE, 'utf8');
    } else {
      // Unexpected error — re-throw to fail the run visibly.
      await writeFile(AUTH_STATE_PATH, EMPTY_STATE, 'utf8');
      throw err;
    }
  } finally {
    await context.close();
    await browser.close();
  }
}
