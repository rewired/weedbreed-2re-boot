import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { noDuplicateSimConstantsRule } from "./tools/eslint/rules/no-duplicate-sim-constants.js";

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
      "wb-sim": {
        rules: {
          "no-duplicate-sim-constants": noDuplicateSimConstantsRule
        }
      }
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "wb-sim/no-duplicate-sim-constants": "error"
    }
  }
);
