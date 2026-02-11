import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load E2E environment variables from .env.e2e
dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });

export default defineConfig({
  testDir: 'tests/e2e',
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-first-failure',
    video: 'retain-on-first-failure',
  },
  // Automatically start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
