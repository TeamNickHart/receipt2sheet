import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { extractText, readFileAsBase64, getMediaType } from '../../src/core/extract.js';
import { createTempDir, cleanupTempDir, writeTempFile } from '../helpers/mock-fs.js';

const FIXTURES_DIR = path.resolve(import.meta.dirname!, '../fixtures/receipts');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await createTempDir();
});

afterEach(async () => {
  await cleanupTempDir(tmpDir);
});

describe('extractText', () => {
  it('extracts text from a text PDF with dollar amounts', async () => {
    const result = await extractText(path.join(FIXTURES_DIR, 'service-invoice-landscaping.pdf'));
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('Ridgeline');
    expect(result.text).toContain('$259.44');
    expect(result.needsVision).toBe(false);
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('extracts text from a complex payment receipt', async () => {
    const result = await extractText(
      path.join(FIXTURES_DIR, 'payment-processor-pest-control.pdf'),
    );
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('$116.91');
    expect(result.needsVision).toBe(false);
  });

  it('extracts text from a capital purchase invoice', async () => {
    const result = await extractText(path.join(FIXTURES_DIR, 'capital-purchase-spa.pdf'));
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('$8,350.73');
    expect(result.needsVision).toBe(false);
  });

  it('extracts text from a non-invoice document', async () => {
    const result = await extractText(
      path.join(FIXTURES_DIR, 'not-an-invoice-service-agreement.pdf'),
    );
    expect(result.text).toBeTruthy();
    // The service agreement mentions $5,000 valued equipment but it's not an invoice
    expect(result.text).toContain('Mountain Valley Electric');
  });

  it('marks PNG as needing vision with null text', async () => {
    const result = await extractText(path.join(FIXTURES_DIR, 'receipt-photo.png'));
    expect(result.text).toBeNull();
    expect(result.needsVision).toBe(true);
    expect(result.pageCount).toBe(1);
  });

  it('marks JPG as needing vision with null text', async () => {
    const result = await extractText(path.join(FIXTURES_DIR, 'receipt-photo.jpg'));
    expect(result.text).toBeNull();
    expect(result.needsVision).toBe(true);
  });

  it('throws for unsupported file type', async () => {
    // Create a real .txt file so the error is about file type, not ENOENT
    const txtFile = await writeTempFile(tmpDir, 'notes.txt', 'just some notes');
    await expect(extractText(txtFile)).rejects.toThrow('Unsupported file type');
  });
});

describe('readFileAsBase64', () => {
  it('returns base64 string', async () => {
    const result = await readFileAsBase64(path.join(FIXTURES_DIR, 'receipt-photo.png'));
    expect(result).toBeTypeOf('string');
    expect(Buffer.from(result, 'base64').length).toBeGreaterThan(0);
  });
});

describe('getMediaType', () => {
  it.each([
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'],
    ['.pdf', 'application/pdf'],
  ])('returns correct type for %s', (ext, expected) => {
    expect(getMediaType(`file${ext}`)).toBe(expected);
  });

  it('returns octet-stream for unknown type', () => {
    expect(getMediaType('file.xyz')).toBe('application/octet-stream');
  });
});
