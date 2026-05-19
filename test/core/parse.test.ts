import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

import { parseReceipt } from '../../src/core/parse.js';

describe('parseReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validResponse = JSON.stringify({
    vendor: 'Amazon',
    date: '2026-03-15',
    amount: 45.99,
    description: 'Towels',
    category: 'Supplies',
    expense_type: 'operating',
  });

  it('parses text content', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: validResponse }],
    });

    const result = await parseReceipt({ type: 'text', text: 'Invoice text...' }, {});
    expect(result.parsed.vendor).toBe('Amazon');
    expect(result.parsed.amount).toBe(45.99);
    expect(result.rawResponse).toBe(validResponse);
  });

  it('parses image content', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: validResponse }],
    });

    const result = await parseReceipt(
      { type: 'image', data: 'base64data', mediaType: 'image/png' },
      {},
    );
    expect(result.parsed.vendor).toBe('Amazon');

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent[0].type).toBe('image');
    expect(userContent[1].type).toBe('text');
  });

  it('parses document content', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: validResponse }],
    });

    const result = await parseReceipt(
      { type: 'document', data: 'base64pdf', mediaType: 'application/pdf' },
      {},
    );
    expect(result.parsed.vendor).toBe('Amazon');

    const callArgs = mockCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent[0].type).toBe('document');
  });

  it('includes vendor hints when vendors provided', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: validResponse }],
    });

    await parseReceipt({ type: 'text', text: 'Invoice...' }, {
      Amazon: { category: 'Supplies' },
      'Home Depot': { category: 'Repairs' },
    });

    const callArgs = mockCreate.mock.calls[0][0];
    const textContent = callArgs.messages[0].content[0].text;
    expect(textContent).toContain('Amazon: Supplies');
    expect(textContent).toContain('Home Depot: Repairs');
  });

  it('throws on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
    });

    await expect(parseReceipt({ type: 'text', text: 'test' }, {})).rejects.toThrow();
  });

  it('redacts credit card numbers from text before API call', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: validResponse }],
    });

    await parseReceipt(
      { type: 'text', text: 'Payment: Visa 4111111111111111\nTotal: $45.99' },
      {},
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const textContent = callArgs.messages[0].content[0].text;
    expect(textContent).toContain('[REDACTED-CC-1111]');
    expect(textContent).not.toContain('4111111111111111');
  });

  it('throws on Zod validation failure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ vendor: '' }) }],
    });

    await expect(parseReceipt({ type: 'text', text: 'test' }, {})).rejects.toThrow();
  });
});
