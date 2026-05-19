# receipt2sheet

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/TeamNickHart/receipt2sheet/actions/workflows/ci.yml/badge.svg)](https://github.com/TeamNickHart/receipt2sheet/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

> v0.1.0

Turn rental receipts into Schedule E line items using Claude AI.

**Drop receipts. Confirm. Done.**

```
$ r2s process

Processing 4 receipt(s)...

  Parsing amazon-05-12.pdf... done
  Parsing plumber.pdf... done
  Parsing electric-bill.pdf... done
  Parsing hot-tub-invoice.pdf... done [CAPITAL]

┌───┬──────────────────────┬──────────────────┬────────────┬──────────┬──────────────────────┬──────────┐
│ # │ File                 │ Vendor           │ Date       │ Amount   │ Category             │ Type     │
├───┼──────────────────────┼──────────────────┼────────────┼──────────┼──────────────────────┼──────────┤
│ 1 │ amazon-05-12.pdf     │ Amazon           │ 2026-05-12 │ $45.99   │ Supplies             │ operating│
│ 2 │ plumber.pdf          │ Anewhere Plumb.. │ 2026-05-10 │ $180.00  │ Repairs              │ operating│
│ 3 │ electric-bill.pdf    │ Peninsula Light  │ 2026-05-01 │ $67.23   │ Utilities            │ operating│
│ 4 │ hot-tub-invoice.pdf  │ Aqua Quip        │ 2025-05-26 │ $8350.73 │ Other                │ CAPITAL  │
└───┴──────────────────────┴──────────────────┴────────────┴──────────┴──────────────────────┴──────────┘
? What would you like to do?
❯ Confirm all
  Confirm invoices only (skip $0 entries)
  Edit entries
  Skip all
```

## Why?

- **Schedule E ready** — Categories match IRS rental property deductions
- **Capital vs Operating** — Automatically routes major purchases to Capital Improvements
- **No SaaS** — Your data stays local; just pay Claude API costs (~$2/month)
- **Works with your spreadsheets** — Updates xlsx files you can open in Excel, Numbers, or Google Sheets
- **Vendor hints** — Configure known vendors in `r2s.yaml` to guide Claude's categorization

## Privacy & Security

Your financial data is sensitive. We treat it that way.

- **All spreadsheets stay local** — Nothing synced to the cloud
- **Automatic PII redaction** — Credit cards, SSNs, and bank details are scrubbed from text before API calls
- **No telemetry** — Zero analytics, tracking, or phone-home
- **Open source** — Audit the code yourself

See **[PRIVACY.md](./PRIVACY.md)** for full details on what data goes where.

## Install

```bash
# Clone and install
git clone https://github.com/TeamNickHart/receipt2sheet.git
cd receipt2sheet
pnpm install
pnpm build

# Set up your API key
cp .env.example .env.local
# Edit .env.local with your Anthropic API key
```

## Quick Start

```bash
# Initialize in your rental folder
cd ~/Documents/MyRental
r2s init

# Check your setup
r2s doctor

# Drop receipts in inbox/
cp ~/Downloads/*.pdf inbox/

# Process them
r2s process
```

## What It Creates

```
MyRental/
├── r2s.yaml                      # Your config
├── inbox/                        # Drop receipts here
├── processed/                    # Receipts move here after processing
├── .r2s/
│   └── processed.json            # Processing ledger
└── spreadsheets/
    ├── Operating_Expenses_2026.xlsx
    ├── Capital_Improvements.xlsx
    └── Year_End_Summary.xlsx
```

## Commands

| Command | Description |
|---------|-------------|
| `r2s init` | Set up a new rental folder |
| `r2s process [files...]` | Parse receipts from inbox |
| `r2s doctor` | Check setup, API connection, project health |
| `r2s doctor --fix` | Auto-fix missing directories and files |

### Process Options

```bash
r2s process                        # Process all files in inbox/
r2s process receipt.pdf             # Process specific file(s)
r2s process --dry-run               # Preview without updating spreadsheets
r2s process --yes                   # Skip confirmation prompt
r2s process --property cabin        # Assign to a specific property
r2s process --category Repairs      # Override category for all receipts
r2s process --force                 # Reprocess already-processed files
```

## Configuration

### r2s.yaml

Edit to add your properties and vendors:

```yaml
properties:
  - id: cabin
    name: "Lake Cabin"
    location: "Lake Tahoe, CA"
    type: short-term-rental
    placed_in_service: 2026-01

vendors:
  "Local Plumber":
    category: Repairs
  "Electric Co":
    category: Utilities
```

### .env.local

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Model: small (Haiku), medium (Sonnet), large (Opus), or exact model ID
# R2S_MODEL=medium

# Max upload size in MB
# R2S_MAX_FILE_SIZE_MB=10
```

## Multi-Property Support

Track multiple rentals with one tool:

```bash
r2s process --property cabin
r2s process --property condo
r2s status --property all
```

## How It Works

1. **Text extraction** — Pulls text from PDFs; sends scanned PDFs directly to Claude as documents
2. **Claude parsing** — Identifies vendor, date, amount, category, and expense type (operating vs capital)
3. **You confirm** — Review, edit, or skip before anything changes
4. **Spreadsheet update** — Routes operating expenses and capital improvements to the correct files
5. **Receipt archived** — Moves to `processed/` folder, records in processing ledger

## Supported File Types

- PDF (text extraction + native document upload for scanned files)
- PNG, JPG, JPEG, WebP (vision API)

## Cost

Claude API usage is minimal:
- ~$0.01–0.05 per receipt (text extraction)
- ~$0.05–0.15 per receipt (PDF document or image vision)
- Typical month: **$1–3** for 50 receipts

## Development

```bash
pnpm install              # install dependencies
pnpm validate             # typecheck + format + lint + build + test
pnpm test                 # run tests
pnpm test:watch           # run tests in watch mode
pnpm test:coverage        # run tests with coverage report
pnpm fixtures:generate    # regenerate test fixture PDFs
```

## Contributing

Contributions are welcome! Please read the [PLAN.md](./PLAN.md) for architecture details and implementation status.

## License

[MIT](./LICENSE)

## Documentation

- **[PRIVACY.md](./PRIVACY.md)** — Privacy policy and security details
- **[PLAN.md](./PLAN.md)** — Detailed implementation spec
- **[ROADMAP.md](./ROADMAP.md)** — What's next
- **[SKILL.md](./SKILL.md)** — For Claude Code/Desktop users
