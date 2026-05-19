import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { ensureSpreadsheet, appendExpense, backupSpreadsheet, copyTemplate } from '../../src/core/spreadsheet.js';
import { createTempDir, cleanupTempDir } from '../helpers/mock-fs.js';
import type { Expense } from '../../src/schemas/expense.js';

const TEMPLATE_DIR = path.resolve(import.meta.dirname!, '../../templates/spreadsheets');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
});

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    vendor: 'Test Vendor',
    date: '2026-03-15',
    amount: 45.99,
    description: 'Test expense',
    category: 'Supplies',
    expenseType: 'operating',
    property: 'cabin',
    receiptPath: '/tmp/receipt.pdf',
    ...overrides,
  };
}

describe('copyTemplate', () => {
  it('copies a template to destination', async () => {
    const src = path.join(TEMPLATE_DIR, 'Operating_Expenses.xlsx');
    const dest = path.join(tmpDir, 'spreadsheets', 'test.xlsx');
    await copyTemplate(src, dest);

    const stat = await fs.stat(dest);
    expect(stat.size).toBeGreaterThan(0);
  });
});

describe('ensureSpreadsheet', () => {
  it('creates spreadsheet from template when missing', async () => {
    const dest = path.join(tmpDir, 'Expenses.xlsx');
    await ensureSpreadsheet(dest);

    const stat = await fs.stat(dest);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('does not overwrite existing spreadsheet', async () => {
    const dest = path.join(tmpDir, 'Expenses.xlsx');
    await ensureSpreadsheet(dest);
    const stat1 = await fs.stat(dest);

    await ensureSpreadsheet(dest);
    const stat2 = await fs.stat(dest);
    expect(stat2.mtimeMs).toBe(stat1.mtimeMs);
  });
});

describe('appendExpense', () => {
  it('adds an expense row to the spreadsheet', async () => {
    const dest = path.join(tmpDir, 'Expenses.xlsx');
    await ensureSpreadsheet(dest);

    const expense = makeExpense();
    await appendExpense(dest, expense);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dest);
    const sheet = workbook.getWorksheet('Expenses');
    expect(sheet).toBeTruthy();

    // Row 5 is headers, data starts at row 6 (first empty row after headers)
    const row = sheet!.getRow(6);
    expect(row.getCell(2).value).toBe('Supplies');
    expect(row.getCell(3).value).toBe('Test Vendor');
    expect(row.getCell(4).value).toBe('Test expense');
    expect(row.getCell(5).value).toBe(45.99);
  });

  it('appends multiple expenses to sequential rows', async () => {
    const dest = path.join(tmpDir, 'Expenses.xlsx');
    await ensureSpreadsheet(dest);

    await appendExpense(dest, makeExpense({ vendor: 'Vendor A', amount: 10 }));
    await appendExpense(dest, makeExpense({ vendor: 'Vendor B', amount: 20 }));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dest);
    const sheet = workbook.getWorksheet('Expenses')!;

    expect(sheet.getCell(6, 3).value).toBe('Vendor A');
    expect(sheet.getCell(7, 3).value).toBe('Vendor B');
  });
});

describe('backupSpreadsheet', () => {
  it('creates a .bak copy', async () => {
    const original = path.join(tmpDir, 'Expenses.xlsx');
    await ensureSpreadsheet(original);

    const backupPath = await backupSpreadsheet(original);
    expect(backupPath).toBe(path.join(tmpDir, 'Expenses.bak.xlsx'));

    const stat = await fs.stat(backupPath!);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('returns null for non-existent file', async () => {
    const result = await backupSpreadsheet(path.join(tmpDir, 'nope.xlsx'));
    expect(result).toBeNull();
  });
});
