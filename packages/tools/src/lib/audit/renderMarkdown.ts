import type { CandidateCategory, PackageAuditSummary } from './normalize.ts';

const CATEGORY_LABEL: Record<CandidateCategory, string> = {
  greenlist: 'Greenlist',
  review: 'Review',
  skip: 'Skip'
};

const NO_GO_CRITERIA = [
  'Introduce runtime UUID/hash replacements without aligning with packages/engine/src/backend/src/util/uuid.ts.',
  'Adopt psychrolib in production flows before securing a maintained ^2 release or validating 1.x compatibility formally.',
  'Pull mathjs (or similar heavy dependencies) without a documented tree-shaking plan and bundle budget.'
];

const FOLLOW_UP_TASKS = [
  'Task 0007 keeps determinism helpers test-only until an ADR approves runtime adoption.',
  'Task 0009 will cover psychrometric wiring once psychrolib v2 (or alternative) is stable.'
];

export function renderPackageAuditMarkdown(summary: PackageAuditSummary): string {
  const lines: string[] = [];
  const { entries } = summary;

  lines.push('# Package Audit & Reporting Matrix');
  lines.push('');
  lines.push(
    '_Generated via `pnpm report:packages` — deterministic snapshot of candidate tooling dependencies._'
  );
  lines.push('');
  lines.push('## Scope & Inputs');
  lines.push('');
  lines.push('- Parsed `package.json` for the root workspace and `packages/*` (pnpm workspaces).');
  lines.push('- Parsed `pnpm-lock.yaml` to resolve locked versions per importer.');
  lines.push('- Searched `packages/*/src/**` for direct imports/requires of candidate packages.');
  lines.push('- Classified candidates into Greenlist / Review / Skip buckets with rationale.');
  lines.push('');
  lines.push('## Findings');
  lines.push('');
  lines.push('| Package | Wanted | Installed? | Version(s) | Location(s) | Direct Usage?* | Category | Notes |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const entry of entries) {
    const versions =
      entry.versions.length === 1 && entry.versions[0] === '—'
        ? '—'
        : entry.versions.map((version) => `\`${escapePipes(version)}\``).join('<br>');
    const locations = formatList(entry.locations);
    const directUsage = formatList(entry.directUsages);
    const notes = formatList(entry.notes.map(escapePipes));
    const installed = entry.installed ? '✅' : '❌';
    const category = CATEGORY_LABEL[entry.candidate.category];

    lines.push(
      `| \`${entry.candidate.name}\` | \`${entry.candidate.wanted}\` | ${installed} | ${versions} | ${locations} | ${directUsage} | ${category} | ${notes} |`
    );
  }

  lines.push('');
  lines.push('> *Direct usage = imports/requires within `packages/*/src/**`.');
  lines.push('');

  for (const category of ['greenlist', 'review', 'skip'] as CandidateCategory[]) {
    const label = CATEGORY_LABEL[category];
    lines.push(`## ${label}`);
    lines.push('');

    const relevant = entries.filter((entry) => entry.candidate.category === category);

    if (relevant.length === 0) {
      lines.push('- _No entries._');
    } else {
      for (const entry of relevant) {
        lines.push(`- \`${entry.candidate.name}\` — ${entry.candidate.categoryReason}`);
      }
    }

    lines.push('');
  }

  lines.push('## Follow-up Tasks');
  lines.push('');
  for (const task of FOLLOW_UP_TASKS) {
    lines.push(`- ${task}`);
  }
  lines.push('');

  lines.push('## No-Go Criteria');
  lines.push('');
  for (const item of NO_GO_CRITERIA) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  return lines.join('\n');
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return '—';
  }
  return values.map(escapePipes).join('<br>');
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, '\\|');
}
