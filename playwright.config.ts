import { defineConfig } from '@playwright/test';

// Smoke tests against the production build: `npm run build && npm run e2e`.
// Set CHROMIUM_PATH to use a preinstalled browser instead of `npx playwright install chromium`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173/case-bearing-demo/',
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      // a synthetic microphone for the Signals Lab mic test
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/case-bearing-demo/',
    reuseExistingServer: true,
  },
});
