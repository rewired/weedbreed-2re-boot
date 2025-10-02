import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },
  esbuild: {
    target: 'es2022'
  },
  resolve: {
    alias: {
      '@wb/engine': resolve(currentDir, '../engine/src/index.ts'),
      '@/backend': resolve(currentDir, '../engine/src/backend')
    }
  }
});
