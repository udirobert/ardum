import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      // __mock-supabase.ts houses its own contract test (FK violation
      // message shape) colocated with the mock implementation, per the
      // reviewer's regression-guard requirement.
      "src/episodes/repositories/__mock-supabase.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
