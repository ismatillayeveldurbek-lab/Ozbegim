import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@generated": path.resolve(import.meta.dirname, "generated"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["dotenv/config"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
