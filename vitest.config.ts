import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    globals: true,

    projects: [
      {
        name: "browser",
        testMatch: ["src/**/*.{test,spec}.{ts,tsx}"],
        environment: "jsdom",
        setupFiles: ["./src/test/setup.browser.ts"],
      },
      {
        name: "node",
        testMatch: ["tests/**/*.test.ts"],
        environment: "node",
        setupFiles: ["./src/test/setup.node.ts"],
      },
    ],
  },
});
