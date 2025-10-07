import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { noDuplicateSimConstantsRule } from "./tools/eslint/rules/no-duplicate-sim-constants.js";
import { noEnginePercentIdentifiersRule } from "./tools/eslint/rules/no-engine-percent-identifiers.js";
import { noMathRandomRule } from "./tools/eslint/rules/no-math-random.js";

const wbSimPlugin = {
  rules: {
    "no-duplicate-sim-constants": noDuplicateSimConstantsRule,
    "no-engine-percent-identifiers": noEnginePercentIdentifiersRule,
    "no-math-random": noMathRandomRule
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
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "wb-sim": wbSimPlugin
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "wb-sim/no-duplicate-sim-constants": "error",
      "wb-sim/no-math-random": "error"
    }
  },
  {
    files: ["packages/engine/**/*.{ts,tsx,js,jsx}", "packages/engine/**/*.cts", "packages/engine/**/*.mts"],
    plugins: {
      "wb-sim": wbSimPlugin
    },
    rules: {
      "wb-sim/no-engine-percent-identifiers": "error"
    }
  }
);
