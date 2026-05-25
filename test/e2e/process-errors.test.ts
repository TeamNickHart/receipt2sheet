import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
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

describe('process error handling', () => {
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

  it('reports unsupported file types', async () => {
    const txtFile = path.join(tmpDir, 'notes.txt');
    await fs.writeFile(txtFile, 'just notes');

    await processCommand([txtFile], { yes: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('unsupported');
  });

  it('handles API failure gracefully', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    await processCommand([], { yes: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('failed to parse');
  });

  it('includes phase context in error messages', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockCreate.mockRejectedValueOnce(new Error('connection timeout'));

    await processCommand([], { yes: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[calling Claude API]');
    expect(output).toContain('connection timeout');
  });

  it('warns on unknown --property flag', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Test',
          date: '2026-04-05',
          amount: 100,
          description: 'Test',
          category: 'Repairs',
          expense_type: 'operating',
        }),
      }],
    });

    await processCommand([], { yes: true, property: 'nonexistent' });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('not found in config');
    expect(output).toContain('cabin');
  });

  it('--force reprocesses already-processed files', async () => {
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
          result: { vendor: 'Old', date: '2026-01-01', amount: 0, description: '', category: 'Other', expenseType: 'operating' },
          rawResponse: '{}',
          action: 'confirm',
        },
      }),
    );

    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Ridgeline Landscaping',
          date: '2026-04-05',
          amount: 259.44,
          description: 'Maintenance',
          category: 'Repairs',
          expense_type: 'operating',
        }),
      }],
    });

    await processCommand([], { yes: true, force: true });

    // The API should have been called (not skipped)
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('--dry-run makes no changes', async () => {
    const srcPdf = path.join(FIXTURES_DIR, 'receipts/service-invoice-landscaping.pdf');
    const inboxPdf = path.join(tmpDir, 'inbox', 'landscaping.pdf');
    await fs.copyFile(srcPdf, inboxPdf);

    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor: 'Ridgeline',
          date: '2026-04-05',
          amount: 259.44,
          description: 'Maintenance',
          category: 'Repairs',
          expense_type: 'operating',
        }),
      }],
    });

    await processCommand([], { dryRun: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('dry run');

    // No spreadsheet created
    const spreadsheet = path.join(tmpDir, 'spreadsheets', 'Operating_Expenses_2026.xlsx');
    expect(await fs.stat(spreadsheet).then(() => true).catch(() => false)).toBe(false);

    // Receipt not moved
    expect(await fs.stat(inboxPdf).then(() => true).catch(() => false)).toBe(true);

    // No ledger created
    expect(
      await fs.stat(path.join(tmpDir, '.r2s', 'processed.json')).then(() => true).catch(() => false),
    ).toBe(false);
  });
});
