import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["bench/test/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
