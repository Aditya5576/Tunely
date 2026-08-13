import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  projects: [
    {
      name: 'iPhone SE',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'iPhone 15',
      use: {
        ...devices['iPhone 15'],
        viewport: { width: 393, height: 852 },
      },
    },
    {
      name: 'iPhone Pro Max',
      use: {
        ...devices['iPhone 15 Pro Max'],
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: 'Android small',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: 'Android large',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 412, height: 915 },
      },
    },
    {
      name: 'iPad',
      use: {
        ...devices['iPad Mini'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'Laptop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'Desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'Large desktop',
      use: {
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
