import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { loadLedger, saveLedger, isAlreadyProcessed, type Ledger } from '../../src/core/ledger.js';
import { createTempDir, cleanupTempDir } from '../helpers/mock-fs.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
});

const sampleEntry = {
  processedAt: '2026-03-15T10:00:00.000Z',
  movedTo: '/processed/receipt.pdf',
  result: {
    vendor: 'Amazon',
    date: '2026-03-15',
    amount: 45.99,
    description: 'Towels',
    category: 'Supplies',
    expenseType: 'operating',
  },
  rawResponse: '{"vendor":"Amazon"}',
  action: 'confirm' as const,
};

describe('loadLedger', () => {
  it('returns empty object when ledger file does not exist', async () => {
    const ledger = await loadLedger(tmpDir);
    expect(ledger).toEqual({});
  });

  it('loads existing ledger', async () => {
    const ledgerDir = path.join(tmpDir, '.r2s');
    await fs.mkdir(ledgerDir, { recursive: true });
    const data: Ledger = { '/inbox/receipt.pdf': sampleEntry };
    await fs.writeFile(path.join(ledgerDir, 'processed.json'), JSON.stringify(data));

    const ledger = await loadLedger(tmpDir);
    expect(ledger['/inbox/receipt.pdf']).toBeDefined();
    expect(ledger['/inbox/receipt.pdf'].result.vendor).toBe('Amazon');
  });
});

describe('saveLedger', () => {
  it('creates .r2s directory and saves ledger', async () => {
    const data: Ledger = { '/inbox/receipt.pdf': sampleEntry };
    await saveLedger(tmpDir, data);

    const raw = await fs.readFile(path.join(tmpDir, '.r2s', 'processed.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed['/inbox/receipt.pdf'].result.vendor).toBe('Amazon');
  });

  it('overwrites existing ledger', async () => {
    await saveLedger(tmpDir, { '/a.pdf': sampleEntry });
    await saveLedger(tmpDir, { '/b.pdf': sampleEntry });

    const raw = await fs.readFile(path.join(tmpDir, '.r2s', 'processed.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed['/a.pdf']).toBeUndefined();
    expect(parsed['/b.pdf']).toBeDefined();
  });
});

describe('isAlreadyProcessed', () => {
  it('returns true for processed file', () => {
    const ledger: Ledger = { '/inbox/receipt.pdf': sampleEntry };
    expect(isAlreadyProcessed(ledger, '/inbox/receipt.pdf')).toBe(true);
  });

  it('returns false for unprocessed file', () => {
    const ledger: Ledger = {};
    expect(isAlreadyProcessed(ledger, '/inbox/receipt.pdf')).toBe(false);
  });
});
