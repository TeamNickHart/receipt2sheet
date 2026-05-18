# receipt2sheet

A CLI tool for rental property owners to process receipts and invoices into organized expense spreadsheets using Claude AI.

## Vision

Drop receipts into a folder, run a command, confirm the parsed data, and have your spreadsheets updated automatically. Designed for Airbnb/VRBO hosts who need clean records for Schedule E tax filing.

## User Journey

```
User drops receipts in inbox/
          │
          ▼
$ r2s process
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Parsed 4 receipts:                                          │
│                                                             │
│ ┌──────────────────┬────────┬─────────┬───────────────────┐ │
│ │ File             │ Vendor │ Amount  │ Category          │ │
│ ├──────────────────┼────────┼─────────┼───────────────────┤ │
│ │ amazon-05-12.pdf │ Amazon │ $45.99  │ Supplies          │ │
│ │ plumber.pdf      │ Anew.. │ $180.00 │ Repairs           │ │
│ │ costco-05-08.pdf │ Costco │ $89.42  │ Supplies          │ │
│ │ electric-bill.pdf│ Penin..│ $67.23  │ Utilities         │ │
│ └──────────────────┴────────┴─────────┴───────────────────┘ │
│                                                             │
│ [C]onfirm all  [E]dit  [S]kip  [Q]uit                      │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
Spreadsheet updated. Receipts moved to processed/
```

## Installation & Setup

```bash
npm install -g receipt2sheet

# Set API key (one-time)
export ANTHROPIC_API_KEY=sk-ant-...

# Initialize in your rental folder
cd ~/Documents/CabinRental
r2s init
```

### What `init` Creates

```
CabinRental/
├── r2s.yaml                      # Configuration
├── inbox/                        # Drop receipts here
├── processed/                    # Receipts move here after processing
├── spreadsheets/
│   ├── Operating_Expenses_2026.xlsx
│   ├── Capital_Improvements.xlsx
│   └── Year_End_Summary.xlsx
└── .r2s/
    └── vendor-cache.json         # Learned vendor → category mappings
```

## Configuration

### r2s.yaml

```yaml
# receipt2sheet configuration

version: 1

# Your properties (most people have 1-2)
properties:
  - id: cabin
    name: "Fox Island Cabin"
    location: "Fox Island, WA"
    type: short-term-rental    # short-term-rental | long-term-rental
    placed_in_service: 2026-01  # When rental activity began (for tax purposes)
    
  - id: maui
    name: "Maui Condo"
    location: "Kihei, HI"
    type: short-term-rental
    placed_in_service: 2020-06

# Default property when not specified
default_property: cabin

# Spreadsheet locations (relative to this file)
spreadsheets:
  operating_expenses: "spreadsheets/Operating_Expenses_{year}.xlsx"
  capital_improvements: "spreadsheets/Capital_Improvements.xlsx"
  year_end_summary: "spreadsheets/Year_End_Summary_{year}.xlsx"

# Schedule E categories (IRS standard, but you can add custom ones)
categories:
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
  - Depreciation
  - Other

# Known vendors and their default categories
# (Tool learns new ones automatically and adds them here)
vendors:
  Amazon:
    category: Supplies
    aliases: ["AMAZON.COM", "AMZN"]
  Costco:
    category: Supplies
    aliases: ["COSTCO WHOLESALE", "COSTCO.COM"]
  Home Depot:
    category: Supplies
    aliases: ["THE HOME DEPOT"]
  # Add your local vendors:
  # Peninsula Light:
  #   category: Utilities
  # Anewhere Plumbing:
  #   category: Repairs

# Receipt organization
inbox: "inbox/"
processed: "processed/"
organize_processed_by: "year-month"  # year-month | vendor | flat

# Processing options
options:
  require_confirmation: true         # Always prompt before updating spreadsheet
  auto_categorize_known_vendors: true
  move_processed_receipts: true
  backup_spreadsheets: true          # Create .bak before modifying
```

## CLI Commands

### `r2s init`

Initialize a new rental tracking folder.

```bash
r2s init [--property <name>] [--year <year>]

Options:
  --property    Property name (prompts if not provided)
  --year        Tax year to start with (default: current year)
```

### `r2s process`

Process receipts from inbox.

```bash
r2s process [files...] [options]

Arguments:
  files         Specific files to process (default: inbox/*)

Options:
  --property    Which property these expenses are for
  --dry-run     Show what would be parsed without updating spreadsheets
  --yes         Skip confirmation prompt (use with caution)
  --category    Override category for all receipts in this batch

Examples:
  r2s process
  r2s process inbox/plumber-invoice.pdf --property cabin
  r2s process *.pdf --category "Repairs" --yes
```

### `r2s add`

Manually add an expense (for cash payments, etc.).

```bash
r2s add --vendor "Hardware Store" --amount 45.99 --category Supplies --date 2026-05-15

Options:
  --vendor      Vendor/payee name (required)
  --amount      Dollar amount (required)
  --category    Schedule E category (required)
  --date        Date of expense (default: today)
  --description Description/notes
  --property    Which property
```

### `r2s status`

Show summary of current year's expenses.

```bash
r2s status [--year <year>] [--property <property>]

Output:
  Property: Fox Island Cabin
  Year: 2026
  
  Expenses by Category:
    Supplies                 $3,146.18
    Repairs                    $402.01
    Utilities                  $234.56
    ─────────────────────────────────
    Total                    $3,782.75
  
  Pending in inbox: 3 receipts
```

### `r2s vendors`

Manage vendor mappings.

```bash
r2s vendors list
r2s vendors add "Peninsula Light" --category Utilities
r2s vendors remove "Old Vendor"
```

### `r2s year`

Year-end operations.

```bash
# Finalize a year (locks spreadsheet, creates next year's file)
r2s year finalize 2026

# Generate year-end summary for tax filing
r2s year summary 2026 --output tax-summary-2026.pdf
```

## Project Structure

```
receipt2sheet/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                      # MIT
│
├── src/
│   ├── index.ts                 # CLI entry point (commander.js)
│   ├── commands/
│   │   ├── init.ts
│   │   ├── process.ts
│   │   ├── add.ts
│   │   ├── status.ts
│   │   ├── vendors.ts
│   │   └── year.ts
│   │
│   ├── core/
│   │   ├── config.ts            # Load/save r2s.yaml
│   │   ├── extract.ts           # PDF text extraction
│   │   ├── redact.ts            # Sensitive data redaction (runs before API)
│   │   ├── parse.ts             # Claude API integration
│   │   ├── spreadsheet.ts       # Read/write xlsx files
│   │   └── confirm.ts           # Interactive confirmation UI
│   │
│   ├── schemas/
│   │   ├── config.ts            # Zod schema for config file
│   │   ├── expense.ts           # Zod schema for parsed expense
│   │   └── receipt.ts           # Zod schema for Claude response
│   │
│   └── utils/
│       ├── dates.ts
│       ├── currency.ts
│       └── files.ts
│
├── templates/
│   ├── r2s.yaml                 # Default config template
│   └── spreadsheets/
│       ├── Operating_Expenses.xlsx
│       ├── Capital_Improvements.xlsx
│       └── Year_End_Summary.xlsx
│
├── prompts/
│   └── receipt-parser.md        # System prompt for Claude
│
└── test/
    ├── fixtures/
    │   ├── amazon-receipt.pdf
    │   ├── contractor-invoice.pdf
    │   └── costco-receipt.pdf
    └── parse.test.ts
```

## Core Implementation Details

### Text Extraction (src/core/extract.ts)

```typescript
import pdf from 'pdf-parse';
import fs from 'fs/promises';

interface ExtractionResult {
  text: string | null;
  needsVision: boolean;
  pageCount: number;
}

export async function extractText(filePath: string): Promise<ExtractionResult> {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    const data = await pdf(buffer);
    const text = data.text.trim();
    
    // Check if extraction got meaningful text
    const hasContent = text.length > 100;
    const hasAmounts = /\$[\d,]+\.\d{2}/.test(text);
    
    return {
      text: hasContent ? text : null,
      needsVision: !hasContent || !hasAmounts,
      pageCount: data.numpages,
    };
  }
  
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return { text: null, needsVision: true, pageCount: 1 };
  }
  
  throw new Error(`Unsupported file type: ${ext}`);
}
```

### Claude Integration (src/core/parse.ts)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ExpenseSchema } from '../schemas/expense';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a receipt parser for rental property expense tracking.

Given a receipt or invoice (as text or image), extract:
- vendor: The business name
- date: Date of purchase/service (YYYY-MM-DD format)
- amount: Total amount paid (number, no $ sign)
- description: Brief description of what was purchased
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

Respond with JSON only, no markdown, no explanation.

Example response:
{"vendor":"Amazon","date":"2026-05-12","amount":45.99,"description":"Replacement towels and sheets","category":"Supplies"}`;

export async function parseReceipt(
  content: { type: 'text'; text: string } | { type: 'image'; data: string; mediaType: string },
  knownVendors: Record<string, { category: string }>
): Promise<z.infer<typeof ExpenseSchema>> {
  
  const vendorHint = Object.keys(knownVendors).length > 0
    ? `\n\nKnown vendors and their usual categories:\n${
        Object.entries(knownVendors)
          .map(([v, { category }]) => `- ${v}: ${category}`)
          .join('\n')
      }`
    : '';

  const messages = [{
    role: 'user' as const,
    content: content.type === 'text'
      ? [{ type: 'text' as const, text: content.text + vendorHint }]
      : [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: content.mediaType, data: content.data }},
          { type: 'text' as const, text: 'Parse this receipt.' + vendorHint }
        ]
  }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  
  return ExpenseSchema.parse(parsed);
}
```

### Schemas (src/schemas/expense.ts)

```typescript
import { z } from 'zod';

export const CategorySchema = z.enum([
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
]);

export const ExpenseSchema = z.object({
  vendor: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  description: z.string(),
  category: CategorySchema,
  property: z.string().optional(),
  receiptPath: z.string().optional(),
});

export type Expense = z.infer<typeof ExpenseSchema>;
```

### Sensitive Data Redaction (src/core/redact.ts)

**CRITICAL:** This runs BEFORE any API call. Sensitive data never leaves the user's machine.

```typescript
/**
 * Patterns for sensitive financial data
 */
const REDACTION_PATTERNS = [
  // Credit card numbers (preserve last 4)
  {
    pattern: /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g,
    replacement: '****-****-****-$4',
    name: 'credit_card',
  },
  // Bank account numbers (8-17 digits, preserve last 4)
  {
    pattern: /\b(\d{4})(\d{4,13})\b/g,
    replacement: (match: string) => '****' + match.slice(-4),
    name: 'bank_account',
  },
  // Social Security Numbers (redact completely)
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***-**-****',
    name: 'ssn',
  },
  // Routing numbers (9 digits, redact completely)
  {
    pattern: /\b\d{9}\b/g,
    replacement: '*********',
    name: 'routing',
  },
];

export interface RedactionResult {
  text: string;
  redactions: Array<{
    type: string;
    original: string;
    replacement: string;
    position: number;
  }>;
}

export function redactSensitiveData(text: string): RedactionResult {
  const redactions: RedactionResult['redactions'] = [];
  let result = text;

  for (const { pattern, replacement, name } of REDACTION_PATTERNS) {
    result = result.replace(pattern, (match, ...args) => {
      const position = args[args.length - 2]; // Second-to-last arg is offset
      const replaced = typeof replacement === 'function' 
        ? replacement(match) 
        : match.replace(pattern, replacement);
      
      redactions.push({
        type: name,
        original: match.slice(0, 4) + '...' + match.slice(-4), // Log safely
        replacement: replaced,
        position,
      });
      
      return replaced;
    });
  }

  return { text: result, redactions };
}

/**
 * Log redactions for user awareness (without exposing full numbers)
 */
export function logRedactions(redactions: RedactionResult['redactions']): void {
  if (redactions.length === 0) return;
  
  console.log(chalk.yellow(`⚠ Redacted ${redactions.length} sensitive item(s):`));
  for (const r of redactions) {
    console.log(chalk.gray(`  - ${r.type}: ${r.replacement}`));
  }
}
```

### Spreadsheet Updates (src/core/spreadsheet.ts)

```typescript
import ExcelJS from 'exceljs';
import { Expense } from '../schemas/expense';

export async function appendExpense(
  spreadsheetPath: string,
  expense: Expense
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(spreadsheetPath);
  
  const sheet = workbook.getWorksheet('Expenses');
  if (!sheet) throw new Error('Expenses sheet not found');
  
  // Find first empty row (after headers)
  let targetRow = 5; // Assuming headers end at row 4
  while (sheet.getCell(targetRow, 1).value !== null) {
    targetRow++;
  }
  
  // Add the expense
  sheet.getCell(targetRow, 1).value = new Date(expense.date);
  sheet.getCell(targetRow, 2).value = expense.category;
  sheet.getCell(targetRow, 3).value = expense.vendor;
  sheet.getCell(targetRow, 4).value = expense.description;
  sheet.getCell(targetRow, 5).value = expense.amount;
  sheet.getCell(targetRow, 6).value = ''; // Payment method - leave blank
  sheet.getCell(targetRow, 7).value = expense.receiptPath || '';
  
  await workbook.xlsx.writeFile(spreadsheetPath);
}
```

### Interactive Confirmation (src/core/confirm.ts)

```typescript
import inquirer from 'inquirer';
import Table from 'cli-table3';
import chalk from 'chalk';
import { Expense, CategorySchema } from '../schemas/expense';

export async function confirmExpenses(
  expenses: Array<{ file: string; expense: Expense }>
): Promise<Array<{ file: string; expense: Expense; action: 'confirm' | 'skip' }>> {
  
  // Display table
  const table = new Table({
    head: ['#', 'File', 'Vendor', 'Date', 'Amount', 'Category'],
    colWidths: [4, 25, 20, 12, 12, 25],
  });
  
  expenses.forEach((e, i) => {
    table.push([
      i + 1,
      truncate(e.file, 23),
      truncate(e.expense.vendor, 18),
      e.expense.date,
      `$${e.expense.amount.toFixed(2)}`,
      e.expense.category,
    ]);
  });
  
  console.log(table.toString());
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Confirm all', value: 'confirm-all' },
      { name: 'Edit entries', value: 'edit' },
      { name: 'Skip all', value: 'skip-all' },
    ],
  }]);
  
  if (action === 'confirm-all') {
    return expenses.map(e => ({ ...e, action: 'confirm' as const }));
  }
  
  if (action === 'skip-all') {
    return expenses.map(e => ({ ...e, action: 'skip' as const }));
  }
  
  // Edit mode - let user modify each entry
  return editExpenses(expenses);
}

async function editExpenses(
  expenses: Array<{ file: string; expense: Expense }>
): Promise<Array<{ file: string; expense: Expense; action: 'confirm' | 'skip' }>> {
  
  const results = [];
  
  for (const { file, expense } of expenses) {
    console.log(chalk.cyan(`\n--- ${file} ---`));
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: `${expense.vendor} - $${expense.amount} - ${expense.category}`,
      choices: [
        { name: 'Confirm', value: 'confirm' },
        { name: 'Edit', value: 'edit' },
        { name: 'Skip', value: 'skip' },
      ],
    }]);
    
    if (action === 'skip') {
      results.push({ file, expense, action: 'skip' as const });
      continue;
    }
    
    if (action === 'confirm') {
      results.push({ file, expense, action: 'confirm' as const });
      continue;
    }
    
    // Edit the expense
    const edited = await inquirer.prompt([
      { name: 'vendor', message: 'Vendor:', default: expense.vendor },
      { name: 'date', message: 'Date:', default: expense.date },
      { name: 'amount', message: 'Amount:', default: expense.amount, filter: Number },
      { name: 'description', message: 'Description:', default: expense.description },
      { 
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: CategorySchema.options,
        default: expense.category,
      },
    ]);
    
    results.push({ 
      file, 
      expense: { ...expense, ...edited }, 
      action: 'confirm' as const 
    });
  }
  
  return results;
}
```

## Spreadsheet Templates

### Operating_Expenses.xlsx

Structure matches what we already built:

| Sheet | Purpose |
|-------|---------|
| Expenses | Main data entry (Date, Category, Vendor, Description, Amount, Payment Method, Receipt Path, Notes) |
| Summary | Auto-totals by Schedule E category |
| Categories | Reference list |

### Capital_Improvements.xlsx

For tracking improvements that get depreciated:

| Sheet | Purpose |
|-------|---------|
| Improvements | Date, Year, Area, Description, Provider, Cost, Notes |
| By Year | Summary by year |
| By Provider | Summary by provider |

### Year_End_Summary.xlsx

Tax filing helper:

| Sheet | Purpose |
|-------|---------|
| Year-End | Income, expenses by category, net rental income |
| Instructions | Notes for accountant |

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "commander": "^12.0.0",
    "inquirer": "^9.0.0",
    "cli-table3": "^0.6.0",
    "chalk": "^5.0.0",
    "exceljs": "^4.4.0",
    "pdf-parse": "^1.1.1",
    "yaml": "^2.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

## Implementation Phases

### Phase 1: MVP (Core Flow)
- [ ] `init` command - creates config and template spreadsheets
- [ ] `process` command - parse receipts, confirm, update spreadsheet
- [ ] PDF text extraction
- [ ] **Sensitive data redaction** - scrub CC/bank numbers before API calls
- [ ] Claude API integration
- [ ] Zod validation
- [ ] Basic xlsx writing
- [ ] `--dry-run` flag to preview what would be sent

### Phase 2: Polish
- [ ] Vision fallback for scanned receipts
- [ ] Vendor learning/caching
- [ ] `status` command
- [ ] `add` command for manual entry
- [ ] Processed receipt organization

### Phase 3: Multi-Property & Year-End
- [ ] Multi-property support
- [ ] `year finalize` command
- [ ] Year-end summary generation
- [ ] Spreadsheet backup before modifications

### Phase 4: Nice-to-Haves
- [ ] `vendors` management commands
- [ ] Tax summary PDF export
- [ ] Watch mode (auto-process inbox)
- [ ] Integration with stay tracking tools

## Open Source Considerations

### Why Someone Would Use This
- Schedule E categories built-in
- No SaaS subscription (just Claude API costs)
- Data stays local (xlsx files they control)
- Works with their existing spreadsheet workflow

### What to Document Well
- Setup with different property types
- Customizing categories
- Adding vendors
- Year-end workflow for taxes

### Potential Extensions (Community)
- Other tax jurisdictions (UK, Canada, etc.)
- Integration with accounting software (QuickBooks, Wave)
- Different spreadsheet backends (Google Sheets)
- Receipt storage integrations (Google Drive, Dropbox)

## Notes for Claude Code

When implementing this:

1. **Start with the happy path** - Amazon PDF with good text extraction
2. **Use the actual spreadsheet templates** provided in templates/
3. **Keep the Claude prompt simple** - Don't over-engineer self-healing yet
4. **Use ExcelJS** for spreadsheet manipulation (good Numbers compatibility)
5. **Test with real receipts** - User can provide samples

The goal is a tool that takes 5 minutes to set up and saves hours of manual data entry throughout the year.
