import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { createTempDir, cleanupTempDir, writeTempFile } from '../helpers/mock-fs.js';
import { ensureSpreadsheet, appendExpense } from '../../src/core/spreadsheet.js';
import type { Expense } from '../../src/schemas/expense.js';

const TEMPLATE_DIR = path.resolve(import.meta.dirname!, '../../templates/spreadsheets');

let tmpDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tmpDir = await createTempDir();
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
  vi.restoreAllMocks();
});

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    properties: [
      { id: 'cabin', name: 'Fox Island Cabin', type: 'short-term-rental' },
    ],
    default_property: 'cabin',
    spreadsheets: {
      operating_expenses: 'spreadsheets/Operating_Expenses_{year}.xlsx',
      capital_improvements: 'spreadsheets/Capital_Improvements.xlsx',
      year_end_summary: 'spreadsheets/Year_End_Summary_{year}.xlsx',
    },
    categories: ['Supplies', 'Repairs', 'Utilities', 'Other'],
    inbox: 'inbox/',
    processed: 'processed/',
    ...overrides,
  };
}

async function writeConfig(dir: string, config = makeConfig()): Promise<void> {
  const { stringify } = await import('yaml');
  await writeTempFile(dir, 'r2s.yaml', stringify(config));
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    vendor: 'Test Vendor',
    date: '2026-03-15',
    amount: 45.99,
    description: 'Test expense',
    category: 'Supplies',
    expenseType: 'operating',
    property: 'cabin',
    ...overrides,
  };
}

async function setupSpreadsheet(dir: string, year: number): Promise<string> {
  const ssPath = path.join(dir, 'spreadsheets', `Operating_Expenses_${year}.xlsx`);
  await ensureSpreadsheet(ssPath);
  return ssPath;
}

async function setupCapitalSpreadsheet(dir: string): Promise<string> {
  const src = path.join(TEMPLATE_DIR, 'Capital_Improvements.xlsx');
  const dest = path.join(dir, 'spreadsheets', 'Capital_Improvements.xlsx');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return dest;
}

async function appendCapitalExpense(
  ssPath: string,
  data: { date: string; year: number; area: string; description: string; provider: string; cost: number },
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(ssPath);
  const sheet = workbook.getWorksheet('Improvements');
  if (!sheet) throw new Error('Improvements sheet not found');

  let row = 9;
  while (sheet.getCell(row, 1).value !== null) {
    row++;
  }

  sheet.getCell(row, 1).value = new Date(data.date);
  sheet.getCell(row, 2).value = data.year;
  sheet.getCell(row, 3).value = data.area;
  sheet.getCell(row, 4).value = data.description;
  sheet.getCell(row, 5).value = data.provider;
  sheet.getCell(row, 6).value = data.cost;

  await workbook.xlsx.writeFile(ssPath);
}

function allOutput(): string {
  return consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

// We need to dynamically import the command so config loading uses our temp dir
async function runStatus(options: { year?: number; property?: string } = {}): Promise<void> {
  // Re-import to pick up config from cwd
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    // Clear module cache and re-import
    const mod = await import('../../src/commands/status.js');
    await mod.statusCommand(options);
  } finally {
    process.chdir(origCwd);
  }
}

describe('status command', () => {
  it('shows property name and year', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    await setupSpreadsheet(tmpDir, 2026);

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('Fox Island Cabin');
    expect(output).toContain('2026');
  });

  it('shows "No expenses recorded" for empty spreadsheet', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    await setupSpreadsheet(tmpDir, 2026);

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('No expenses recorded yet');
  });

  it('shows "No expenses recorded" when spreadsheet does not exist', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('No expenses recorded yet');
  });

  it('totals expenses by category', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    const ssPath = await setupSpreadsheet(tmpDir, 2026);

    await appendExpense(ssPath, makeExpense({ category: 'Supplies', amount: 45.99 }));
    await appendExpense(ssPath, makeExpense({ category: 'Supplies', amount: 20.00 }));
    await appendExpense(ssPath, makeExpense({ category: 'Repairs', amount: 180.00 }));

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('Repairs');
    expect(output).toContain('$180.00');
    expect(output).toContain('Supplies');
    expect(output).toContain('$65.99');
    expect(output).toContain('$245.99');
  });

  it('sorts categories by total descending', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    const ssPath = await setupSpreadsheet(tmpDir, 2026);

    await appendExpense(ssPath, makeExpense({ category: 'Supplies', amount: 10 }));
    await appendExpense(ssPath, makeExpense({ category: 'Repairs', amount: 500 }));
    await appendExpense(ssPath, makeExpense({ category: 'Utilities', amount: 100 }));

    await runStatus({ year: 2026 });

    const output = allOutput();
    const repairsIdx = output.indexOf('Repairs');
    const utilitiesIdx = output.indexOf('Utilities');
    const suppliesIdx = output.indexOf('Supplies');
    expect(repairsIdx).toBeLessThan(utilitiesIdx);
    expect(utilitiesIdx).toBeLessThan(suppliesIdx);
  });

  it('shows expense counts per category', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    const ssPath = await setupSpreadsheet(tmpDir, 2026);

    await appendExpense(ssPath, makeExpense({ category: 'Supplies', amount: 10 }));
    await appendExpense(ssPath, makeExpense({ category: 'Supplies', amount: 20 }));
    await appendExpense(ssPath, makeExpense({ category: 'Repairs', amount: 30 }));

    await runStatus({ year: 2026 });

    const output = allOutput();
    // Supplies should show count of 2, Repairs count of 1
    expect(output).toContain('(2)');
    expect(output).toContain('(1)');
    // Total count should be 3
    expect(output).toContain('(3)');
  });

  it('shows capital improvements for the year', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    await setupSpreadsheet(tmpDir, 2026);
    const capPath = await setupCapitalSpreadsheet(tmpDir);

    await appendCapitalExpense(capPath, {
      date: '2026-06-01',
      year: 2026,
      area: 'Bathroom',
      description: 'New vanity',
      provider: 'Contractor',
      cost: 3500,
    });

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('Capital Improvements');
    expect(output).toContain('$3500.00');
  });

  it('excludes capital improvements from other years', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });
    await setupSpreadsheet(tmpDir, 2026);
    const capPath = await setupCapitalSpreadsheet(tmpDir);

    await appendCapitalExpense(capPath, {
      date: '2025-06-01',
      year: 2025,
      area: 'Kitchen',
      description: 'Appliance upgrade',
      provider: 'Contractor',
      cost: 5000,
    });

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).not.toContain('Capital Improvements');
    expect(output).not.toContain('$5000.00');
  });

  it('shows pending inbox count', async () => {
    await writeConfig(tmpDir);
    const inboxDir = path.join(tmpDir, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });
    await fs.writeFile(path.join(inboxDir, 'receipt1.pdf'), 'fake');
    await fs.writeFile(path.join(inboxDir, 'receipt2.pdf'), 'fake');

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('2 receipt(s) pending in inbox');
  });

  it('shows "Inbox is empty" when no files pending', async () => {
    await writeConfig(tmpDir);
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('Inbox is empty');
  });

  it('throws for unknown property', async () => {
    await writeConfig(tmpDir);

    await expect(runStatus({ property: 'nonexistent' })).rejects.toThrow(
      'Unknown property "nonexistent"',
    );
  });

  it('uses default property when none specified', async () => {
    await writeConfig(tmpDir, makeConfig({
      properties: [
        { id: 'cabin', name: 'Fox Island Cabin', type: 'short-term-rental' },
        { id: 'maui', name: 'Maui Condo', type: 'short-term-rental' },
      ],
      default_property: 'maui',
    }));
    await fs.mkdir(path.join(tmpDir, 'inbox'), { recursive: true });

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('Maui Condo');
  });

  it('ignores non-receipt files in inbox', async () => {
    await writeConfig(tmpDir);
    const inboxDir = path.join(tmpDir, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });
    await fs.writeFile(path.join(inboxDir, 'notes.txt'), 'not a receipt');
    await fs.writeFile(path.join(inboxDir, '.DS_Store'), 'hidden');
    await fs.writeFile(path.join(inboxDir, 'receipt.pdf'), 'fake');

    await runStatus({ year: 2026 });

    const output = allOutput();
    expect(output).toContain('1 receipt(s) pending in inbox');
  });
});
