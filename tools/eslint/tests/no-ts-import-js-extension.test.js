import test from "node:test";
import path from "node:path";
import { RuleTester } from "eslint";
import { noTsImportJsExtensionRule } from "../rules/no-ts-import-js-extension.js";

RuleTester.describe = (text, method) => {
  method();
};
RuleTester.it = (text, method) => {
  method();
};
RuleTester.itOnly = (text, method) => {
  method();
};
RuleTester.itSkip = () => {
  // noop for compatibility
};

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  }
});

test("no-ts-import-js-extension rule", () => {
  const tsFile = path.resolve("packages/engine/src/example.ts");
  const jsFile = path.resolve("packages/engine/src/example.js");
  const mtsFile = path.resolve("packages/engine/src/example.mts");

  ruleTester.run("no-ts-import-js-extension", noTsImportJsExtensionRule, {
    valid: [
      {
        code: "import './foo';",
        filename: tsFile
      },
      {
        code: "import data from '../foo.json' with { type: 'json' };",
        filename: tsFile
      },
      {
        code: "import pkg from 'pkg/foo.js';",
        filename: tsFile
      },
      {
        code: "import './foo.js';",
        filename: jsFile
      },
      {
        code: "import './foo';",
        filename: mtsFile
      }
    ],
    invalid: [
      {
        code: "import value from './foo.js';",
        filename: tsFile,
        errors: [{ messageId: "removeJsExtension" }],
        output: "import value from './foo';"
      },
      {
        code: "import value from './foo.js';",
        filename: mtsFile,
        errors: [{ messageId: "removeJsExtension" }],
        output: "import value from './foo';"
      },
      {
        code: "export * from '../bar.js';",
        filename: tsFile,
        errors: [{ messageId: "removeJsExtension" }],
        output: "export * from '../bar';"
      },
      {
        code: "import('./baz.js');",
        filename: tsFile,
        errors: [{ messageId: "removeJsExtension" }],
        output: "import('./baz');"
      }
    ]
  });
});
