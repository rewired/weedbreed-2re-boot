import { Command } from 'commander';
import Table from 'cli-table3';

/* eslint-disable wb-sim/no-ts-import-js-extension */

import { generatePackageAudit, renderPackageAuditMarkdown } from '../lib/packageAudit.js';
import { logger } from '../lib/logger.js';

const program = new Command('wb');

program.description('Weed Breed tooling CLI');

const report = program.command('report').description('Reporting utilities');

report
  .command('packages')
  .description('Print the candidate package audit matrix')
  .option('--json', 'Emit raw JSON instead of a table')
  .option('--table', 'Emit an ASCII table instead of Markdown')
  .action(async (options: { json?: boolean; table?: boolean }) => {
    try {
      const { entries } = await generatePackageAudit();

      if (options.json) {
        process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
        return;
      }

      if (options.table) {
        const table = new Table({
          head: [
            'Package',
            'Wanted',
            'Installed?',
            'Version(s)',
            'Location(s)',
            'Direct Usage?',
            'Category',
            'Notes'
          ],
          wordWrap: true
        });

        for (const entry of entries) {
          table.push([
            entry.candidate.name,
            entry.candidate.wanted,
            entry.installed ? 'Yes' : 'No',
            entry.versions.join(', '),
            entry.locations.length > 0 ? entry.locations.join('\n') : '—',
            entry.directUsages.length > 0 ? entry.directUsages.join('\n') : '—',
            entry.candidate.category,
            entry.notes.join('\n')
          ]);
        }

        process.stdout.write(`${table.toString()}\n`);
        return;
      }

      const markdown = renderPackageAuditMarkdown({ entries });
      process.stdout.write(`${markdown}\n`);
    } catch (error: unknown) {
      const normalisedError = error instanceof Error ? error : new Error('Failed to generate package report', { cause: error });
      logger.error(normalisedError, 'Failed to generate package report');
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv);
