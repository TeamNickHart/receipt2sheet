import { z } from 'zod';

export const CategorySchema = z.enum([
  'Advertising',
  'Auto and travel',
  'Cleaning and maintenance',
  'Commissions',
  'Insurance',
  'Legal and professional fees',
  'Management fees',
  'Mortgage interest',
  'Other interest',
  'Repairs',
  'Supplies',
  'Taxes',
  'Utilities',
  'Depreciation',
  'Other',
]);

export const ExpenseSchema = z.object({
  vendor: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative(),
  description: z.string(),
  category: CategorySchema,
  property: z.string().optional(),
  receiptPath: z.string().optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
