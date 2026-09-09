import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/intents": {
        target: "http://localhost:7101",
        changeOrigin: true,
        secure: false,
        ws: true
      },
      "/telemetry": {
        target: "http://localhost:7101",
        changeOrigin: true,
        secure: false,
        ws: true
      },
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "./src"),
      "@engine/constants": path.resolve(
        __dirname,
        "../engine/src/backend/src/constants"
      ),
      "@/backend": path.resolve(__dirname, "../engine/src/backend"),
      "@wb/engine": path.resolve(__dirname, "../engine/src"),
      "@wb/facade": path.resolve(__dirname, "../facade/src"),
      "@wb/transport-sio": path.resolve(
        __dirname,
        mode === "test" ? "../transport-sio/src/index.ts" : "../transport-sio/src/client.ts"
      )
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
}));
