import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageDir = path.dirname(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(packageDir, 'src'),
      '@/backend': path.resolve(packageDir, 'src/backend/src'),
      '@wb/engine': path.resolve(packageDir, 'src/index.ts'),
      '@/tests': path.resolve(packageDir, 'tests')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: [path.resolve(packageDir, 'tests/setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },
  esbuild: {
    target: 'es2022'
  }
});
