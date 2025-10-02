import test from "node:test";
import path from "node:path";
import { RuleTester } from "eslint";
import { noEnginePercentIdentifiersRule } from "../rules/no-engine-percent-identifiers.js";

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

test("no-engine-percent-identifiers rule", () => {
  ruleTester.run("no-engine-percent-identifiers", noEnginePercentIdentifiersRule, {
    valid: [
      {
        code: "const qualityPercent = 42;",
        filename: path.resolve("packages/facade/src/example.ts")
      },
      {
        code: "const normalizedQuality = quality01;",
        filename: path.resolve("packages/engine/src/example.ts")
      }
    ],
    invalid: [
      {
        code: "const qualityPercent = 42;",
        filename: path.resolve("packages/engine/src/example.ts"),
        errors: [{ messageId: "forbidden" }]
      },
      {
        code: "const quality_percent = 42;",
        filename: path.resolve("packages/engine/src/example.ts"),
        errors: [{ messageId: "forbidden" }]
      }
    ]
  });
});
