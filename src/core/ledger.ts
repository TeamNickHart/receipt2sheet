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
  return JSON.parse(raw);
}

export async function saveLedger(configDir: string, ledger: Ledger): Promise<void> {
  const p = ledgerPath(configDir);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(ledger, null, 2), 'utf-8');
}

export function isAlreadyProcessed(ledger: Ledger, filePath: string): boolean {
  return filePath in ledger;
}
