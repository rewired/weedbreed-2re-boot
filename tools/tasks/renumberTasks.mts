import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { collectFiles } from './lib/fsWalk.mts';

interface TaskRecord {
  title: string;
  slug: string;
  oldId: string | null;
  status: string | null;
  priority: string | null;
  order: number | null;
  owner: string | null;
  tags: string | null;
  dependsOnRaw: string[];
  dependsOnResolved: string[];
  dependsOnNew: string[];
  dependencyRecords: TaskRecord[];
  relativePath: string;
  absolutePath: string;
  directoryRelative: string;
  filename: string;
  content: string;
}

interface CliOptions {
  dry: boolean;
  write: boolean;
  verify: boolean;
}

const ROOT = process.cwd();
const TASK_ROOT = path.join(ROOT, 'docs', 'tasks');
const REPORT_JSON_PATH = path.join(TASK_ROOT, '.renumber-report.json');
const REPORT_MD_PATH = path.join(TASK_ROOT, 'RENAMING_SUMMARY.md');

const PRIORITY_RANK: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const STATUS_RANK: Record<string, number> = {
  'In Progress': 0,
  Planned: 1,
  Draft: 2,
  Backlog: 3,
};

const LINK_FILE_EXTENSIONS = new Set(['.md', '.mdx', '.ts', '.tsx', '.mts', '.mjs', '.cjs']);

function parseArgs(): CliOptions {
  const args = new Set(process.argv.slice(2));
  return {
    dry: args.has('--dry'),
    write: args.has('--write'),
    verify: args.has('--verify'),
  };
}

function toPosix(inputPath: string): string {
  return inputPath.split(path.sep).join('/');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function padId(value: number): string {
  return value.toString().padStart(4, '0');
}

function parseMetadata(content: string): {
  id: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  owner: string | null;
  tags: string | null;
  order: number | null;
  dependsOn: string[];
} {
  const idMatch = content.match(/^\s*\**ID\**\s*:\**\s*(\d{1,4})\s*$/im);
  const titleMatch = content.match(/^\s*\**Title\**\s*:\**\s*(.+)$/im);
  const headingMatch = content.match(/^\s*#\s+(.+)$/m);
  const statusMatch = content.match(/^\s*\**Status\**\s*:\**\s*(.+)$/im);
  const priorityMatch = content.match(/^\s*\**Priority\**\s*:\**\s*(P[0-3])\s*$/im);
  const ownerMatch = content.match(/^\s*\**Owner\**\s*:\**\s*(.+)$/im);
  const tagsMatch = content.match(/^\s*\**Tags\**\s*:\**\s*(.+)$/im);
  const orderMatch = content.match(/^\s*\**Order\**\s*:\**\s*([+-]?\d+(?:\.\d+)?)\s*$/im);
  const dependsOnMatch = content.match(/^\s*\**DependsOn\**\s*:\**\s*(.+)$/im);

  const title = titleMatch?.[1]?.trim() ?? headingMatch?.[1]?.trim() ?? 'Untitled Task';

  const dependsOn = dependsOnMatch
    ? dependsOnMatch[1]
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0)
    : [];

  return {
    id: idMatch?.[1] ?? null,
    title,
    status: statusMatch?.[1]?.trim() ?? null,
    priority: priorityMatch?.[1]?.trim() ?? null,
    owner: ownerMatch?.[1]?.trim() ?? null,
    tags: tagsMatch?.[1]?.trim() ?? null,
    order: orderMatch ? Number(orderMatch[1]) : null,
    dependsOn,
  };
}

function priorityRank(priority: string | null): number {
  if (!priority) {
    return Number.POSITIVE_INFINITY;
  }
  const rank = PRIORITY_RANK[priority as keyof typeof PRIORITY_RANK];
  return rank ?? Number.POSITIVE_INFINITY;
}

function statusRank(status: string | null): number {
  if (!status) {
    return Number.POSITIVE_INFINITY;
  }
  const rank = STATUS_RANK[status as keyof typeof STATUS_RANK];
  return rank ?? Number.POSITIVE_INFINITY;
}

function parseOrder(order: number | null): number {
  if (order === null || Number.isNaN(order)) {
    return Number.POSITIVE_INFINITY;
  }
  return order;
}

function compareTasks(a: TaskRecord, b: TaskRecord): number {
  const priorityCompare = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityCompare !== 0) {
    return priorityCompare;
  }

  const statusCompare = statusRank(a.status) - statusRank(b.status);
  if (statusCompare !== 0) {
    return statusCompare;
  }

  const orderA = parseOrder(a.order);
  const orderB = parseOrder(b.order);
  if (orderA !== orderB) {
    return orderA < orderB ? -1 : 1;
  }

  const titleA = a.title.toLocaleLowerCase('en-US');
  const titleB = b.title.toLocaleLowerCase('en-US');
  if (titleA < titleB) {
    return -1;
  }
  if (titleA > titleB) {
    return 1;
  }
  return 0;
}

function normalizeDependencyToken(token: string): string {
  return token.toLowerCase();
}

async function buildTaskRecords(taskFiles: Awaited<ReturnType<typeof collectFiles>>): Promise<TaskRecord[]> {
  const records: TaskRecord[] = [];
  for (const entry of taskFiles) {
    if (!entry.dirent.isFile()) {
      continue;
    }

    const name = entry.dirent.name;
    const lowerName = name.toLowerCase();
    if (!lowerName.endsWith('.md')) {
      continue;
    }
    if (lowerName === 'readme.md' || lowerName === 'renaming_summary.md') {
      continue;
    }

    if (entry.relativePath.includes('/_archive/') || entry.relativePath.includes('/disabled/')) {
      continue;
    }

    const absolutePath = entry.path;
    const relativePath = toPosix(path.relative(ROOT, absolutePath));
    const directoryRelative = toPosix(path.relative(ROOT, path.dirname(absolutePath)));
    const filename = entry.dirent.name;
    const content = await readFile(absolutePath, 'utf8');

    const metadata = parseMetadata(content);
    const slug = slugify(metadata.title);

    records.push({
      title: metadata.title,
      slug: slug.length > 0 ? slug : 'task',
      oldId: metadata.id,
      status: metadata.status,
      priority: metadata.priority,
      order: metadata.order,
      owner: metadata.owner,
      tags: metadata.tags,
      dependsOnRaw: metadata.dependsOn,
      dependsOnResolved: [],
      dependsOnNew: [],
      dependencyRecords: [],
      relativePath,
      absolutePath,
      directoryRelative,
      filename,
      content,
    });
  }
  return records;
}

function resolveDependencies(tasks: TaskRecord[]): void {
  const idToIndex = new Map<string, number>();
  const filenameToIndex = new Map<string, number>();

  tasks.forEach((task, index) => {
    if (task.oldId) {
      idToIndex.set(task.oldId, index);
    }
    filenameToIndex.set(task.filename.toLowerCase(), index);
    filenameToIndex.set(task.relativePath.toLowerCase(), index);
  });

  tasks.forEach((task) => {
    const resolved: string[] = [];
    const dependencyList: TaskRecord[] = [];
    const appendDependency = (dependency: TaskRecord) => {
      if (!dependencyList.includes(dependency)) {
        dependencyList.push(dependency);
      }
    };
    for (const token of task.dependsOnRaw) {
      const normalized = normalizeDependencyToken(token);
      const directId = token.match(/\d{4}/)?.[0] ?? null;
      if (directId && idToIndex.has(directId)) {
        resolved.push(directId);
        const dependencyIndex = idToIndex.get(directId);
        if (dependencyIndex !== undefined) {
          appendDependency(tasks[dependencyIndex]);
        }
        continue;
      }

      const filenameIndex = filenameToIndex.get(normalized);
      if (filenameIndex !== undefined) {
        const dependencyTask = tasks[filenameIndex];
        appendDependency(dependencyTask);
        if (dependencyTask.oldId) {
          resolved.push(dependencyTask.oldId);
        }
      }
    }
    task.dependsOnResolved = Array.from(new Set(resolved));
    task.dependencyRecords = dependencyList;
  });
}

function topoSort(tasks: TaskRecord[]): TaskRecord[] {
  const nodes = tasks.map((task, index) => ({ task, index }));

  const adjacency = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();

  nodes.forEach(({ index }) => {
    adjacency.set(index, new Set());
    indegree.set(index, 0);
  });

  const recordToIndex = new Map<TaskRecord, number>();
  tasks.forEach((task, index) => {
    recordToIndex.set(task, index);
  });

  tasks.forEach((task, index) => {
    for (const dependencyRecord of task.dependencyRecords) {
      const dependencyIndex = recordToIndex.get(dependencyRecord);
      if (dependencyIndex === undefined || dependencyIndex === index) {
        continue;
      }
      const dependents = adjacency.get(dependencyIndex);
      if (!dependents) {
        continue;
      }
      if (!dependents.has(index)) {
        dependents.add(index);
        indegree.set(index, (indegree.get(index) ?? 0) + 1);
      }
    }
  });

  const available: number[] = [];
  indegree.forEach((value, index) => {
    if (value === 0) {
      available.push(index);
    }
  });

  const comparator = (aIndex: number, bIndex: number) => compareTasks(tasks[aIndex], tasks[bIndex]);

  const result: TaskRecord[] = [];
  const processed = new Set<number>();

  while (available.length > 0) {
    available.sort(comparator);
    const currentIndex = available.shift();
    if (currentIndex === undefined) {
      break;
    }
    if (processed.has(currentIndex)) {
      continue;
    }
    processed.add(currentIndex);
    result.push(tasks[currentIndex]);

    adjacency.get(currentIndex)?.forEach((dependencyIndex) => {
      const currentValue = indegree.get(dependencyIndex) ?? 0;
      const nextValue = Math.max(0, currentValue - 1);
      indegree.set(dependencyIndex, nextValue);
      if (nextValue === 0 && !processed.has(dependencyIndex)) {
        available.push(dependencyIndex);
      }
    });
  }

  if (result.length !== tasks.length) {
    const remaining: number[] = [];
    tasks.forEach((_, index) => {
      if (!processed.has(index)) {
        remaining.push(index);
      }
    });
    if (remaining.length > 0) {
      console.warn('Dependency cycle detected among tasks. Resolving by secondary sort order.');
      remaining.sort(comparator);
      for (const index of remaining) {
        result.push(tasks[index]);
      }
    }
  }

  return result;
}

interface TaskPlan extends TaskRecord {
  newId: string;
  newSlug: string;
  newFilename: string;
  newRelativePath: string;
  newAbsolutePath: string;
}

interface RewritePlan {
  tasks: TaskPlan[];
  idMapping: Map<string, string>;
  pathMapping: Map<string, string>;
}

interface RewriteStats {
  filesUpdated: number;
  pathReplacements: number;
  idReplacements: number;
}

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.pnpm',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'tmp',
  'temp',
  '.next',
  '.cache',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
}

function planRenumber(sortedTasks: TaskRecord[]): RewritePlan {
  const tasksWithPlan: TaskPlan[] = [];
  const idMapping = new Map<string, string>();
  const pathMapping = new Map<string, string>();
  const recordToPlan = new Map<TaskRecord, TaskPlan>();

  sortedTasks.forEach((task, index) => {
    const newId = padId(index + 1);
    if (task.oldId) {
      idMapping.set(task.oldId, newId);
    }
    const newSlug = task.slug.length > 0 ? task.slug : 'task';
    const newFilename = `${newId}-${newSlug}.md`;
    const newRelativePath = toPosix(path.join(path.dirname(task.relativePath), newFilename));
    const newAbsolutePath = path.join(ROOT, newRelativePath);

    pathMapping.set(task.relativePath, newRelativePath);

    const plannedTask: TaskPlan = {
      ...task,
      newId,
      newSlug,
      newFilename,
      newRelativePath,
      newAbsolutePath,
    };
    tasksWithPlan.push(plannedTask);
    recordToPlan.set(task, plannedTask);
  });

  tasksWithPlan.forEach((task) => {
    const newIds: string[] = [];
    task.dependencyRecords.forEach((dependencyRecord) => {
      const plannedDependency = recordToPlan.get(dependencyRecord);
      if (!plannedDependency) {
        return;
      }
      if (!newIds.includes(plannedDependency.newId)) {
        newIds.push(plannedDependency.newId);
      }
    });
    task.dependsOnNew = newIds;
  });

  return { tasks: tasksWithPlan, idMapping, pathMapping };
}

function updateTaskContent(task: TaskPlan): string {
  let updated = task.content;
  const idRegex = /^\s*ID\s*:\s*\d{1,4}\s*$/im;
  if (idRegex.test(updated)) {
    updated = updated.replace(idRegex, (match) => match.replace(/\d{1,4}/, task.newId));
  } else {
    updated = `ID: ${task.newId}\n${updated}`;
  }

  const dependsRegex = /^\s*DependsOn\s*:\s*(.*)$/im;
  if (task.dependsOnNew.length > 0) {
    const line = `DependsOn: ${task.dependsOnNew.join(', ')}`;
    if (dependsRegex.test(updated)) {
      updated = updated.replace(dependsRegex, line);
    } else if (/^\s*ID\s*:\s*\d{4}/im.test(updated)) {
      updated = updated.replace(/^(\s*ID\s*:\s*\d{4}\s*\n)/im, `$1${line}\n`);
    } else {
      updated = `${line}\n${updated}`;
    }
  } else if (dependsRegex.test(updated)) {
    updated = updated.replace(dependsRegex, 'DependsOn:');
  }

  return updated;
}

async function ensureDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeTasks(tasks: TaskPlan[]): Promise<void> {
  for (const task of tasks) {
    const newContent = updateTaskContent(task);
    await ensureDirectory(task.newAbsolutePath);
    if (toPosix(task.newAbsolutePath) === toPosix(task.absolutePath)) {
      await writeFile(task.newAbsolutePath, newContent, 'utf8');
    } else {
      await writeFile(task.newAbsolutePath, newContent, 'utf8');
      if (toPosix(task.newAbsolutePath) !== toPosix(task.absolutePath)) {
        await rm(task.absolutePath, { force: true });
      }
    }
  }
}

function replaceLiteral(content: string, search: string, replacement: string): { content: string; count: number } {
  if (search === replacement) {
    return { content, count: 0 };
  }
  const pattern = new RegExp(escapeRegExp(search), 'g');
  let count = 0;
  const nextContent = content.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  return { content: nextContent, count };
}

function replaceWithRegex(
  content: string,
  pattern: RegExp,
  replacement: (...args: string[]) => string,
): { content: string; count: number } {
  let count = 0;
  const nextContent = content.replace(pattern, (...args) => {
    count += 1;
    return replacement(...(args as unknown as string[]));
  });
  return { content: nextContent, count };
}

function rewritePaths(content: string, plan: RewritePlan): { content: string; replacements: number } {
  let updated = content;
  let replacementCount = 0;

  for (const [oldPath, newPath] of plan.pathMapping.entries()) {
    if (oldPath === newPath) {
      continue;
    }

    const oldFilename = path.posix.basename(oldPath);
    const newFilename = path.posix.basename(newPath);

    const literalReplacements: Array<[string, string]> = [
      [oldPath, newPath],
      [`/${oldPath}`, `/${newPath}`],
      [`docs/tasks/${oldFilename}`, `docs/tasks/${newFilename}`],
      [`/docs/tasks/${oldFilename}`, `/docs/tasks/${newFilename}`],
    ];

    for (const [search, replacement] of literalReplacements) {
      const { content: nextContent, count } = replaceLiteral(updated, search, replacement);
      updated = nextContent;
      replacementCount += count;
    }

    const { content: tasksContent, count: tasksCount } = replaceWithRegex(
      updated,
      new RegExp(`(?<![A-Za-z0-9_-])tasks/${escapeRegExp(oldFilename)}`, 'g'),
      () => `tasks/${newFilename}`,
    );
    updated = tasksContent;
    replacementCount += tasksCount;

    const { content: bareContent, count: bareCount } = replaceWithRegex(
      updated,
      new RegExp(`(?<![A-Za-z0-9_-])${escapeRegExp(oldFilename)}(?![A-Za-z0-9_-])`, 'g'),
      () => newFilename,
    );
    updated = bareContent;
    replacementCount += bareCount;
  }

  return { content: updated, replacements: replacementCount };
}

function rewriteTaskMentions(content: string, idMapping: Map<string, string>): { content: string; replacements: number } {
  let replacementCount = 0;
  const pattern = /(Task|task)([^0-9]{0,6})(\d{4})/g;
  const updated = content.replace(pattern, (match, word, separator, digits) => {
    const mapped = idMapping.get(digits);
    if (!mapped || mapped === digits) {
      return match;
    }
    replacementCount += 1;
    return `${word}${separator}${mapped}`;
  });
  return { content: updated, replacements: replacementCount };
}

async function rewriteRepository(plan: RewritePlan): Promise<RewriteStats> {
  const files = await collectFiles(ROOT, {
    filter: (entry) => entry.dirent.isFile(),
    ignore: (entry) => {
      if (entry.dirent.isDirectory()) {
        const segments = entry.relativePath.split(path.sep);
        const name = entry.dirent.name;
        if (SKIP_DIRECTORIES.has(name)) {
          return true;
        }
        if (segments.some((segment) => SKIP_DIRECTORIES.has(segment))) {
          return true;
        }
      }
      return false;
    },
  });

  let filesUpdated = 0;
  let pathReplacements = 0;
  let idReplacements = 0;

  for (const entry of files) {
    const relative = toPosix(path.relative(ROOT, entry.path));
    if (relative.includes('/_archive/') || relative.includes('/disabled/')) {
      continue;
    }
    const ext = path.extname(relative).toLowerCase();
    if (!LINK_FILE_EXTENSIONS.has(ext)) {
      continue;
    }

    const originalContent = await readFile(entry.path, 'utf8');
    let updatedContent = originalContent;
    const { content: pathUpdated, replacements: pathCount } = rewritePaths(updatedContent, plan);
    updatedContent = pathUpdated;
    pathReplacements += pathCount;

    const { content: mentionUpdated, replacements: mentionCount } = rewriteTaskMentions(updatedContent, plan.idMapping);
    updatedContent = mentionUpdated;
    idReplacements += mentionCount;

    if (updatedContent !== originalContent) {
      filesUpdated += 1;
      await writeFile(entry.path, updatedContent, 'utf8');
    }
  }

  return {
    filesUpdated,
    pathReplacements,
    idReplacements,
  };
}

interface ReportEntry {
  oldId: string | null;
  newId: string;
  oldPath: string;
  newPath: string;
  title: string;
  dependsOnOld: string[];
  dependsOnNew: string[];
}

interface ReportPayload {
  generatedAt: string;
  entries: ReportEntry[];
}

function buildReport(plan: RewritePlan): ReportPayload {
  const entries: ReportEntry[] = plan.tasks.map((task) => ({
    oldId: task.oldId ?? null,
    newId: task.newId,
    oldPath: task.relativePath,
    newPath: task.newRelativePath,
    title: task.title,
    dependsOnOld: task.dependsOnResolved,
    dependsOnNew: task.dependsOnNew,
  }));

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

async function writeReport(plan: RewritePlan): Promise<void> {
  const payload = buildReport(plan);
  await writeFile(REPORT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sanitizeForTable(value: string): string {
  return value.replace(/\|/g, '\\|');
}

async function writeSummary(plan: RewritePlan): Promise<void> {
  const lines: string[] = [];
  lines.push('# Task Renumbering Summary');
  lines.push('');
  lines.push('| Old ID | New ID | Old Path | New Path | Title |');
  lines.push('| --- | --- | --- | --- | --- |');

  plan.tasks.forEach((task) => {
    const oldIdDisplay = task.oldId ?? '—';
    lines.push(
      `| ${oldIdDisplay} | ${task.newId} | ${task.relativePath} | ${task.newRelativePath} | ${sanitizeForTable(task.title)} |`,
    );
  });

  lines.push('');

  await writeFile(REPORT_MD_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function printDryRun(plan: RewritePlan): void {
  console.log('oldID | newID | oldPath -> newPath | title');
  console.log('----- | ----- | -------------------- | -----');
  plan.tasks.forEach((task) => {
    const oldIdDisplay = task.oldId ?? '—';
    console.log(`${oldIdDisplay} | ${task.newId} | ${task.relativePath} -> ${task.newRelativePath} | ${task.title}`);
  });
}

function buildReadmeTable(plan: RewritePlan): string {
  const header = ['| ID   | Title | Priority | Status | Owner | Links | Resolved |', '| ---- | ----- | -------- | ------ | ----- | ----- | -------- |'];
  const rows = plan.tasks.map((task) => {
    const priority = task.priority ?? '—';
    const status = task.status ?? '—';
    const owner = task.owner ?? 'unassigned';
    const links = `[task](./${task.newFilename}) · [SEC](../SEC.md) · [DD](../DD.md) · [TDD](../TDD.md)`;
    return `| ${task.newId} | ${task.title} | ${priority} | ${status} | ${owner} | ${links} | [ ] |`;
  });
  return [...header, ...rows, ''].join('\n');
}

async function updateReadme(plan: RewritePlan): Promise<void> {
  const readmePath = path.join(TASK_ROOT, 'README.md');
  const existing = await readFile(readmePath, 'utf8');
  const marker = '## How to work with tasks';
  const markerIndex = existing.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Failed to update README: marker section not found.');
  }

  const table = buildReadmeTable(plan);
  const header = '# Task Backlog\n\n';
  const remainder = existing.slice(markerIndex);
  const updated = `${header}${table}\n${remainder}`;
  await writeFile(readmePath, updated.endsWith('\n') ? updated : `${updated}\n`, 'utf8');
}

async function verifyRenumberedState(): Promise<void> {
  const entries = await collectFiles(TASK_ROOT, {
    filter: (entry) => entry.dirent.isFile(),
  });

  const tasks: Array<{
    id: string;
    relativePath: string;
    filename: string;
    dependsOn: string[];
  }> = [];

  for (const entry of entries) {
    const name = entry.dirent.name;
    const lowerName = name.toLowerCase();
    if (!lowerName.endsWith('.md')) {
      continue;
    }
    if (lowerName === 'readme.md' || lowerName === 'renaming_summary.md') {
      continue;
    }
    const relativePath = toPosix(path.relative(ROOT, entry.path));
    if (relativePath.includes('/_archive/') || relativePath.includes('/disabled/')) {
      continue;
    }

    const content = await readFile(entry.path, 'utf8');
    const metadata = parseMetadata(content);
    if (!metadata.id || !/^\d{4}$/.test(metadata.id)) {
      throw new Error(`Verification failed: missing or invalid ID in ${relativePath}`);
    }

    tasks.push({
      id: metadata.id,
      relativePath,
      filename: name,
      dependsOn: metadata.dependsOn,
    });
  }

  tasks.sort((a, b) => a.id.localeCompare(b.id));
  tasks.forEach((task, index) => {
    const expectedId = padId(index + 1);
    if (task.id !== expectedId) {
      throw new Error(`Verification failed: expected ID ${expectedId} but found ${task.id} in ${task.relativePath}`);
    }
  });

  const idSet = new Set(tasks.map((task) => task.id));

  tasks.forEach((task) => {
    const basename = path.posix.basename(task.relativePath);
    if (!basename.startsWith(`${task.id}-`)) {
      throw new Error(`Verification failed: filename ${basename} does not match ID ${task.id}`);
    }

    task.dependsOn.forEach((token) => {
      const match = token.match(/\d{4}/);
      if (!match) {
        return;
      }
      if (!idSet.has(match[0])) {
        throw new Error(`Verification failed: task ${task.id} depends on missing ID ${match[0]}`);
      }
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs();
  if (!options.dry && !options.write) {
    console.error('Specify --dry and/or --write to perform the task renumbering.');
    process.exitCode = 1;
    return;
  }

  const taskEntries = await collectFiles(TASK_ROOT, {
    filter: (entry) => entry.dirent.isFile(),
  });

  const tasks = await buildTaskRecords(taskEntries);
  if (tasks.length === 0) {
    console.log('No tasks found under docs/tasks.');
    return;
  }

  resolveDependencies(tasks);
  const sortedTasks = topoSort(tasks);
  const plan = planRenumber(sortedTasks);

  if (options.dry) {
    printDryRun(plan);
  }

  if (options.write) {
    console.log('Writing updated task files...');
    await writeTasks(plan.tasks);
    console.log('Rewriting cross-references across the repository...');
    const rewriteStats = await rewriteRepository(plan);
    console.log(
      `Updated ${rewriteStats.filesUpdated} files; path replacements: ${rewriteStats.pathReplacements}; Task mentions updated: ${rewriteStats.idReplacements}.`,
    );
    await writeReport(plan);
    await writeSummary(plan);
    await updateReadme(plan);
    console.log('Generated renumbering report and summary.');
  }

  if (options.verify) {
    await verifyRenumberedState();
    console.log('Verification successful: tasks are sequentially numbered and filenames match their IDs.');
  }

  if (!options.write) {
    console.log(`Planned updates for ${plan.tasks.length} tasks.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
