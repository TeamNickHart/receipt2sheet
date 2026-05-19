import Anthropic from '@anthropic-ai/sdk';
import type {
  ImageBlockParam,
  TextBlockParam,
  DocumentBlockParam,
  ContentBlockParam,
} from '@anthropic-ai/sdk/resources/messages.js';
import { ReceiptParseResultSchema, type ReceiptParseResult } from '../schemas/receipt.js';
import type { Vendor } from '../schemas/config.js';
import { redactPII } from '../utils/redact.js';

const MODEL_ALIASES: Record<string, string> = {
  small: 'claude-haiku-4-5-20251001',
  medium: 'claude-sonnet-4-6',
  large: 'claude-opus-4-6',
};

const DEFAULT_MODEL = 'medium';

function resolveModel(): string {
  const env = process.env.R2S_MODEL || DEFAULT_MODEL;
  return MODEL_ALIASES[env] || env;
}

const SYSTEM_PROMPT = `You are a receipt parser for rental property expense tracking.

Given a receipt or invoice (as text, image, or PDF), extract:
- vendor: The business name
- date: Date of purchase/service (YYYY-MM-DD format)
- amount: Total amount paid (number, no $ sign). Use 0 if no amount is found (e.g. service agreements).
- description: Brief description of what was purchased or the nature of the document
- category: Best matching Schedule E category from this list:
  - Advertising
  - Auto and travel
  - Cleaning and maintenance
  - Commissions
  - Insurance
  - Legal and professional fees
  - Management fees
  - Mortgage interest
  - Other interest
  - Repairs
  - Supplies
  - Taxes
  - Utilities
  - Other
- expense_type: Either "operating" or "capital"
  - "operating": Regular expenses (supplies, repairs, utilities, cleaning, etc.)
  - "capital": Major purchases that add value and get depreciated over time.
    Examples: appliances, hot tubs, furniture sets, renovations, HVAC systems, roofing.
    Rule of thumb: if it's a significant asset with a useful life beyond one year, it's capital.

Respond with JSON only, no markdown, no explanation.

Example responses:
{"vendor":"Amazon","date":"2026-05-12","amount":45.99,"description":"Replacement towels and sheets","category":"Supplies","expense_type":"operating"}
{"vendor":"Aqua Quip","date":"2025-05-26","amount":8350.73,"description":"Hot tub purchase and installation","category":"Other","expense_type":"capital"}`;

export type ReceiptContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mediaType: string }
  | { type: 'document'; data: string; mediaType: 'application/pdf' };

export interface ParseResult {
  parsed: ReceiptParseResult;
  rawResponse: string;
}

export async function parseReceipt(
  content: ReceiptContent,
  knownVendors: Record<string, Vendor>,
): Promise<ParseResult> {
  const client = new Anthropic();

  const vendorHint =
    Object.keys(knownVendors).length > 0
      ? `\n\nKnown vendors and their usual categories:\n${Object.entries(knownVendors)
          .map(([v, { category }]) => `- ${v}: ${category}`)
          .join('\n')}`
      : '';

  let userContent: Array<ContentBlockParam>;

  if (content.type === 'text') {
    const { text: redactedText } = redactPII(content.text);
    userContent = [{ type: 'text', text: redactedText + vendorHint }];
  } else if (content.type === 'image') {
    userContent = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: content.mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
          data: content.data,
        },
      } satisfies ImageBlockParam,
      { type: 'text', text: 'Parse this receipt.' + vendorHint } satisfies TextBlockParam,
    ];
  } else {
    userContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: content.data,
        },
      } satisfies DocumentBlockParam,
      { type: 'text', text: 'Parse this receipt.' + vendorHint } satisfies TextBlockParam,
    ];
  }

  const response = await client.messages.create({
    model: resolveModel(),
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const rawResponse = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(rawResponse);

  return {
    parsed: ReceiptParseResultSchema.parse(parsed),
    rawResponse,
  };
}
