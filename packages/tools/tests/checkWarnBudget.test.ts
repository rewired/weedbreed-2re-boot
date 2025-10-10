import { describe, expect, it } from 'vitest';
import {
  countWarningsFromReports,
  extractLintReportsFromOutput,
  parseCliArguments
} from '../../../tools/check-warn-budget.mjs';

describe('check-warn-budget helper', () => {
  it('extracts JSON arrays from lint output with interleaved logs', () => {
    const sampleOutput = `Scope: 4 of 4 packages\n` +
      `{"some":"log"}\n` +
      `[{
        "filePath": "packages/engine/src/foo.ts",
        "warningCount": 2,
        "messages": [
          { "ruleId": "no-console", "severity": 1 },
          { "ruleId": "no-alert", "severity": 1 }
        ]
      }]\n` +
      `Progress: done\n` +
      `[{"filePath": "packages/facade/src/bar.ts", "warningCount": 1, "messages": []}]\n`;

    const reports = extractLintReportsFromOutput(sampleOutput);
    expect(reports).toHaveLength(2);
    expect(reports[0][0]?.filePath).toBe('packages/engine/src/foo.ts');
    expect(reports[1][0]?.filePath).toBe('packages/facade/src/bar.ts');
  });

  it('counts warnings using warningCount metadata when available', () => {
    const reports = [
      [
        { filePath: 'a.ts', warningCount: 1, messages: [] },
        { filePath: 'b.ts', warningCount: 0, messages: [] }
      ],
      [
        { filePath: 'c.ts', warningCount: 2, messages: [] }
      ]
    ];

    expect(countWarningsFromReports(reports)).toBe(3);
  });

  it('counts warning messages when warningCount is missing', () => {
    const reports = [
      [
        {
          filePath: 'missing.ts',
          messages: [
            { ruleId: 'no-console', severity: 1 },
            { ruleId: 'no-unused-vars', severity: 2 },
            { ruleId: 'curly', severity: 1 }
          ]
        }
      ]
    ];

    expect(countWarningsFromReports(reports)).toBe(2);
  });

  it('parses CLI arguments with defaults when no command override is supplied', () => {
    const parsed = parseCliArguments(['--budget', '25']);
    expect(parsed.budget).toBe(25);
    expect(parsed.command.command).toBe('pnpm');
    expect(parsed.command.args).toContain('lint');
  });
});
