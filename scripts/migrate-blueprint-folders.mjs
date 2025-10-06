import { promises as fs } from 'node:fs';
import path from 'node:path';

const blueprintRoot = path.resolve(process.cwd(), 'data', 'blueprints');

async function directoryExists(dir) {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

async function collectJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files;
}

function sanitizeSegment(segment) {
  return segment
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function joinPosix(segments) {
  return segments.filter(Boolean).join('/');
}

function computeNewPath(relPath, occupied, existingTargetSet) {
  const segments = relPath.split(path.sep);
  const fileName = segments.at(-1);
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  const makeCandidate = (dirSegments, restSegments) => {
    const sanitized = restSegments.map(sanitizeSegment).filter(Boolean);

    let candidateName = fileName;
    let attempt = 0;
    const suffixSegments = [...sanitized];

    const buildName = () => {
      if (attempt === 0) {
        return candidateName;
      }
      if (suffixSegments.length > 0) {
        const prefix = suffixSegments.join('-');
        return `${prefix}-${baseName}${ext}`;
      }
      return `${baseName}-${attempt}${ext}`;
    };

    while (true) {
      const name = buildName();
      const candidateRel = joinPosix([...dirSegments, name]);
      if (!occupied.has(candidateRel) && !existingTargetSet.has(candidateRel)) {
        occupied.add(candidateRel);
        return candidateRel;
      }
      attempt += 1;
      if (attempt === 1 && suffixSegments.length === 0 && restSegments.length > 0) {
        suffixSegments.push(...restSegments.map(sanitizeSegment).filter(Boolean));
      } else if (attempt > 1) {
        suffixSegments.push(String(attempt));
      }
    }
  };

  const domain = segments[0];

  if (domain === 'room' && segments[1] === 'purpose') {
    return null;
  }

  if (domain === 'room-purpose' && segments[1] === 'core') {
    const rest = segments.slice(2, -1);
    return makeCandidate(['room', 'purpose'], rest);
  }

  if (domain === 'strain') {
    const rest = segments.slice(1, -1);
    if (rest.length === 0) {
      return null;
    }
    return makeCandidate(['strain'], rest);
  }

  if (domain === 'structure') {
    const rest = segments.slice(1, -1);
    if (rest.length === 0) {
      return null;
    }
    return makeCandidate(['structure'], rest);
  }

  if (domain === 'cultivation-method') {
    const rest = segments.slice(1, -1);
    if (rest.length === 0) {
      return null;
    }
    return makeCandidate(['cultivation-method'], rest);
  }

  if (domain === 'device') {
    const category = segments[1];
    if (['airflow', 'lighting', 'filtration', 'climate'].includes(category)) {
      const rest = segments.slice(2, -1);
      if (category === 'climate' && rest[0] === 'cooling') {
        rest[0] = 'thermal';
      }
      if (rest.length === 0) {
        return null;
      }
      return makeCandidate(['device', category], rest);
    }
  }

  if (domain === 'disease' || domain === 'pest' || domain === 'substrate' || domain === 'container' || domain === 'irrigation') {
    const rest = segments.slice(1, -1);
    if (rest.length === 0) {
      return null;
    }
    return makeCandidate([domain], rest);
  }

  if (domain === 'personnel' && (segments[1] === 'role' || segments[1] === 'skill')) {
    const rest = segments.slice(2, -1);
    if (rest.length === 0) {
      return null;
    }
    return makeCandidate(['personnel', segments[1]], rest);
  }

  return null;
}

async function removeEmptyDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let isEmpty = true;
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const childEmpty = await removeEmptyDirs(entryPath);
      if (!childEmpty) {
        isEmpty = false;
      }
    } else {
      isEmpty = false;
    }
  }
  if (isEmpty) {
    await fs.rmdir(dir);
  }
  return isEmpty;
}

async function main() {
  if (!(await directoryExists(blueprintRoot))) {
    console.error(`Blueprint root not found: ${blueprintRoot}`);
    process.exitCode = 1;
    return;
  }

  const files = await collectJsonFiles(blueprintRoot);
  const moves = [];
  const occupied = new Set();
  const existingTargetSet = new Set(files.map((file) => path.relative(blueprintRoot, file).split(path.sep).join('/')));

  for (const file of files) {
    const relPath = path.relative(blueprintRoot, file);
    const newRel = computeNewPath(relPath, occupied, existingTargetSet);
    if (newRel && newRel !== relPath.split(path.sep).join('/')) {
      moves.push({ from: file, to: path.join(blueprintRoot, ...newRel.split('/')) });
      existingTargetSet.add(newRel);
    }
  }

  for (const { to } of moves) {
    await fs.mkdir(path.dirname(to), { recursive: true });
  }

  for (const { from, to } of moves) {
    await fs.rename(from, to);
    console.log(`Moved ${path.relative(blueprintRoot, from)} -> ${path.relative(blueprintRoot, to)}`);
  }

  await removeEmptyDirs(blueprintRoot);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
