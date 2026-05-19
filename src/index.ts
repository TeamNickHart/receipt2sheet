#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { processCommand } from './commands/process.js';
import { doctorCommand } from './commands/doctor.js';
import { statusCommand } from './commands/status.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('r2s')
  .description('Process receipts into organized expense spreadsheets using Claude AI')
  .version(VERSION);

program
  .command('init')
  .description('Initialize a new rental tracking folder')
  .option('--property <name>', 'Property name')
  .option('--year <year>', 'Tax year to start with', parseInt)
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('process')
  .description('Process receipts from inbox')
  .argument('[files...]', 'Specific files to process (default: inbox/*)')
  .option('--property <property>', 'Which property these expenses are for')
  .option('--dry-run', 'Show what would be parsed without updating spreadsheets')
  .option('--yes', 'Skip confirmation prompt')
  .option('--category <category>', 'Override category for all receipts')
  .option('--force', 'Reprocess files even if already in the ledger')
  .action(async (files, options) => {
    try {
      await processCommand(files, options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Check configuration, API connection, and project health')
  .option('--fix', 'Auto-fix issues that can be resolved automatically')
  .action(async (options) => {
    try {
      await doctorCommand(options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show expense summary by category for the current year')
  .option('--year <year>', 'Tax year to show', parseInt)
  .option('--property <property>', 'Which property to show')
  .action(async (options) => {
    try {
      await statusCommand(options);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
