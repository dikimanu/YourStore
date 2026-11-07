import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/api/src/**/*.test.ts",
      "apps/web/**/*.test.ts",
    ],
    environment: "node",
    globals: false,
    fileParallelism: false,
  },
});