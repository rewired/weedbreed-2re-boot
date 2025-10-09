import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testModuleDir = path.dirname(fileURLToPath(import.meta.url));
const engineSourceRoot = fileURLToPath(
  new URL("../../src/backend/src/", import.meta.url)
);
const enginePackageRoot = fileURLToPath(new URL("../../", import.meta.url));
const engineSrcRoot = fileURLToPath(new URL("../../src/", import.meta.url));
const engineTestsRoot = fileURLToPath(new URL("../", import.meta.url));

const pipelineDir = fileURLToPath(
  new URL("../../src/backend/src/engine/pipeline/", import.meta.url)
);
const domainSchemasDir = fileURLToPath(
  new URL("../../src/backend/src/domain/schemas/", import.meta.url)
);

const EXTRA_FILES = [
  path.join(engineSourceRoot, "domain", "schemas.ts")
];

const entrypoints = await collectEntrypoints();

describe("import resolution guardrail", () => {
  for (const entrypoint of entrypoints) {
    it(`dynamically imports ${entrypoint.label}`, async () => {
      await expect(import(entrypoint.specifier)).resolves.toBeDefined();
    });
  }
});

describe("JSON import attributes", () => {
  it("requires Node.js 22 import attributes on JSON imports", async () => {
    const roots = [engineSrcRoot, engineTestsRoot];
    const jsonImportPattern = /import[\s\S]*?from\s+['"][^'"]+\.json['"][\s\S]*?;/g;
    const attributePattern = /with\s*\{\s*type\s*:\s*['"]json['"]\s*\}/;

    const violations: string[] = [];

    for (const root of roots) {
      const files = await collectTsFilesRecursive(root);

      for (const filePath of files) {
        const source = await readFile(filePath, "utf8");

        for (const match of source.matchAll(jsonImportPattern)) {
          if (!attributePattern.test(match[0])) {
            const relativePath = path.relative(enginePackageRoot, filePath);
            const snippet = match[0]
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 160);
            violations.push(`${relativePath}: ${snippet}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

async function collectEntrypoints() {
  const files = [
    ...(await listImmediateTsFiles(pipelineDir)),
    ...(await listImmediateTsFiles(domainSchemasDir)),
    ...EXTRA_FILES
  ];

  const sorted = files
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
    .sort((a, b) => a.localeCompare(b));

  return sorted.map((filePath) => ({
    filePath,
    label: path.relative(engineSourceRoot, filePath),
    specifier: toImportSpecifier(filePath)
  }));
}

async function listImmediateTsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(directory, entry.name));
}

function toImportSpecifier(absPath) {
  const relativePath = path.relative(testModuleDir, absPath);
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

async function collectTsFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTsFilesRecursive(fullPath)));
      continue;
    }

    if (entry.isFile() && isTypeScriptSource(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function isTypeScriptSource(filename: string): boolean {
  return /\.(?:[cm]?ts|tsx)$/.test(filename) && !filename.endsWith(".d.ts");
}
