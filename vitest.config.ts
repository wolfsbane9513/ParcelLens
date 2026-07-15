import { defineConfig } from "vitest/config";
import path from "node:path";

// Resolve the "@/..." path alias (tsconfig paths) at test runtime.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
