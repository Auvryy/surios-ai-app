import { defineConfig } from '@playwright/test';

const apiOrigin = process.env.SURIOS_TEST_API_ORIGIN || 'http://127.0.0.1:5185';
export default defineConfig({
  testDir: './tests', workers: 2, timeout: 30000,
  outputDir: 'test-results',
  projects: [
    { name: 'session', testMatch: 'session.spec.ts' },
    { name: 'browser', testMatch: ['auth.spec.ts', 'auth-live.spec.ts'], use: { browserName: 'chromium', baseURL: 'http://localhost:8082', headless: true, trace: 'off' } },
  ],
  webServer: {
    command: 'npx expo start --web --localhost --port 8082', url: 'http://localhost:8082/login',
    reuseExistingServer: false, timeout: 120000,
    env: { CI: '1', BROWSER: 'none', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_API_BASE_URL: apiOrigin },
  },
});
