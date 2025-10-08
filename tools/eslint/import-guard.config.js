import tseslint from "typescript-eslint";
import { noDuplicateSimConstantsRule } from "./rules/no-duplicate-sim-constants.js";
import { noEconomyPerTickRule } from "./rules/no-economy-per-tick.js";
import { noEnginePercentIdentifiersRule } from "./rules/no-engine-percent-identifiers.js";
import { noMathRandomRule } from "./rules/no-math-random.js";
import { noTsImportJsExtensionRule } from "./rules/no-ts-import-js-extension.js";

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
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: false,
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "wb-sim": wbSimPlugin
    },
    linterOptions: {
      reportUnusedDisableDirectives: false
    },
    rules: {
      "wb-sim/no-ts-import-js-extension": "error"
    }
  }
);
