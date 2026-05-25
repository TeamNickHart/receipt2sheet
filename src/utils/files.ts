import fs from 'fs/promises';
import path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 2) + '..';
}

const SUPPORTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a descriptive filename for a processed receipt.
 * Format: {vendor}_{date}_{amount}.{ext}
 * e.g. "home-depot_2026-05-20_43.pdf"
 */
export function receiptFilename(vendor: string, date: string, amount: number, ext: string): string {
  const slug = slugify(vendor);
  const rounded = Math.round(amount);
  const extension = ext.startsWith('.') ? ext.slice(1) : ext;
  return `${slug}_${date}_${rounded}.${extension}`;
}

/**
 * Find a unique path, appending -2, -3, etc. if the file already exists.
 */
export async function uniquePath(filePath: string): Promise<string> {
  if (!(await fileExists(filePath))) return filePath;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  let n = 2;
  let candidate: string;
  do {
    candidate = path.join(dir, `${base}-${n}${ext}`);
    n++;
  } while (await fileExists(candidate));

  return candidate;
}

export async function listInboxFiles(inboxPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(inboxPath, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && isSupportedFile(e.name))
      .map((e) => path.join(e.parentPath, e.name))
      .sort();
  } catch {
    return [];
  }
}
