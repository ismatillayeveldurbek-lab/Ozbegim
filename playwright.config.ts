import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    locale: "uz-UZ",
  },
  projects: [
    { name: "kompyuter", use: { viewport: { width: 1366, height: 900 } } },
    { name: "telefon", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
});
