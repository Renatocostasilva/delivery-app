import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret",
      NODE_ENV: "test",
    },
    globalSetup: "./test/global-setup.ts",
  },
});