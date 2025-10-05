import { pathToFileURL } from 'node:url';

const REQUIRED_MANAGER = 'pnpm';
const REQUIRED_VERSION = '10.18.0';

function parsePnpmVersion(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.trim() === '') {
    return null;
  }

  const tokens = userAgent.split(/\s+/);
  const pnpmToken = tokens.find((token) => token.startsWith(`${REQUIRED_MANAGER}/`));
  if (!pnpmToken) {
    return null;
  }

  const versionWithMetadata = pnpmToken.slice(pnpmToken.indexOf('/') + 1);
  const [version] = versionWithMetadata.split('+');
  return version ?? null;
}

export function ensurePnpm(env = process.env) {
  const userAgent = env.npm_config_user_agent;
  const execPath = env.npm_execpath;
  const issues = [];

  const detectedVersion = parsePnpmVersion(userAgent);

  if (!detectedVersion) {
    issues.push(
      `Detected package manager user agent \"${userAgent ?? 'undefined'}\". ` +
        `This does not look like pnpm ${REQUIRED_VERSION}.`
    );
  } else if (detectedVersion !== REQUIRED_VERSION) {
    issues.push(
      `Detected pnpm version ${detectedVersion}. The workspace is pinned to pnpm ${REQUIRED_VERSION}.`
    );
  }

  if (typeof execPath === 'string' && execPath.trim() !== '') {
    const normalizedExecPath = execPath.toLowerCase();
    if (!normalizedExecPath.includes('pnpm')) {
      issues.push(`npm_execpath resolved to ${execPath}, which is not a pnpm shim.`);
    }
  } else {
    issues.push('npm_execpath is undefined; unable to confirm pnpm shim usage.');
  }

  if (issues.length > 0) {
    const instructions = [
      `This workspace must be installed with pnpm ${REQUIRED_VERSION}.`,
      'Use Corepack to activate pnpm before running install commands:',
      `  corepack use pnpm@${REQUIRED_VERSION}`,
      '  pnpm install',
      '',
      ...issues,
    ].join('\n');

    throw new Error(`${instructions}\n`);
  }
}

function isMainModule(url, argv) {
  const entryUrl = argv?.[1] ? pathToFileURL(argv[1]).href : undefined;
  return entryUrl !== undefined && url === entryUrl;
}

if (isMainModule(import.meta.url, process.argv)) {
  try {
    ensurePnpm();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

export { parsePnpmVersion };
