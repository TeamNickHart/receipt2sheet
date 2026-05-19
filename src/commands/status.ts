import path from 'path';
import chalk from 'chalk';
import ExcelJS from 'exceljs';
import { loadConfig, resolveSpreadsheetPath } from '../core/config.js';
import { fileExists, listInboxFiles } from '../utils/files.js';
import { currentYear } from '../utils/dates.js';
import { formatDollars } from '../utils/currency.js';

interface StatusOptions {
  year?: number;
  property?: string;
}

interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const { config, configDir } = await loadConfig();

  const year = options.year || currentYear();

  // Resolve property
  const propertyId = options.property || config.default_property;
  const property = config.properties.find((p) => p.id === propertyId);
  if (!property) {
    const ids = config.properties.map((p) => p.id).join(', ');
    throw new Error(`Unknown property "${propertyId}". Available properties: ${ids}`);
  }

  // Read operating expenses spreadsheet
  const opPath = resolveSpreadsheetPath(configDir, config.spreadsheets.operating_expenses, year);
  const categoryTotals = await readOperatingExpenses(opPath);

  // Read capital improvements
  const capPath = resolveSpreadsheetPath(configDir, config.spreadsheets.capital_improvements, year);
  const capitalTotal = await readCapitalImprovements(capPath, year);

  // Count inbox files
  const inboxPath = path.resolve(configDir, config.inbox);
  const inboxFiles = await listInboxFiles(inboxPath);

  // Display
  console.log();
  console.log(chalk.bold(`  ${property.name}`));
  console.log(chalk.dim(`  Year: ${year}`));
  console.log();

  if (categoryTotals.length === 0 && capitalTotal.total === 0) {
    console.log(chalk.dim('  No expenses recorded yet.'));
  } else {
    if (categoryTotals.length > 0) {
      console.log(chalk.bold('  Operating Expenses'));

      const maxCatLen = Math.max(...categoryTotals.map((c) => c.category.length));
      const padLen = Math.max(maxCatLen + 2, 28);

      for (const { category, total, count } of categoryTotals) {
        const amt = formatDollars(total).padStart(12);
        const label = category.padEnd(padLen);
        const countStr = chalk.dim(` (${count})`);
        console.log(`    ${label}${amt}${countStr}`);
      }

      const opTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0);
      const opCount = categoryTotals.reduce((sum, c) => sum + c.count, 0);
      console.log(chalk.dim(`    ${'─'.repeat(padLen + 12)}`));
      console.log(
        `    ${chalk.bold('Total'.padEnd(padLen))}${chalk.bold(formatDollars(opTotal).padStart(12))}${chalk.dim(` (${opCount})`)}`,
      );
      console.log();
    }

    if (capitalTotal.total > 0) {
      console.log(chalk.bold('  Capital Improvements'));
      const amt = formatDollars(capitalTotal.total).padStart(12);
      const countStr = chalk.dim(` (${capitalTotal.count})`);
      console.log(`    ${'Total'.padEnd(28)}${amt}${countStr}`);
      console.log();
    }
  }

  if (inboxFiles.length > 0) {
    console.log(chalk.yellow(`  ${inboxFiles.length} receipt(s) pending in inbox`));
  } else {
    console.log(chalk.dim('  Inbox is empty'));
  }
  console.log();
}

async function readOperatingExpenses(spreadsheetPath: string): Promise<CategoryTotal[]> {
  if (!(await fileExists(spreadsheetPath))) return [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(spreadsheetPath);
  const sheet = workbook.getWorksheet('Expenses');
  if (!sheet) return [];

  const totals = new Map<string, { total: number; count: number }>();

  // Row 5 = headers, data starts at row 6
  let row = 6;
  while (sheet.getCell(row, 1).value !== null) {
    const category = String(sheet.getCell(row, 2).value || 'Other');
    const amount = Number(sheet.getCell(row, 5).value) || 0;

    const entry = totals.get(category) || { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    totals.set(category, entry);

    row++;
  }

  return Array.from(totals.entries())
    .map(([category, { total, count }]) => ({ category, total, count }))
    .sort((a, b) => b.total - a.total);
}

async function readCapitalImprovements(
  spreadsheetPath: string,
  year: number,
): Promise<{ total: number; count: number }> {
  if (!(await fileExists(spreadsheetPath))) return { total: 0, count: 0 };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(spreadsheetPath);
  const sheet = workbook.getWorksheet('Improvements');
  if (!sheet) return { total: 0, count: 0 };

  let total = 0;
  let count = 0;

  // Row 8 = headers, data starts at row 9
  let row = 9;
  while (sheet.getCell(row, 1).value !== null) {
    const rowYear = Number(sheet.getCell(row, 2).value);
    if (rowYear === year) {
      total += Number(sheet.getCell(row, 6).value) || 0;
      count++;
    }
    row++;
  }

  return { total, count };
}
