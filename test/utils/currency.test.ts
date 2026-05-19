import { describe, it, expect } from 'vitest';
import { formatDollars, parseDollars } from '../../src/utils/currency.js';

describe('formatDollars', () => {
  it('formats a positive amount', () => {
    expect(formatDollars(45.99)).toBe('$45.99');
  });

  it('formats zero', () => {
    expect(formatDollars(0)).toBe('$0.00');
  });

  it('formats a large amount', () => {
    expect(formatDollars(12345.6)).toBe('$12345.60');
  });

  it('rounds to two decimal places', () => {
    expect(formatDollars(1.999)).toBe('$2.00');
  });
});

describe('parseDollars', () => {
  it('parses a plain number string', () => {
    expect(parseDollars('45.99')).toBe(45.99);
  });

  it('parses with dollar sign', () => {
    expect(parseDollars('$45.99')).toBe(45.99);
  });

  it('parses with commas', () => {
    expect(parseDollars('$1,234.56')).toBe(1234.56);
  });

  it('parses with leading/trailing whitespace', () => {
    expect(parseDollars('  $99.00  ')).toBe(99);
  });

  it('returns null for invalid input', () => {
    expect(parseDollars('not a number')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDollars('')).toBeNull();
  });

  it('parses zero', () => {
    expect(parseDollars('$0.00')).toBe(0);
  });
});
