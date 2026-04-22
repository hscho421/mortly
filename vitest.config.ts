import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/utils/setup.ts"],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
      "tests/component/**/*.test.{ts,tsx}",
      "tests/invariants/**/*.test.{ts,tsx}",
    ],
    // tests/concurrency/** hits a real DB — opt-in via `npm run test:concurrency`.
    exclude: [
      "tests/e2e/**",
      "tests/concurrency/**",
      "node_modules/**",
      ".next/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["lib/**", "pages/api/**", "components/**"],
      exclude: [
        "**/*.d.ts",
        "**/*.config.*",
        "**/node_modules/**",
        "**/.next/**",
        "components/**/*.stories.tsx",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
    environmentMatchGlobs: [
      ["tests/component/**", "jsdom"],
    ],
    testTimeout: 10_000,
    pool: "threads",
    poolOptions: {
      threads: { singleThread: false },
    },
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
