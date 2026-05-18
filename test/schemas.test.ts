import { describe, it, expect } from 'vitest';
import { ExpenseSchema, CategorySchema } from '../src/schemas/expense.js';
import { ConfigSchema } from '../src/schemas/config.js';
import { ReceiptParseResultSchema } from '../src/schemas/receipt.js';

describe('ExpenseSchema', () => {
  it('validates a valid expense', () => {
    const result = ExpenseSchema.parse({
      vendor: 'Amazon',
      date: '2026-05-12',
      amount: 45.99,
      description: 'Replacement towels',
      category: 'Supplies',
    });
    expect(result.vendor).toBe('Amazon');
    expect(result.amount).toBe(45.99);
  });

  it('rejects invalid date format', () => {
    expect(() =>
      ExpenseSchema.parse({
        vendor: 'Amazon',
        date: '05/12/2026',
        amount: 45.99,
        description: 'Towels',
        category: 'Supplies',
      }),
    ).toThrow();
  });

  it('allows zero amount (agreements without invoiced amount)', () => {
    const result = ExpenseSchema.parse({
      vendor: 'Peninsula Light',
      date: '2026-05-12',
      amount: 0,
      description: 'Service agreement',
      category: 'Utilities',
    });
    expect(result.amount).toBe(0);
  });

  it('rejects negative amount', () => {
    expect(() =>
      ExpenseSchema.parse({
        vendor: 'Amazon',
        date: '2026-05-12',
        amount: -10,
        description: 'Towels',
        category: 'Supplies',
      }),
    ).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() =>
      ExpenseSchema.parse({
        vendor: 'Amazon',
        date: '2026-05-12',
        amount: 45.99,
        description: 'Towels',
        category: 'InvalidCategory',
      }),
    ).toThrow();
  });
});

describe('CategorySchema', () => {
  it('accepts all Schedule E categories', () => {
    const categories = [
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
    ];
    for (const cat of categories) {
      expect(CategorySchema.parse(cat)).toBe(cat);
    }
  });
});

describe('ReceiptParseResultSchema', () => {
  it('validates a Claude API response', () => {
    const result = ReceiptParseResultSchema.parse({
      vendor: 'Home Depot',
      date: '2026-03-15',
      amount: 127.43,
      description: 'Plumbing supplies for bathroom repair',
      category: 'Repairs',
    });
    expect(result.vendor).toBe('Home Depot');
  });
});

describe('ConfigSchema', () => {
  it('validates a minimal config', () => {
    const result = ConfigSchema.parse({
      properties: [{ id: 'cabin', name: 'Cabin', type: 'short-term-rental' }],
      default_property: 'cabin',
      spreadsheets: {
        operating_expenses: 'spreadsheets/Operating_Expenses_{year}.xlsx',
        capital_improvements: 'spreadsheets/Capital_Improvements.xlsx',
        year_end_summary: 'spreadsheets/Year_End_Summary_{year}.xlsx',
      },
      categories: ['Supplies', 'Repairs'],
    });
    expect(result.default_property).toBe('cabin');
    expect(result.options.require_confirmation).toBe(true);
  });
});
