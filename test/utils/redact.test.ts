import { describe, it, expect } from 'vitest';
import { redactPII, luhnCheck } from '../../src/utils/redact.js';

describe('luhnCheck', () => {
  it('validates known test card numbers', () => {
    expect(luhnCheck('4111111111111111')).toBe(true); // Visa test
    expect(luhnCheck('5500000000000004')).toBe(true); // Mastercard test
    expect(luhnCheck('340000000000009')).toBe(true); // Amex test
    expect(luhnCheck('6011000000000004')).toBe(true); // Discover test
  });

  it('rejects arbitrary digit strings', () => {
    expect(luhnCheck('1234567890123')).toBe(false);
    expect(luhnCheck('0000000000000')).toBe(true); // all zeros technically pass Luhn
    expect(luhnCheck('1111111111111')).toBe(false);
    expect(luhnCheck('9999999999999')).toBe(false);
  });

  it('rejects non-digit strings', () => {
    expect(luhnCheck('abcdefghijklm')).toBe(false);
    expect(luhnCheck('4111-1111-1111-1111')).toBe(false); // must be stripped first
  });
});

describe('redactPII', () => {
  describe('credit cards', () => {
    it('redacts a valid Visa number', () => {
      const { text, redactions } = redactPII('Card: 4111111111111111');
      expect(text).toBe('Card: [REDACTED-CC-1111]');
      expect(redactions.creditCards).toBe(1);
      expect(redactions.total).toBe(1);
    });

    it('redacts a card with dashes', () => {
      const { text } = redactPII('Card: 4111-1111-1111-1111');
      expect(text).toBe('Card: [REDACTED-CC-1111]');
    });

    it('redacts a card with spaces', () => {
      const { text } = redactPII('Card: 4111 1111 1111 1111');
      expect(text).toBe('Card: [REDACTED-CC-1111]');
    });

    it('redacts multiple cards', () => {
      const { text, redactions } = redactPII(
        'Cards: 4111111111111111 and 5500000000000004',
      );
      expect(text).toContain('[REDACTED-CC-1111]');
      expect(text).toContain('[REDACTED-CC-0004]');
      expect(redactions.creditCards).toBe(2);
    });

    it('does not redact numbers that fail Luhn', () => {
      const input = 'Number: 1234567890123';
      const { text, redactions } = redactPII(input);
      expect(text).toBe(input);
      expect(redactions.creditCards).toBe(0);
    });
  });

  describe('SSNs', () => {
    it('redacts SSN format', () => {
      const { text, redactions } = redactPII('SSN: 123-45-6789');
      expect(text).toBe('SSN: [REDACTED-SSN]');
      expect(redactions.ssns).toBe(1);
    });

    it('redacts multiple SSNs', () => {
      const { text, redactions } = redactPII('SSN: 123-45-6789 and 987-65-4321');
      expect(text).toContain('[REDACTED-SSN]');
      expect(redactions.ssns).toBe(2);
    });
  });

  describe('routing numbers', () => {
    it('redacts routing number with keyword', () => {
      const { text, redactions } = redactPII('Routing: 021000021');
      expect(text).toBe('Routing: [REDACTED-ROUTING]');
      expect(redactions.routingNumbers).toBe(1);
    });

    it('redacts ABA number', () => {
      const { text } = redactPII('ABA# 021000021');
      expect(text).toBe('ABA# [REDACTED-ROUTING]');
    });

    it('redacts transit number', () => {
      const { text } = redactPII('Transit: 021000021');
      expect(text).toBe('Transit: [REDACTED-ROUTING]');
    });

    it('does not redact bare 9-digit numbers', () => {
      const input = 'Invoice 021000021';
      const { text, redactions } = redactPII(input);
      expect(text).toBe(input);
      expect(redactions.routingNumbers).toBe(0);
    });
  });

  describe('account numbers', () => {
    it('redacts account number with keyword', () => {
      const { text, redactions } = redactPII('Account: 12345678901');
      expect(text).toBe('Account: [REDACTED-ACCT]');
      expect(redactions.accountNumbers).toBe(1);
    });

    it('redacts acct abbreviation', () => {
      const { text } = redactPII('Acct# 12345678901');
      expect(text).toBe('Acct# [REDACTED-ACCT]');
    });

    it('does not redact without keyword', () => {
      const input = 'Customer ID: 12345678901';
      const { text } = redactPII(input);
      expect(text).toBe(input);
    });
  });

  describe('credit card edge cases', () => {
    it('redacts a card with mixed separators', () => {
      const { text } = redactPII('Card: 4111-1111 1111-1111');
      expect(text).toBe('Card: [REDACTED-CC-1111]');
    });

    it('redacts a card at end of string', () => {
      const { text } = redactPII('Paid with 4111111111111111');
      expect(text).toBe('Paid with [REDACTED-CC-1111]');
    });

    it('redacts a card adjacent to non-digit text', () => {
      const { text } = redactPII('CC:4111111111111111/done');
      expect(text).toContain('[REDACTED-CC-1111]');
      expect(text).not.toContain('4111111111111111');
    });

    it('does not redact when digits are part of a longer number', () => {
      // 20 digits — too long even though a 16-digit substring might pass Luhn
      const input = 'Ref: 12345678901234567890';
      const { text } = redactPII(input);
      expect(text).toBe(input);
    });
  });

  describe('account number boundary lengths', () => {
    it('redacts a 6-digit account number (minimum)', () => {
      const { text, redactions } = redactPII('Account: 123456');
      expect(text).toBe('Account: [REDACTED-ACCT]');
      expect(redactions.accountNumbers).toBe(1);
    });

    it('redacts a 17-digit account number (maximum)', () => {
      const { text, redactions } = redactPII('Account: 12345678901234567');
      expect(text).toBe('Account: [REDACTED-ACCT]');
      expect(redactions.accountNumbers).toBe(1);
    });

    it('does not redact a 5-digit account number (too short)', () => {
      const input = 'Account: 12345';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact an 18-digit account number (too long)', () => {
      const input = 'Account: 123456789012345678';
      expect(redactPII(input).text).toBe(input);
    });
  });

  describe('true negatives (things that should NOT be redacted)', () => {
    it('does not redact dollar amounts', () => {
      const input = '$8,350.73';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact dates', () => {
      const input = '02/19/2024';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact invoice numbers', () => {
      const input = 'Invoice: 01-0479685';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact order numbers', () => {
      const input = 'Order: 111-2725430-3019452';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact zip codes', () => {
      const input = 'ZIP: 98034';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact phone numbers', () => {
      const input = 'Phone: (425) 555-1234';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact masked cards', () => {
      const input = '41**********4415';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact "Visa ending in" format', () => {
      const input = 'Visa ending in 5098';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact customer IDs', () => {
      const input = 'Customer ID: 8847291';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact transaction IDs', () => {
      const input = 'Transaction: 7829103845';
      expect(redactPII(input).text).toBe(input);
    });

    it('does not redact approval codes', () => {
      const input = 'Approval Code: 082947';
      expect(redactPII(input).text).toBe(input);
    });
  });

  describe('integration: full receipt text', () => {
    it('redacts PII without damaging receipt content', () => {
      const receiptText = `
AQUA QUIP
12345 Main Street, Bellevue, WA 98005
Phone: (425) 555-0199

Invoice: 01-0479685
Date: 05/26/2025
Customer ID: 8847291

Hot Tub - Model XR500
Subtotal: $7,850.00
Tax: $500.73
Total: $8,350.73

Payment: Visa 4111111111111111
Approval Code: 082947
Transaction: 7829103845

Cardholder SSN: 123-45-6789
Routing: 021000021
Account: 9876543210
`.trim();

      const { text, redactions } = redactPII(receiptText);

      // PII should be redacted
      expect(text).toContain('[REDACTED-CC-1111]');
      expect(text).toContain('[REDACTED-SSN]');
      expect(text).toContain('[REDACTED-ROUTING]');
      expect(text).toContain('[REDACTED-ACCT]');
      expect(redactions.creditCards).toBe(1);
      expect(redactions.ssns).toBe(1);
      expect(redactions.routingNumbers).toBe(1);
      expect(redactions.accountNumbers).toBe(1);
      expect(redactions.total).toBe(4);

      // Non-PII should be preserved
      expect(text).toContain('AQUA QUIP');
      expect(text).toContain('$8,350.73');
      expect(text).toContain('01-0479685');
      expect(text).toContain('8847291');
      expect(text).toContain('082947');
      expect(text).toContain('7829103845');
      expect(text).toContain('(425) 555-0199');
      expect(text).toContain('98005');
    });

    it('handles text with no PII', () => {
      const input = 'Amazon order for towels, $45.99, shipped 2026-05-12';
      const { text, redactions } = redactPII(input);
      expect(text).toBe(input);
      expect(redactions.total).toBe(0);
    });
  });
});
