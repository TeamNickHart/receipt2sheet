import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { ensureDir, fileExists, truncate, isSupportedFile, listInboxFiles, receiptFilename, uniquePath } from '../../src/utils/files.js';
import { createTempDir, cleanupTempDir } from '../helpers/mock-fs.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
});

describe('ensureDir', () => {
  it('creates a new directory', async () => {
    const dir = path.join(tmpDir, 'new-dir');
    await ensureDir(dir);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('is idempotent', async () => {
    const dir = path.join(tmpDir, 'existing');
    await ensureDir(dir);
    await ensureDir(dir); // should not throw
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('creates nested directories', async () => {
    const dir = path.join(tmpDir, 'a', 'b', 'c');
    await ensureDir(dir);
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('fileExists', () => {
  it('returns true for existing file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await fs.writeFile(filePath, 'hello');
    expect(await fileExists(filePath)).toBe(true);
  });

  it('returns false for non-existent file', async () => {
    expect(await fileExists(path.join(tmpDir, 'nope.txt'))).toBe(false);
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ..', () => {
    // slice(0, 8-2) = 'hello ' + '..' = 'hello ..'
    expect(truncate('hello world', 8)).toBe('hello ..');
  });

  it('returns string at exact max length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('isSupportedFile', () => {
  it.each(['.pdf', '.png', '.jpg', '.jpeg', '.webp'])('accepts %s', (ext) => {
    expect(isSupportedFile(`receipt${ext}`)).toBe(true);
  });

  it.each(['.txt', '.doc', '.docx', '.csv', '.html'])('rejects %s', (ext) => {
    expect(isSupportedFile(`file${ext}`)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedFile('receipt.PDF')).toBe(true);
    expect(isSupportedFile('photo.JPG')).toBe(true);
  });
});

describe('receiptFilename', () => {
  it('builds vendor_date_amount.ext', () => {
    expect(receiptFilename('Home Depot', '2026-05-20', 42.99, '.pdf')).toBe(
      'home-depot_2026-05-20_43.pdf',
    );
  });

  it('rounds to nearest dollar', () => {
    expect(receiptFilename('Amazon', '2026-01-05', 89.49, '.png')).toBe(
      'amazon_2026-01-05_89.png',
    );
    expect(receiptFilename('Amazon', '2026-01-05', 89.50, '.png')).toBe(
      'amazon_2026-01-05_90.png',
    );
  });

  it('handles zero amount', () => {
    expect(receiptFilename('Costco', '2026-03-15', 0, '.jpg')).toBe(
      'costco_2026-03-15_0.jpg',
    );
  });

  it('handles ext with or without leading dot', () => {
    expect(receiptFilename('Ikea', '2026-06-01', 250, '.pdf')).toBe(
      'ikea_2026-06-01_250.pdf',
    );
    expect(receiptFilename('Ikea', '2026-06-01', 250, 'pdf')).toBe(
      'ikea_2026-06-01_250.pdf',
    );
  });

  it('slugifies vendor names with special characters', () => {
    expect(receiptFilename("Lowe's", '2026-02-14', 33, '.pdf')).toBe(
      'lowe-s_2026-02-14_33.pdf',
    );
  });
});

describe('uniquePath', () => {
  it('returns the path as-is when no collision', async () => {
    const filePath = path.join(tmpDir, 'receipt.pdf');
    expect(await uniquePath(filePath)).toBe(filePath);
  });

  it('appends -2 on first collision', async () => {
    const filePath = path.join(tmpDir, 'receipt.pdf');
    await fs.writeFile(filePath, 'exists');
    expect(await uniquePath(filePath)).toBe(path.join(tmpDir, 'receipt-2.pdf'));
  });

  it('appends -3 when -2 also exists', async () => {
    const filePath = path.join(tmpDir, 'receipt.pdf');
    await fs.writeFile(filePath, 'exists');
    await fs.writeFile(path.join(tmpDir, 'receipt-2.pdf'), 'exists');
    expect(await uniquePath(filePath)).toBe(path.join(tmpDir, 'receipt-3.pdf'));
  });
});

describe('listInboxFiles', () => {
  it('lists only supported files', async () => {
    await fs.writeFile(path.join(tmpDir, 'receipt.pdf'), 'fake');
    await fs.writeFile(path.join(tmpDir, 'photo.png'), 'fake');
    await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'fake');
    await fs.writeFile(path.join(tmpDir, '.DS_Store'), 'fake');

    const files = await listInboxFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.endsWith('.pdf') || f.endsWith('.png'))).toBe(true);
  });

  it('returns sorted paths', async () => {
    await fs.writeFile(path.join(tmpDir, 'b.pdf'), 'fake');
    await fs.writeFile(path.join(tmpDir, 'a.pdf'), 'fake');

    const files = await listInboxFiles(tmpDir);
    expect(path.basename(files[0])).toBe('a.pdf');
    expect(path.basename(files[1])).toBe('b.pdf');
  });

  it('returns empty array for non-existent directory', async () => {
    const files = await listInboxFiles(path.join(tmpDir, 'nonexistent'));
    expect(files).toEqual([]);
  });
});
