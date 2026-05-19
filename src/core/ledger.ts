import fs from 'fs/promises';
import path from 'path';
import { fileExists } from '../utils/files.js';

export interface LedgerEntry {
  processedAt: string;
  movedTo: string | null;
  result: {
    vendor: string;
    date: string;
    amount: number;
    description: string;
    category: string;
    expenseType: string;
  };
  rawResponse: string;
  action: 'confirm' | 'skip';
}

export type Ledger = Record<string, LedgerEntry>;

function ledgerPath(configDir: string): string {
  return path.join(configDir, '.r2s', 'processed.json');
}

export async function loadLedger(configDir: string): Promise<Ledger> {
  const p = ledgerPath(configDir);
  if (!(await fileExists(p))) return {};
  const raw = await fs.readFile(p, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `Corrupted ledger file at ${p}. Back up the file and delete it to start fresh, or fix the JSON manually.`,
    );
  }
}

export async function saveLedger(configDir: string, ledger: Ledger): Promise<void> {
  const p = ledgerPath(configDir);
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  // Atomic write: write to temp file then rename to avoid corruption on crash
  const tmp = path.join(dir, `.processed.json.${Date.now()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(ledger, null, 2), 'utf-8');
  await fs.rename(tmp, p);
}

export function isAlreadyProcessed(ledger: Ledger, filePath: string): boolean {
  return filePath in ledger;
}
