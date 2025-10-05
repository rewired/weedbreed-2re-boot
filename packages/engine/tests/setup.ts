import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(packageDir, '..', '..');

if (process.cwd() !== repoRoot) {
  process.chdir(repoRoot);
}
