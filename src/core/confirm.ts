import { select, input } from '@inquirer/prompts';
import Table from 'cli-table3';
import chalk from 'chalk';
import { CategorySchema, type Expense } from '../schemas/expense.js';
import { truncate } from '../utils/files.js';
import { formatDollars } from '../utils/currency.js';

export interface ParsedEntry {
  file: string;
  expense: Expense;
}

export interface ConfirmedEntry extends ParsedEntry {
  action: 'confirm' | 'skip';
}

export async function confirmExpenses(expenses: ParsedEntry[]): Promise<ConfirmedEntry[]> {
  // Display table
  const table = new Table({
    head: ['#', 'File', 'Vendor', 'Date', 'Amount', 'Category'],
    colWidths: [4, 25, 20, 12, 12, 25],
  });

  expenses.forEach((e, i) => {
    table.push([
      i + 1,
      truncate(e.file, 23),
      truncate(e.expense.vendor, 18),
      e.expense.date,
      formatDollars(e.expense.amount),
      e.expense.category,
    ]);
  });

  console.log(table.toString());

  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Confirm all', value: 'confirm-all' as const },
      { name: 'Edit entries', value: 'edit' as const },
      { name: 'Skip all', value: 'skip-all' as const },
    ],
  });

  if (action === 'confirm-all') {
    return expenses.map((e) => ({ ...e, action: 'confirm' as const }));
  }

  if (action === 'skip-all') {
    return expenses.map((e) => ({ ...e, action: 'skip' as const }));
  }

  return editExpenses(expenses);
}

async function editExpenses(expenses: ParsedEntry[]): Promise<ConfirmedEntry[]> {
  const results: ConfirmedEntry[] = [];

  for (const { file, expense } of expenses) {
    console.log(chalk.cyan(`\n--- ${file} ---`));

    const action = await select({
      message: `${expense.vendor} - ${formatDollars(expense.amount)} - ${expense.category}`,
      choices: [
        { name: 'Confirm', value: 'confirm' as const },
        { name: 'Edit', value: 'edit' as const },
        { name: 'Skip', value: 'skip' as const },
      ],
    });

    if (action === 'skip') {
      results.push({ file, expense, action: 'skip' });
      continue;
    }

    if (action === 'confirm') {
      results.push({ file, expense, action: 'confirm' });
      continue;
    }

    const vendor = await input({ message: 'Vendor:', default: expense.vendor });
    const date = await input({ message: 'Date:', default: expense.date });
    const amountStr = await input({ message: 'Amount:', default: String(expense.amount) });
    const description = await input({ message: 'Description:', default: expense.description });
    const category = await select({
      message: 'Category:',
      choices: CategorySchema.options.map((c) => ({ name: c, value: c })),
      default: expense.category,
    });

    results.push({
      file,
      expense: { ...expense, vendor, date, amount: Number(amountStr), description, category },
      action: 'confirm',
    });
  }

  return results;
}
