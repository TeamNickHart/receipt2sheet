import { z } from 'zod';

export const PropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
  type: z.enum(['short-term-rental', 'long-term-rental']),
  placed_in_service: z.string().optional(),
});

export const VendorSchema = z.object({
  category: z.string(),
  aliases: z.array(z.string()).optional(),
});

export const ConfigSchema = z.object({
  version: z.number().default(1),
  properties: z.array(PropertySchema).min(1),
  default_property: z.string(),
  spreadsheets: z.object({
    operating_expenses: z.string(),
    capital_improvements: z.string(),
    year_end_summary: z.string(),
  }),
  categories: z.array(z.string()),
  vendors: z.record(z.string(), VendorSchema).optional().default({}),
  inbox: z.string().default('inbox/'),
  processed: z.string().default('processed/'),
  /** @deprecated — receipts are now always renamed to {vendor}_{date}_{amount}.{ext} */
  organize_processed_by: z.enum(['year-month', 'vendor', 'flat']).optional(),
  options: z
    .object({
      require_confirmation: z.boolean().default(true),
      auto_categorize_known_vendors: z.boolean().default(true),
      move_processed_receipts: z.boolean().default(true),
      backup_spreadsheets: z.boolean().default(true),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Property = z.infer<typeof PropertySchema>;
export type Vendor = z.infer<typeof VendorSchema>;
