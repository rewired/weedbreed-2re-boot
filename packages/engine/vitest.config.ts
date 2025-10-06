import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@': join(rootDir, 'src'),
    },
  },
});
