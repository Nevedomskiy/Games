import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] },
  },
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 15000 },
});
