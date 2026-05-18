import ExcelJS from 'exceljs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Expense } from '../schemas/expense.js';
import { fileExists } from '../utils/files.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

export async function ensureSpreadsheet(spreadsheetPath: string): Promise<void> {
  if (await fileExists(spreadsheetPath)) return;

  const templatePath = path.join(TEMPLATES_DIR, 'spreadsheets', 'Operating_Expenses.xlsx');
  await copyTemplate(templatePath, spreadsheetPath);
}

export async function appendExpense(spreadsheetPath: string, expense: Expense): Promise<void> {
  await ensureSpreadsheet(spreadsheetPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(spreadsheetPath);

  const sheet = workbook.getWorksheet('Expenses');
  if (!sheet) throw new Error(`'Expenses' sheet not found in ${spreadsheetPath}`);

  // Find first empty row by scanning column A (Date)
  // Headers are typically in rows 1-4, data starts at row 5
  let targetRow = 5;
  while (sheet.getCell(targetRow, 1).value !== null) {
    targetRow++;
  }

  sheet.getCell(targetRow, 1).value = new Date(expense.date);
  sheet.getCell(targetRow, 2).value = expense.category;
  sheet.getCell(targetRow, 3).value = expense.vendor;
  sheet.getCell(targetRow, 4).value = expense.description;
  sheet.getCell(targetRow, 5).value = expense.amount;
  sheet.getCell(targetRow, 6).value = ''; // Payment method
  sheet.getCell(targetRow, 7).value = expense.receiptPath || '';

  await workbook.xlsx.writeFile(spreadsheetPath);
}

export async function backupSpreadsheet(spreadsheetPath: string): Promise<string | null> {
  if (!(await fileExists(spreadsheetPath))) return null;

  const dir = path.dirname(spreadsheetPath);
  const ext = path.extname(spreadsheetPath);
  const base = path.basename(spreadsheetPath, ext);
  const backupPath = path.join(dir, `${base}.bak${ext}`);

  await fs.copyFile(spreadsheetPath, backupPath);
  return backupPath;
}

export async function copyTemplate(templatePath: string, destPath: string): Promise<void> {
  const destDir = path.dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });
  await fs.copyFile(templatePath, destPath);
}
