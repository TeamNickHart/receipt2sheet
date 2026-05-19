import { select, input } from '@inquirer/prompts';
import Table from 'cli-table3';
import chalk from 'chalk';
import { CategorySchema, ExpenseSchema, type Expense } from '../schemas/expense.js';
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
  const table = new Table({
    head: ['#', 'File', 'Vendor', 'Date', 'Amount', 'Category', 'Type'],
    colWidths: [4, 22, 18, 12, 12, 22, 12],
  });

  expenses.forEach((e, i) => {
    table.push([
      i + 1,
      truncate(e.file, 20),
      truncate(e.expense.vendor, 16),
      e.expense.date,
      formatDollars(e.expense.amount),
      truncate(e.expense.category, 20),
      e.expense.expenseType === 'capital' ? 'CAPITAL' : 'operating',
    ]);
  });

  console.log(table.toString());

  // Build choices dynamically — only show "Confirm invoices" if there are non-invoice entries
  const hasNonInvoices = expenses.some((e) => e.expense.amount === 0);
  const choices = [
    { name: 'Confirm all', value: 'confirm-all' as const },
    ...(hasNonInvoices
      ? [{ name: 'Confirm invoices only (skip $0 entries)', value: 'confirm-invoices' as const }]
      : []),
    { name: 'Edit entries', value: 'edit' as const },
    { name: 'Skip all', value: 'skip-all' as const },
  ];

  const action = await select({ message: 'What would you like to do?', choices });

  if (action === 'confirm-all') {
    return expenses.map((e) => ({ ...e, action: 'confirm' as const }));
  }

  if (action === 'confirm-invoices') {
    return expenses.map((e) => ({
      ...e,
      action: (e.expense.amount > 0 ? 'confirm' : 'skip') as 'confirm' | 'skip',
    }));
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

    const typeTag = expense.expenseType === 'capital' ? chalk.yellow(' [CAPITAL]') : '';
    const action = await select({
      message: `${expense.vendor} - ${formatDollars(expense.amount)} - ${expense.category}${typeTag}`,
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
    const expenseType = await select({
      message: 'Expense type:',
      choices: [
        { name: 'Operating (regular expense)', value: 'operating' as const },
        { name: 'Capital (depreciated improvement)', value: 'capital' as const },
      ],
      default: expense.expenseType,
    });

    const amount = Number(amountStr);
    if (isNaN(amount)) {
      console.log(
        chalk.red(`  Invalid amount "${amountStr}" — keeping original (${expense.amount})`),
      );
      results.push({ file, expense, action: 'confirm' });
      continue;
    }

    const edited = {
      ...expense,
      vendor,
      date,
      amount,
      description,
      category,
      expenseType,
    };

    const validation = ExpenseSchema.safeParse(edited);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => i.message).join('; ');
      console.log(chalk.red(`  Invalid input: ${issues} — keeping original values`));
      results.push({ file, expense, action: 'confirm' });
      continue;
    }

    results.push({
      file,
      expense: validation.data,
      action: 'confirm',
    });
  }

  return results;
}
