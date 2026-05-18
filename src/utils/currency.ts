export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function parseDollars(str: string): number | null {
  const cleaned = str.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
