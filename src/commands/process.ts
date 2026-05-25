import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { loadConfig, resolveSpreadsheetPath, learnVendors, saveConfig } from '../core/config.js';
import { extractText, readFileAsBase64, getMediaType } from '../core/extract.js';
import { parseReceipt, type ParseResult } from '../core/parse.js';
import { appendExpense, backupSpreadsheet } from '../core/spreadsheet.js';
import { confirmExpenses, type ParsedEntry } from '../core/confirm.js';
import { loadLedger, saveLedger, isAlreadyProcessed } from '../core/ledger.js';
import {
  listInboxFiles,
  isSupportedFile,
  ensureDir,
  receiptFilename,
  uniquePath,
} from '../utils/files.js';
import { currentYear as getCurrentYear } from '../utils/dates.js';
import type { Expense } from '../schemas/expense.js';

interface ProcessOptions {
  property?: string;
  dryRun?: boolean;
  yes?: boolean;
  category?: string;
  force?: boolean;
}

export async function processCommand(files: string[], options: ProcessOptions): Promise<void> {
  const { config, configDir } = await loadConfig();
  const ledger = await loadLedger(configDir);

  // Validate --property flag
  if (options.property) {
    const knownIds = config.properties.map((p) => p.id);
    if (!knownIds.includes(options.property)) {
      console.log(
        chalk.yellow(
          `Warning: property "${options.property}" not found in config. Known properties: ${knownIds.join(', ')}`,
        ),
      );
    }
  }

  // Determine which files to process
  let filesToProcess: string[];
  if (files.length > 0) {
    filesToProcess = files.map((f) => path.resolve(f));
    const unsupported = filesToProcess.filter((f) => !isSupportedFile(f));
    if (unsupported.length > 0) {
      console.log(
        chalk.yellow(
          `Skipping unsupported files: ${unsupported.map((f) => path.basename(f)).join(', ')}`,
        ),
      );
      filesToProcess = filesToProcess.filter(isSupportedFile);
    }
  } else {
    const inboxPath = path.resolve(configDir, config.inbox);
    filesToProcess = await listInboxFiles(inboxPath);
  }

  // Filter out already-processed files (unless --force)
  if (!options.force) {
    const alreadyProcessed = filesToProcess.filter((f) => isAlreadyProcessed(ledger, f));
    if (alreadyProcessed.length > 0) {
      console.log(
        chalk.dim(
          `Skipping ${alreadyProcessed.length} already-processed file(s). Use --force to reprocess.`,
        ),
      );
      filesToProcess = filesToProcess.filter((f) => !isAlreadyProcessed(ledger, f));
    }
  }

  if (filesToProcess.length === 0) {
    console.log(
      chalk.yellow('No receipts to process. Drop files in inbox/ or specify files as arguments.'),
    );
    return;
  }

  console.log(chalk.dim(`Processing ${filesToProcess.length} receipt(s)...\n`));

  // Parse each receipt
  const parsed: Array<ParsedEntry & { rawResponse: string }> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const filePath of filesToProcess) {
    const filename = path.basename(filePath);
    process.stdout.write(chalk.dim(`  Parsing ${filename}... `));

    let phase = 'reading file';
    try {
      // Check file size
      const stats = await fs.stat(filePath);
      const maxBytes = getMaxFileSizeBytes();
      if (stats.size > maxBytes) {
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        const limitMB = (maxBytes / 1024 / 1024).toFixed(0);
        throw new Error(`File too large (${sizeMB} MB, limit is ${limitMB} MB)`);
      }

      const ext = path.extname(filePath).toLowerCase();
      let parseResult: ParseResult;

      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        // Use vision for image files
        phase = 'reading image';
        const base64 = await readFileAsBase64(filePath);
        const mediaType = getMediaType(filePath);
        phase = 'calling Claude API';
        parseResult = await parseReceipt(
          { type: 'image', data: base64, mediaType },
          config.vendors || {},
        );
      } else if (ext === '.pdf') {
        // Try text extraction first; fall back to sending PDF as document
        phase = 'extracting text';
        const extraction = await extractText(filePath);
        if (extraction.text && !extraction.needsVision) {
          phase = 'calling Claude API';
          parseResult = await parseReceipt(
            { type: 'text', text: extraction.text },
            config.vendors || {},
          );
        } else {
          // Send PDF directly to Claude as a document
          phase = 'reading PDF';
          const base64 = await readFileAsBase64(filePath);
          phase = 'calling Claude API';
          parseResult = await parseReceipt(
            { type: 'document', data: base64, mediaType: 'application/pdf' },
            config.vendors || {},
          );
        }
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      // Apply overrides
      const property = options.property || config.default_property;
      const expense: Expense = {
        ...parseResult.parsed,
        expenseType: parseResult.parsed.expense_type || 'operating',
        category: options.category
          ? (options.category as Expense['category'])
          : parseResult.parsed.category,
        property,
        receiptPath: filePath,
      };

      parsed.push({ file: filename, expense, rawResponse: parseResult.rawResponse });
      if (expense.amount === 0) {
        console.log(chalk.yellow('done (not an invoice? no amount found)'));
      } else if (expense.expenseType === 'capital') {
        console.log(chalk.green('done') + chalk.yellow(' [CAPITAL]'));
      } else {
        console.log(chalk.green('done'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file: filename, error: `[${phase}] ${message}` });
      console.log(chalk.red('failed'));
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.log(chalk.red(`\n${errors.length} file(s) failed to parse:`));
    for (const { file, error } of errors) {
      console.log(chalk.red(`  ${file}: ${error}`));
    }
  }

  if (parsed.length === 0) {
    console.log(chalk.yellow('\nNo receipts were successfully parsed.'));
    return;
  }

  console.log();

  // Dry run - just show what was parsed
  if (options.dryRun) {
    const Table = (await import('cli-table3')).default;
    const table = new Table({
      head: ['#', 'File', 'Vendor', 'Date', 'Amount', 'Category'],
      colWidths: [4, 25, 20, 12, 12, 25],
    });
    parsed.forEach((e, i) => {
      table.push([
        i + 1,
        e.file.slice(0, 23),
        e.expense.vendor.slice(0, 18),
        e.expense.date,
        `$${e.expense.amount.toFixed(2)}`,
        e.expense.category,
      ]);
    });
    console.log(table.toString());
    console.log(chalk.dim('\n(dry run - no changes made)'));
    return;
  }

  // Confirm with user
  let confirmed: Array<ParsedEntry & { action: 'confirm' | 'skip'; rawResponse?: string }>;
  if (options.yes) {
    confirmed = parsed.map((e) => ({ ...e, action: 'confirm' as const }));
    // Still show the table
    const Table = (await import('cli-table3')).default;
    const table = new Table({
      head: ['#', 'File', 'Vendor', 'Date', 'Amount', 'Category'],
      colWidths: [4, 25, 20, 12, 12, 25],
    });
    parsed.forEach((e, i) => {
      table.push([
        i + 1,
        e.file.slice(0, 23),
        e.expense.vendor.slice(0, 18),
        e.expense.date,
        `$${e.expense.amount.toFixed(2)}`,
        e.expense.category,
      ]);
    });
    console.log(table.toString());
  } else {
    const confirmResult = await confirmExpenses(parsed);
    // Merge rawResponse back in
    confirmed = confirmResult.map((c) => {
      const original = parsed.find((p) => p.file === c.file);
      return { ...c, rawResponse: original?.rawResponse };
    });
  }

  const toProcess = confirmed.filter((e) => e.action === 'confirm');
  const skipped = confirmed.filter((e) => e.action === 'skip');

  if (toProcess.length === 0) {
    console.log(chalk.yellow('\nNo expenses confirmed. Nothing to do.'));
    return;
  }

  // Pre-compute descriptive filenames for the receipt path column in spreadsheets
  const sourcePathMap = new Map<string, string>();
  if (config.options.move_processed_receipts) {
    for (const entry of toProcess) {
      const srcPath = entry.expense.receiptPath;
      if (!srcPath) continue;
      sourcePathMap.set(entry.file, srcPath);
      const ext = path.extname(srcPath);
      const newName = receiptFilename(
        entry.expense.vendor,
        entry.expense.date,
        entry.expense.amount,
        ext,
      );
      entry.expense.receiptPath = newName;
    }
  }

  // Split into operating vs capital expenses
  const operatingExpenses = toProcess.filter((e) => e.expense.expenseType !== 'capital');
  const capitalExpenses = toProcess.filter((e) => e.expense.expenseType === 'capital');

  // Handle operating expenses — group by year
  if (operatingExpenses.length > 0) {
    const byYear = new Map<number, typeof operatingExpenses>();
    for (const entry of operatingExpenses) {
      const year = new Date(entry.expense.date).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(entry);
    }

    for (const [year, entries] of byYear) {
      const spreadsheetPath = resolveSpreadsheetPath(
        configDir,
        config.spreadsheets.operating_expenses,
        year,
      );

      if (config.options.backup_spreadsheets) {
        const backupPath = await backupSpreadsheet(spreadsheetPath);
        if (backupPath) {
          console.log(chalk.dim(`Backed up spreadsheet to ${path.basename(backupPath)}`));
        }
      }

      for (const entry of entries) {
        await appendExpense(spreadsheetPath, entry.expense);
      }

      console.log(
        chalk.green(`Added ${entries.length} expense(s) to ${path.basename(spreadsheetPath)}`),
      );
    }
  }

  // Handle capital expenses — all go to Capital_Improvements.xlsx
  if (capitalExpenses.length > 0) {
    const capitalPath = resolveSpreadsheetPath(
      configDir,
      config.spreadsheets.capital_improvements,
      getCurrentYear(),
    );

    if (config.options.backup_spreadsheets) {
      const backupPath = await backupSpreadsheet(capitalPath);
      if (backupPath) {
        console.log(chalk.dim(`Backed up spreadsheet to ${path.basename(backupPath)}`));
      }
    }

    for (const entry of capitalExpenses) {
      await appendExpense(capitalPath, entry.expense);
    }

    console.log(
      chalk.green(
        `Added ${capitalExpenses.length} capital expense(s) to ${path.basename(capitalPath)}`,
      ),
    );
  }

  // Move processed receipts and update ledger
  if (config.options.move_processed_receipts) {
    const processedBase = path.resolve(configDir, config.processed);

    for (const entry of toProcess) {
      const srcPath = sourcePathMap.get(entry.file);
      if (!srcPath) continue;

      await ensureDir(processedBase);
      const destPath = await uniquePath(path.join(processedBase, entry.expense.receiptPath!));
      await fs.rename(srcPath, destPath);

      // Update receiptPath to the actual final filename (may have -2 suffix)
      entry.expense.receiptPath = path.basename(destPath);

      // Record in ledger
      ledger[srcPath] = {
        processedAt: new Date().toISOString(),
        movedTo: destPath,
        result: {
          vendor: entry.expense.vendor,
          date: entry.expense.date,
          amount: entry.expense.amount,
          description: entry.expense.description,
          category: entry.expense.category,
          expenseType: entry.expense.expenseType,
        },
        rawResponse: entry.rawResponse || '',
        action: 'confirm',
      };
    }

    console.log(chalk.dim(`Moved ${toProcess.length} receipt(s) to processed/`));
  }

  // Record skipped files in ledger too
  for (const entry of skipped) {
    const srcPath = entry.expense.receiptPath;
    if (!srcPath) continue;
    ledger[srcPath] = {
      processedAt: new Date().toISOString(),
      movedTo: null,
      result: {
        vendor: entry.expense.vendor,
        date: entry.expense.date,
        amount: entry.expense.amount,
        description: entry.expense.description,
        category: entry.expense.category,
        expenseType: entry.expense.expenseType,
      },
      rawResponse: (entry as ParsedEntry & { rawResponse?: string }).rawResponse || '',
      action: 'skip',
    };
  }

  await saveLedger(configDir, ledger);

  // Learn vendor→category mappings from confirmed expenses
  if (config.options.auto_categorize_known_vendors) {
    const confirmedExpenses = toProcess.map((e) => ({
      vendor: e.expense.vendor,
      category: e.expense.category,
    }));
    const learned = learnVendors(config, confirmedExpenses);
    if (learned.length > 0) {
      await saveConfig(config, configDir);
      console.log(chalk.dim(`Learned ${learned.length} vendor(s): ${learned.join(', ')}`));
    }
  }

  if (skipped.length > 0) {
    console.log(chalk.dim(`Skipped ${skipped.length} receipt(s)`));
  }
}

const DEFAULT_MAX_FILE_SIZE_MB = 10;

function getMaxFileSizeBytes(): number {
  const envVal = process.env.R2S_MAX_FILE_SIZE_MB;
  if (!envVal) return DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024;
  const mb = parseInt(envVal, 10);
  if (isNaN(mb) || mb <= 0) {
    console.log(
      chalk.yellow(
        `Warning: invalid R2S_MAX_FILE_SIZE_MB="${envVal}", using default (${DEFAULT_MAX_FILE_SIZE_MB} MB)`,
      ),
    );
    return DEFAULT_MAX_FILE_SIZE_MB * 1024 * 1024;
  }
  return mb * 1024 * 1024;
}
