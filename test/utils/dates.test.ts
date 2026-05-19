import { describe, it, expect } from 'vitest';
import { currentYear, currentYearMonth, formatDate } from '../../src/utils/dates.js';

describe('currentYear', () => {
  it('returns the current year as a number', () => {
    const year = currentYear();
    expect(year).toBeTypeOf('number');
    expect(year).toBeGreaterThanOrEqual(2026);
  });
});

describe('currentYearMonth', () => {
  it('returns YYYY-MM format', () => {
    const ym = currentYearMonth();
    expect(ym).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(formatDate(new Date(2026, 2, 1))).toBe('2026-03-01');
  });

  it('handles December 31', () => {
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
