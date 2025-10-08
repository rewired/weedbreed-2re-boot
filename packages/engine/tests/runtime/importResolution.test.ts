import { describe, expect, it } from "vitest";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testModuleDir = path.dirname(fileURLToPath(import.meta.url));
const engineSourceRoot = fileURLToPath(
  new URL("../../src/backend/src/", import.meta.url)
);

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
