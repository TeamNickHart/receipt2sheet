export interface RedactionSummary {
  creditCards: number;
  ssns: number;
  routingNumbers: number;
  accountNumbers: number;
  total: number;
}

export interface RedactionResult {
  text: string;
  redactions: RedactionSummary;
}

export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// Match 13-19 digit sequences with optional space/dash separators
const CC_PATTERN = /\b(\d[ -]?){13,19}\b/g;

// SSN: exactly 3-2-4 with hyphens
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

// Routing numbers: keyword + 9 digits
const ROUTING_PATTERN = /(?:routing|aba|transit)[\s#:]*(\d{9})\b/gi;

// Account numbers: keyword + 6-17 digits
const ACCOUNT_PATTERN = /(?:account|acct)[\s#:]*(\d{6,17})\b/gi;

export function redactPII(text: string): RedactionResult {
  const redactions: RedactionSummary = {
    creditCards: 0,
    ssns: 0,
    routingNumbers: 0,
    accountNumbers: 0,
    total: 0,
  };

  // 1. SSNs (most specific format)
  let result = text.replace(SSN_PATTERN, () => {
    redactions.ssns++;
    return '[REDACTED-SSN]';
  });

  // 2. Credit cards — find digit sequences, validate with Luhn
  result = result.replace(CC_PATTERN, (match) => {
    const digits = match.replace(/[ -]/g, '');
    if (digits.length < 13 || digits.length > 19) return match;
    if (!luhnCheck(digits)) return match;
    const last4 = digits.slice(-4);
    redactions.creditCards++;
    return `[REDACTED-CC-${last4}]`;
  });

  // 3. Routing numbers (context-dependent)
  result = result.replace(ROUTING_PATTERN, (match, digits) => {
    redactions.routingNumbers++;
    return match.replace(digits, '[REDACTED-ROUTING]');
  });

  // 4. Account numbers (context-dependent)
  result = result.replace(ACCOUNT_PATTERN, (match, digits) => {
    redactions.accountNumbers++;
    return match.replace(digits, '[REDACTED-ACCT]');
  });

  redactions.total =
    redactions.creditCards +
    redactions.ssns +
    redactions.routingNumbers +
    redactions.accountNumbers;

  return { text: result, redactions };
}
