import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { createTempDir, cleanupTempDir, writeTempFile } from '../helpers/mock-fs.js';

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('chalk', () => ({
  default: {
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

import { processCommand } from '../../src/commands/process.js';

const FIXTURES_DIR = path.resolve(import.meta.dirname!, '../fixtures');

const validConfig = `
version: 1
properties:
  - id: cabin
    name: "Test Cabin"
    type: short-term-rental
default_property: cabin
spreadsheets:
  operating_expenses: "spreadsheets/Operating_Expenses_{year}.xlsx"
  capital_improvements: "spreadsheets/Capital_Improvements.xlsx"
  year_end_summary: "spreadsheets/Year_End_Summary_{year}.xlsx"
categories:
  - Supplies
  - Repairs
  - Cleaning and maintenance
  - Other
inbox: "inbox/"
processed: "processed/"
organize_processed_by: flat
options:
  require_confirmation: true
  auto_categorize_known_vendors: true
  move_processed_receipts: true
  backup_spreadsheets: false
`;

let tmpDir: string;
let originalCwd: () => string;
let consoleSpy: ReturnType<typeof vi.spyOn>;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

async function setupProject(dir: string) {
  await writeTempFile(dir, 'r2s.yaml', validConfig);
  await fs.mkdir(path.join(dir, 'inbox'), { recursive: true });
  await fs.mkdir(path.join(dir, 'processed'), { recursive: true });
  await fs.mkdir(path.join(dir, 'spreadsheets'), { recursive: true });
}

describe('capital vs operating expense routing', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = await createTempDir();
    await setupProject(tmpDir);
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    await cleanupTempDir(tmpDir);
  });

  it('routes capital expenses to Capital_Improvements spreadsheet', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/capital-purchase-spa.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'spa-order.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Alpine Spa',
          date: '2025-05-26',
          amount: 8350.73,
          description: 'Hot tub purchase and installation',
          category: 'Other',
          expense_type: 'capital',
        }),
      }],
    });

    await processCommand([], { yes: true });

    // Capital spreadsheet should exist
    const capitalPath = path.join(tmpDir, 'spreadsheets', 'Capital_Improvements.xlsx');
    expect(await fs.stat(capitalPath).then(() => true).catch(() => false)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(capitalPath);
    const sheet = wb.getWorksheet('Expenses')!;
    expect(sheet.getCell(6, 3).value).toBe('Alpine Spa');
    expect(sheet.getCell(6, 5).value).toBe(8350.73);

    // Operating spreadsheet should NOT exist
    const operatingPath = path.join(tmpDir, 'spreadsheets', 'Operating_Expenses_2025.xlsx');
    expect(await fs.stat(operatingPath).then(() => true).catch(() => false)).toBe(false);
  });

  it('routes mixed batch correctly — operating and capital to separate files', async () => {
    // Copy two receipts into inbox
    const src1 = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const src2 = path.join(FIXTURES_DIR, 'receipts/capital-purchase-spa.pdf');
    await fs.copyFile(src1, path.join(tmpDir, 'inbox', 'landscaping.pdf'));
    await fs.copyFile(src2, path.join(tmpDir, 'inbox', 'spa.pdf'));

    // Operating expense response
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Ridgeline Landscaping',
          date: '2026-04-05',
          amount: 259.44,
          description: 'Maintenance',
          category: 'Cleaning and maintenance',
          expense_type: 'operating',
        }),
      }],
    });

    // Capital expense response
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Alpine Spa',
          date: '2025-05-26',
          amount: 8350.73,
          description: 'Hot tub',
          category: 'Other',
          expense_type: 'capital',
        }),
      }],
    });

    await processCommand([], { yes: true });

    // Both spreadsheets should exist
    const operatingPath = path.join(tmpDir, 'spreadsheets', 'Operating_Expenses_2026.xlsx');
    const capitalPath = path.join(tmpDir, 'spreadsheets', 'Capital_Improvements.xlsx');

    expect(await fs.stat(operatingPath).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.stat(capitalPath).then(() => true).catch(() => false)).toBe(true);

    // Verify operating spreadsheet
    const wbOp = new ExcelJS.Workbook();
    await wbOp.xlsx.readFile(operatingPath);
    const sheetOp = wbOp.getWorksheet('Expenses')!;
    expect(sheetOp.getCell(6, 3).value).toBe('Ridgeline Landscaping');

    // Verify capital spreadsheet
    const wbCap = new ExcelJS.Workbook();
    await wbCap.xlsx.readFile(capitalPath);
    const sheetCap = wbCap.getWorksheet('Expenses')!;
    expect(sheetCap.getCell(6, 3).value).toBe('Alpine Spa');

    // Both receipts moved to processed
    const processed = await fs.readdir(path.join(tmpDir, 'processed'));
    expect(processed).toHaveLength(2);
  });
});
