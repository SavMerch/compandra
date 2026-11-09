import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', timeout: 60000, workers: 1, reporter: 'line',
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'allow', actionTimeout: 8000, launchOptions: { executablePath: process.env.PW_CHROME || undefined } },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testMatch: /mobile/ }, { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testMatch: /desktop/ }],
  webServer: { command: 'VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite build && npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 120000 },
});
