import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "./src"),
      "@engine/constants": path.resolve(
        __dirname,
        "../engine/src/backend/src/constants"
      ),
      "@wb/transport-sio": path.resolve(__dirname, "../transport-sio/src/client.ts")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./tests/setupTests.ts")],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.stories.tsx"]
    }
  }
});
