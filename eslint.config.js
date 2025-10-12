import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { noDuplicateSimConstantsRule } from "./tools/eslint/rules/no-duplicate-sim-constants.js";
import { noEconomyPerTickRule } from "./tools/eslint/rules/no-economy-per-tick.js";
import { noEnginePercentIdentifiersRule } from "./tools/eslint/rules/no-engine-percent-identifiers.js";
import { noMathRandomRule } from "./tools/eslint/rules/no-math-random.js";
import { noTsImportJsExtensionRule } from "./tools/eslint/rules/no-ts-import-js-extension.js";

const wbSimPlugin = {
  rules: {
    "no-duplicate-sim-constants": noDuplicateSimConstantsRule,
    "no-economy-per-tick": noEconomyPerTickRule,
    "no-engine-percent-identifiers": noEnginePercentIdentifiersRule,
    "no-math-random": noMathRandomRule,
    "no-ts-import-js-extension": noTsImportJsExtensionRule
  }
};

export default tseslint.config(
  {
    ignores: ["dist", "**/dist/**", "node_modules"]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parserOptions: {
        project: [
          "./packages/*/tsconfig.json",
          "./packages/*/tsconfig.spec.json",
          "./packages/engine/tsconfig.eslint.json"
        ],
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module"
      }
    },
    plugins: {
      "wb-sim": wbSimPlugin
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-magic-numbers": [
        "warn",
        {
          ignore: [-1, 0, 1, 2, 6, 10, 12, 18, 25, 30, 60, 100, 1000, 1e-3],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
          detectObjects: true
        }
      ],
      "wb-sim/no-duplicate-sim-constants": "error",
      "wb-sim/no-math-random": "error",
      "wb-sim/no-ts-import-js-extension": "error"
    }
  },
  {
    files: ["packages/engine/**/*.{ts,tsx,js,jsx}", "packages/engine/**/*.cts", "packages/engine/**/*.mts"],
    plugins: {
      "wb-sim": wbSimPlugin
    },
    rules: {
      "wb-sim/no-economy-per-tick": "error",
      "wb-sim/no-engine-percent-identifiers": "error"
    }
  },
  {
    files: [
      "packages/**/src/**/constants/**/*.ts",
      "packages/**/tests/constants.ts"
    ],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off"
    }
  },
  {
    files: ["packages/**/tests/**/*.ts", "packages/**/tests/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off"
    }
  }
);
