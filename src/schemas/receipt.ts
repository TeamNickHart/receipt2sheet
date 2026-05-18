import { z } from 'zod';
import { CategorySchema } from './expense.js';

export const ExpenseTypeSchema = z.enum(['operating', 'capital']);

export const ReceiptParseResultSchema = z.object({
  vendor: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative(),
  description: z.string(),
  category: CategorySchema,
  expense_type: ExpenseTypeSchema.default('operating'),
});

export type ExpenseType = z.infer<typeof ExpenseTypeSchema>;
export type ReceiptParseResult = z.infer<typeof ReceiptParseResultSchema>;
