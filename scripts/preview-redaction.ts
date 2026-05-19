#!/usr/bin/env npx tsx
/**
 * Preview what redaction does to your real receipts.
 *
 * Usage:
 *   npx tsx scripts/preview-redaction.ts inbox/*.pdf
 *   npx tsx scripts/preview-redaction.ts path/to/receipt.pdf
 *
 * For each PDF with extractable text, prints:
 *   1. The raw extracted text
 *   2. The redacted version (what would be sent to the API)
 *   3. A summary of what was redacted
 *
 * No API calls are made. Nothing leaves your machine.
 */

import { extractText } from '../src/core/extract.js';
import { redactPII } from '../src/utils/redact.js';
import path from 'path';

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: npx tsx scripts/preview-redaction.ts <file> [file...]');
  process.exit(1);
}

for (const file of files) {
  const name = path.basename(file);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${name}`);
  console.log('='.repeat(60));

  try {
    const { text, needsVision } = await extractText(file);

    if (!text) {
      console.log(`  [No extractable text — would use ${needsVision ? 'vision/PDF' : 'unknown'} path]`);
      console.log('  ⚠ Image/PDF vision paths send binary data and cannot be text-redacted.');
      continue;
    }

    const { text: redacted, redactions } = redactPII(text);

    if (redactions.total === 0) {
      console.log('\n--- EXTRACTED TEXT (no PII detected) ---');
      console.log(text);
      console.log('\n✓ No redactions needed');
    } else {
      console.log('\n--- ORIGINAL TEXT ---');
      console.log(text);
      console.log('\n--- REDACTED TEXT (what gets sent to API) ---');
      console.log(redacted);
      console.log('\n--- REDACTION SUMMARY ---');
      if (redactions.creditCards > 0) console.log(`  Credit cards: ${redactions.creditCards}`);
      if (redactions.ssns > 0) console.log(`  SSNs: ${redactions.ssns}`);
      if (redactions.routingNumbers > 0) console.log(`  Routing numbers: ${redactions.routingNumbers}`);
      if (redactions.accountNumbers > 0) console.log(`  Account numbers: ${redactions.accountNumbers}`);
      console.log(`  Total redactions: ${redactions.total}`);
    }

    if (needsVision) {
      console.log('\n  ⚠ Text extraction was partial — vision fallback would also be used.');
      console.log('    The vision path sends the PDF as binary and cannot be text-redacted.');
    }
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}`);
  }
}
