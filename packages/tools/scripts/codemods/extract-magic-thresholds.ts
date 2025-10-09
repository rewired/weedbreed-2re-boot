import { Project, SyntaxKind } from 'ts-morph';

interface Replacement {
  readonly value: number;
  readonly import: {
    readonly from: string;
    readonly name: string;
  };
}

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const files = project.addSourceFilesAtPaths(['packages/**/src/**/*.{ts,tsx}']);

const REPLACEMENTS: readonly Replacement[] = [
  { value: 0.35, import: { from: '@engine/constants/climate', name: 'HUMIDITY_MIN' } },
  { value: 15, import: { from: '@engine/constants/time', name: 'MINUTES_STEP' } },
  { value: 180, import: { from: '@engine/constants/workforce', name: 'RAISE_COOLDOWN_DAYS' } }
];

for (const sourceFile of files) {
  let changed = false;

  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.NumericLiteral) {
      const literalValue = Number(node.getText());
      const match = REPLACEMENTS.find((candidate) => Object.is(candidate.value, literalValue));

      if (match) {
        const existingImport = sourceFile
          .getImportDeclarations()
          .find((declaration) => declaration.getModuleSpecifierValue() === match.import.from);

        if (existingImport) {
          const namedImports = new Set(existingImport.getNamedImports().map((item) => item.getName()));
          if (!namedImports.has(match.import.name)) {
            existingImport.addNamedImport(match.import.name);
          }
        } else {
          sourceFile.addImportDeclaration({
            moduleSpecifier: match.import.from,
            namedImports: [match.import.name]
          });
        }

        node.replaceWithText(match.import.name);
        changed = true;
      }
    }
  });

  if (changed) {
    await sourceFile.fixUnusedIdentifiers();
  }
}

await project.save();
