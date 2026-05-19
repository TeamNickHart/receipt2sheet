#!/usr/bin/env tsx
/**
 * Record real Claude API responses for test fixtures.
 * Requires ANTHROPIC_API_KEY env var.
 *
 * Run: pnpm fixtures:record
 *
 * This sends each fixture receipt through the real parse pipeline
 * and saves the JSON response for use in mocked tests.
 */

import fs from 'fs';
import path from 'path';
import { extractText, readFileAsBase64, getMediaType } from '../src/core/extract.js';
import { parseReceipt } from '../src/core/parse.js';

const RECEIPTS_DIR = path.resolve(import.meta.dirname!, '../test/fixtures/receipts');
const RESPONSES_DIR = path.resolve(import.meta.dirname!, '../test/fixtures/api-responses');

const KNOWN_VENDORS = {
  Amazon: { category: 'Supplies' },
  'Home Depot': { category: 'Supplies' },
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY env var is required');
    process.exit(1);
  }

  fs.mkdirSync(RESPONSES_DIR, { recursive: true });

  const files = fs.readdirSync(RECEIPTS_DIR).filter((f) => /\.(pdf|png|jpg|jpeg|webp)$/i.test(f));

  console.log(`Recording API responses for ${files.length} fixture(s)...\n`);

  for (const file of files) {
    const filePath = path.join(RECEIPTS_DIR, file);
    const baseName = path.basename(file, path.extname(file));
    const outPath = path.join(RESPONSES_DIR, `${baseName}.json`);

    process.stdout.write(`  ${file}... `);

    try {
      const ext = path.extname(file).toLowerCase();
      let result;

      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        const base64 = await readFileAsBase64(filePath);
        const mediaType = getMediaType(filePath);
        result = await parseReceipt({ type: 'image', data: base64, mediaType }, KNOWN_VENDORS);
      } else if (ext === '.pdf') {
        const extraction = await extractText(filePath);
        if (extraction.text && !extraction.needsVision) {
          result = await parseReceipt({ type: 'text', text: extraction.text }, KNOWN_VENDORS);
        } else {
          const base64 = await readFileAsBase64(filePath);
          result = await parseReceipt(
            { type: 'document', data: base64, mediaType: 'application/pdf' },
            KNOWN_VENDORS,
          );
        }
      } else {
        console.log('skipped (unsupported)');
        continue;
      }

      fs.writeFileSync(outPath, JSON.stringify(result.parsed, null, 2));
      console.log(`done ($${result.parsed.amount.toFixed(2)})`);
    } catch (err) {
      console.log(`failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nResponses saved to ${RESPONSES_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
