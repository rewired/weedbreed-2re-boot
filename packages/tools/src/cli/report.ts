import { Command } from 'commander';
import Table from 'cli-table3';

import { generatePackageAudit } from '../lib/packageAudit.js';
import { logger } from '../lib/logger.js';

const program = new Command('wb');

program.description('Weed Breed tooling CLI');

const report = program.command('report').description('Reporting utilities');

report
  .command('packages')
  .description('Print the candidate package audit matrix')
  .option('--json', 'Emit raw JSON instead of a table')
  .action(async (options: { json?: boolean }) => {
    try {
      const { entries } = await generatePackageAudit();

      if (options?.json) {
        process.stdout.write(`${JSON.stringify(entries, null, 2)}\n`);
        return;
      }

      const table = new Table({
        head: [
          'Package',
          'Wanted',
          'Installed?',
          'Version',
          'Location(s)',
          'Direct Usage?',
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
          entry.notes.join('\n')
        ]);
      }

      process.stdout.write(`${table.toString()}\n`);
    } catch (error) {
      logger.error(error, 'Failed to generate package report');
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
