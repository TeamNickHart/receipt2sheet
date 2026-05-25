import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import ExcelJS from 'exceljs';
import { createTempDir, cleanupTempDir, writeTempFile } from '../helpers/mock-fs.js';

// Mock the Anthropic SDK before importing processCommand
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

// Mock chalk to disable colors for predictable output
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
const TEMPLATE_DIR = path.resolve(import.meta.dirname!, '../../templates/spreadsheets');

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
  - Utilities
  - Other
inbox: "inbox/"
processed: "processed/"
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

function mockApiResponse(response: Record<string, unknown>) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(response) }],
  });
}

describe('process flow', () => {
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

  it('processes a text PDF from inbox with --yes', async () => {
    // Copy fixture receipt to inbox
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockApiResponse({
      vendor: 'Ridgeline Landscaping',
      date: '2026-04-05',
      amount: 259.44,
      description: 'Landscape maintenance',
      category: 'Cleaning and maintenance',
      expense_type: 'operating',
    });

    await processCommand([], { yes: true });

    // Verify spreadsheet was created with the expense
    const spreadsheet = path.join(tmpDir, 'spreadsheets', 'Operating_Expenses_2026.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(spreadsheet);
    const sheet = wb.getWorksheet('Expenses')!;
    // Find the data row (first non-null row after headers)
    let dataRow = 5;
    while (sheet.getCell(dataRow, 1).value !== null && typeof sheet.getCell(dataRow, 1).value === 'string') {
      dataRow++;
    }
    // The first empty row becomes the data row after append
    expect(sheet.getCell(6, 3).value).toBe('Ridgeline Landscaping');
    expect(sheet.getCell(6, 5).value).toBe(259.44);

    // Verify receipt moved to processed/ with descriptive filename
    const movedFile = path.join(tmpDir, 'processed', 'ridgeline-landscaping_2026-04-05_259.pdf');
    expect(await fs.stat(movedFile).then(() => true).catch(() => false)).toBe(true);

    // Verify ledger updated
    const ledgerRaw = await fs.readFile(path.join(tmpDir, '.r2s', 'processed.json'), 'utf-8');
    const ledger = JSON.parse(ledgerRaw);
    const entry = Object.values(ledger)[0] as Record<string, unknown>;
    expect(entry).toBeDefined();
    expect((entry.result as Record<string, unknown>).vendor).toBe('Ridgeline Landscaping');
  });

  it('processes specific files passed as arguments', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/ecommerce-order-amazon.pdf');
    const targetPdf = path.join(tmpDir, 'some-receipt.pdf');
    await fs.copyFile(srcPdf, targetPdf);

    mockApiResponse({
      vendor: 'Amazon',
      date: '2026-01-05',
      amount: 89.52,
      description: 'Ring Pathlight Battery',
      category: 'Supplies',
      expense_type: 'operating',
    });

    await processCommand([targetPdf], { yes: true });

    // Verify spreadsheet created
    const spreadsheet = path.join(tmpDir, 'spreadsheets', 'Operating_Expenses_2026.xlsx');
    expect(await fs.stat(spreadsheet).then(() => true).catch(() => false)).toBe(true);
  });

  it('shows no receipts message when inbox is empty', async () => {
    await processCommand([], { yes: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('No receipts to process');
  });

  it('skips already-processed files', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    // Pre-populate ledger
    const ledgerDir = path.join(tmpDir, '.r2s');
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(
      path.join(ledgerDir, 'processed.json'),
      JSON.stringify({
        [inboxPdf]: {
          processedAt: new Date().toISOString(),
          movedTo: null,
          result: { vendor: 'Test', date: '2026-01-01', amount: 0, description: '', category: 'Other', expenseType: 'operating' },
          rawResponse: '{}',
          action: 'confirm',
        },
      }),
    );

    await processCommand([], { yes: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('already-processed');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
