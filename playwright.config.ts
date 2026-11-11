import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Lokal liegt Chromium ggf. nicht am Standardort: PW_CHROMIUM_PATH=/pfad/zu/chrome setzen.
// In der CI bleibt die Variable leer; dort installiert `playwright install` den Browser.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    acceptDownloads: true,
    trace: 'off',
    launchOptions,
  },
  // Jeder Test bekommt einen frischen Kontext (leere IndexedDB), das ist Playwrights Standard.
  projects: [
    {
      name: 'iphone',
      // iPhone-14-Maße, aber Chromium statt WebKit (WebKit ist hier nicht installiert).
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium', browserName: 'chromium' },
    },
    {
      name: 'ipad-quer',
      use: {
        browserName: 'chromium',
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
