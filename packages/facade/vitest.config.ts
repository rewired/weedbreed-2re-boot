import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },
  esbuild: {
    target: 'es2022'
  },
  resolve: {
    alias: [
      { find: '@wb/engine', replacement: resolve(currentDir, '../engine/src/index.ts') },
      { find: '@wb/transport-sio/', replacement: resolve(currentDir, '../transport-sio/src/') },
      { find: '@wb/transport-sio', replacement: resolve(currentDir, '../transport-sio/src/index.ts') },
      { find: '@/backend', replacement: resolve(currentDir, '../engine/src/backend') },
      { find: '@', replacement: resolve(currentDir, 'src') }
    ]
  }
});
