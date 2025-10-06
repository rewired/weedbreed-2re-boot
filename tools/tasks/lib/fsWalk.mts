import type { Dirent } from 'node:fs';
import { opendir } from 'node:fs/promises';
import path from 'node:path';

export interface WalkEntry {
  path: string;
  relativePath: string;
  dirent: Dirent;
}

export interface WalkOptions {
  filter?: (entry: WalkEntry) => boolean;
  ignore?: (entry: WalkEntry) => boolean;
}

export async function* walkDir(
  root: string,
  options: WalkOptions = {},
): AsyncGenerator<WalkEntry, void, void> {
  const { filter, ignore } = options;

  async function* traverse(currentPath: string, relative: string): AsyncGenerator<WalkEntry, void, void> {
    const directory = await opendir(currentPath);
    for await (const dirent of directory) {
      const entryPath = path.join(currentPath, dirent.name);
      const entryRelativePath = path.join(relative, dirent.name);
      const entry: WalkEntry = {
        path: entryPath,
        relativePath: entryRelativePath,
        dirent,
      };

      if (ignore && ignore(entry)) {
        continue;
      }

      if (dirent.isDirectory()) {
        yield* traverse(entryPath, entryRelativePath);
        continue;
      }

      if (filter && !filter(entry)) {
        continue;
      }

      yield entry;
    }
  }

  yield* traverse(root, '.');
}

export async function collectFiles(root: string, options: WalkOptions = {}): Promise<WalkEntry[]> {
  const entries: WalkEntry[] = [];
  for await (const entry of walkDir(root, options)) {
    entries.push(entry);
  }
  return entries;
}
