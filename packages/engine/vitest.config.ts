import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workspaceSetup = resolve(__dirname, '../../packages/tests/setup.ts');
const engineSetup = resolve(__dirname, 'tests/setup.ts');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@/backend', replacement: resolve(__dirname, 'src/backend') },
      { find: '@/tests', replacement: resolve(__dirname, 'tests') },
      { find: '@wb/engine', replacement: resolve(__dirname, 'src/index.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') }
    ]
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: [workspaceSetup, engineSetup],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },
  esbuild: {
    target: 'es2022'
  }
});
