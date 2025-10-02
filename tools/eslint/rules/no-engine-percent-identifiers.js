/**
 * @type {import('eslint').Rule.RuleModule}
 */
export const noEnginePercentIdentifiersRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow Percent-based identifiers in the engine package so read-model layers stay responsible for percent formatting",
      recommended: false
    },
    schema: [],
    messages: {
      forbidden:
        "Engine modules must not use Percent-based identifiers; keep internal values in 0-1 form and defer percent formatting to façades/read-models."
    }
  },
  create(context) {
    const getFilename = () => {
      if (typeof context.getPhysicalFilename === "function") {
        return context.getPhysicalFilename();
      }

      if (typeof context.physicalFilename === "string") {
        return context.physicalFilename;
      }

      return context.getFilename();
    };

    const shouldCheckFile = () => {
      const filename = getFilename();

      if (!filename || filename === "<input>") {
        return false;
      }

      const normalized = filename.replace(/\\/g, "/");
      return normalized.includes("/packages/engine/") || normalized.endsWith("/packages/engine");
    };

    if (!shouldCheckFile()) {
      return {};
    }

    const containsPercentToken = (name) => name.includes("Percent") || name.includes("_percent");

    return {
      Identifier(node) {
        if (!containsPercentToken(node.name)) {
          return;
        }

        context.report({
          node,
          messageId: "forbidden"
        });
      }
    };
  }
};
