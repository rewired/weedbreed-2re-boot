import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEC_PATH = resolve(__dirname, '../../../../docs/SEC.md');

function extractOpenQuestionsSection(markdown: string): string {
  const heading = '## 14. Open Questions';
  const start = markdown.indexOf(heading);
  if (start === -1) {
    throw new Error('SEC §14 heading not found');
  }
  const afterHeading = markdown.slice(start + heading.length);
  const nextHeaderIndex = afterHeading.indexOf('\n## ');
  return nextHeaderIndex === -1
    ? afterHeading
    : afterHeading.slice(0, nextHeaderIndex);
}

describe('SEC §14 — Open Questions resolved via ADRs', () => {
  const secMarkdown = readFileSync(SEC_PATH, 'utf8');
  const section = extractOpenQuestionsSection(secMarkdown);

  it('lists the expected ADR references', () => {
    const requiredAdrLinks = [
      'ADR-0017',
      'ADR-0018',
      'ADR-0019',
      'ADR-0020'
    ];
    for (const id of requiredAdrLinks) {
      expect(section).toContain(`[${id}](`);
    }
  });

  it('contains no unresolved question bullets', () => {
    const unresolved = section
      .split('\n')
      .filter((line) => line.trim().startsWith('-') && line.includes('?'));
    expect(unresolved).toHaveLength(0);
  });
});
