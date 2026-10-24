import { defineConfig, devices } from '@playwright/test';

// Runs against a preview deployment built with VITE_FLAG_DEV_LOGIN=1 (never production).
export default defineConfig({
    testDir: 'e2e',
    timeout: 120_000,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5183',
        viewport: { width: 1280, height: 720 },
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
});
