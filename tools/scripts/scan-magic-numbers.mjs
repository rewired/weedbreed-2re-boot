import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' });
}

function resolveDiffBase() {
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
  const mergeBase = run('git', ['merge-base', 'HEAD', baseRef]);

  if (mergeBase.status === 0 && mergeBase.stdout.trim().length > 0) {
    return mergeBase.stdout.trim();
  }

  const headParent = run('git', ['rev-parse', 'HEAD^']);
  if (headParent.status === 0) {
    return headParent.stdout.trim();
  }

  throw new Error('Unable to determine diff base for magic number scan.');
}

function getChangedFiles(base) {
  const diff = run('git', ['diff', '--name-only', base]);
  if (diff.status !== 0) {
    throw new Error(`git diff failed: ${diff.stderr}`);
  }

  return diff.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isProductionTsFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return false;
  }

  if (filePath.includes('/constants/')) {
    return false;
  }

  if (filePath.includes('/schemas/')) {
    return false;
  }

  if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) {
    return false;
  }

  return filePath.startsWith('packages/');
}

const diffBase = resolveDiffBase();
const changedFiles = getChangedFiles(diffBase).filter(isProductionTsFile);

if (changedFiles.length === 0) {
  console.log('Magic number scan skipped (no production TypeScript changes).');
  process.exit(0);
}

const pattern = "\\b(?<![A-Za-z_])(-?\\d+(\\.\\d+)?)(?!\\s*[:,}\\]])\\b";
const scan = run('rg', ['--json', '--pcre2', pattern, ...changedFiles]);

if (scan.error) {
  console.error('Failed to execute ripgrep:', scan.error);
  process.exit(scan.status ?? 1);
}

const allowed = new Set(['-1', '0', '1', '2', '10', '60', '100', '1000']);
const violations = [];

for (const line of scan.stdout.split('\n')) {
  if (!line) {
    continue;
  }

  const event = JSON.parse(line);

  if (event.type !== 'match') {
    continue;
  }

  const [submatch] = event.data.submatches;
  if (!submatch) {
    continue;
  }

  if (allowed.has(submatch.match.text)) {
    continue;
  }

  violations.push({
    file: event.data.path.text,
    line: event.data.line_number,
    text: event.data.lines.text.trim()
  });
}

if (violations.length === 0) {
  console.log('Magic number scan passed.');
  process.exit(0);
}

console.error('Magic numbers detected in modified production files:\n');
for (const violation of violations) {
  console.error(`${violation.file}:${violation.line}: ${violation.text}`);
}

process.exit(1);
