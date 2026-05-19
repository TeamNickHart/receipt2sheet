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

export const ExpenseTypeSchema = z.enum(['operating', 'capital']);

export const ExpenseSchema = z.object({
  vendor: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .refine(
      (s) => {
        const d = new Date(s + 'T00:00:00');
        return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
      },
      { message: 'Invalid date — must be a real YYYY-MM-DD date' },
    ),
  amount: z.number().nonnegative(),
  description: z.string(),
  category: CategorySchema,
  expenseType: ExpenseTypeSchema.default('operating'),
  property: z.string().optional(),
  receiptPath: z.string().optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
