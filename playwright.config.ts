import { defineConfig } from "@playwright/test";

// HTTPS fixture origin also exercises the release origin policy; no live server is contacted.
const apiOrigin =
  process.env.SURIOS_TEST_API_ORIGIN || "https://mobile-api.surios.test";
process.env.SURIOS_TEST_API_ORIGIN = apiOrigin;
export default defineConfig({
  testDir: "./tests",
  workers: 2,
  timeout: 30000,
  outputDir: "test-results",
  projects: [
    {
      name: "session",
      testMatch: ["session.spec.ts", "report-controller.spec.ts", "profile-contracts.spec.ts", "settings-contracts.spec.ts"],
    },
    {
      name: "browser",
      testMatch: [
        "auth.spec.ts",
        "auth-live.spec.ts",
        "reporting.spec.ts",
        "reporting-live.spec.ts",
        "profile.spec.ts",
        "profile-live.spec.ts",
      ],
      use: {
        browserName: "chromium",
        baseURL: "http://localhost:8082",
        headless: true,
        ignoreHTTPSErrors:
          process.env.SURIOS_TEST_REPORTING_LIVE === "1" ||
          process.env.SURIOS_TEST_LIVE === "1" ||
          process.env.SURIOS_TEST_PROFILE_LIVE === "1",
        trace: "off",
      },
    },
  ],
  webServer: {
    command:
      "npx expo export --platform web --output-dir artifacts/test-web && node scripts/serve-test-web.mjs",
    url: "http://localhost:8082/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CI: "1",
      EXPO_NO_DOTENV: "1",
      BROWSER: "none",
      EXPO_NO_TELEMETRY: "1",
      EXPO_PUBLIC_API_BASE_URL: apiOrigin,
    },
  },
});
