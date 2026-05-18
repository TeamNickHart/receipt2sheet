import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';

export interface ExtractionResult {
  text: string | null;
  needsVision: boolean;
  pageCount: number;
}

export async function extractText(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const data = await pdf(buffer);
    const text = data.text.trim();

    // Check if extraction got meaningful text
    const hasContent = text.length > 50;
    const hasAmounts = /\$?\d[\d,]*\.\d{2}/.test(text);

    return {
      text: hasContent ? text : null,
      needsVision: !hasContent || !hasAmounts,
      pageCount: data.numpages,
    };
  }

  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return { text: null, needsVision: true, pageCount: 1 };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

export async function readFileAsBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

export function getMediaType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return types[ext] || 'application/octet-stream';
}
