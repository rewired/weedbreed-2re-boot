import { spawn } from 'node:child_process';

const DEFAULT_HTTP_BASE = 'http://localhost:3333';
const DEFAULT_TRANSPORT_BASE = 'http://localhost:7101';

const env = { ...process.env };

if (!env.VITE_FACADE_HTTP_BASE_URL) {
  env.VITE_FACADE_HTTP_BASE_URL = DEFAULT_HTTP_BASE;
  console.log(
    `[dev:stack] Defaulting VITE_FACADE_HTTP_BASE_URL to ${DEFAULT_HTTP_BASE}.`,
  );
}

if (!env.VITE_FACADE_TRANSPORT_BASE_URL) {
  env.VITE_FACADE_TRANSPORT_BASE_URL = DEFAULT_TRANSPORT_BASE;
  console.log(
    `[dev:stack] Defaulting VITE_FACADE_TRANSPORT_BASE_URL to ${DEFAULT_TRANSPORT_BASE}.`,
  );
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const child = spawn(pnpmCommand, ['--filter', '@wb/ui', 'dev'], {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(0);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to launch @wb/ui dev server:', error);
  process.exit(1);
});
