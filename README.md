# receipt2sheet

Turn rental receipts into Schedule E line items.

**Drop receipts. Confirm. Done.**

```
$ r2s process

Parsed 3 receipts:

┌──────────────────┬─────────┬─────────┬───────────────────────┐
│ File             │ Vendor  │ Amount  │ Category              │
├──────────────────┼─────────┼─────────┼───────────────────────┤
│ amazon-05-12.pdf │ Amazon  │ $45.99  │ Supplies              │
│ plumber.pdf      │ Anewhere│ $180.00 │ Repairs               │
│ electric-bill.pdf│ PenLight│ $67.23  │ Utilities             │
└──────────────────┴─────────┴─────────┴───────────────────────┘

[C]onfirm all  [E]dit  [S]kip
```

## Why?

- **Schedule E ready** — Categories match IRS rental property deductions
- **No SaaS** — Your data stays local; just pay Claude API costs (~$2/month)
- **Works with your spreadsheets** — Updates xlsx files you can open in Excel, Numbers, or Google Sheets
- **Learns your vendors** — Remembers that "Peninsula Light" is always Utilities

## Install

```bash
npm install -g receipt2sheet

# Set your Claude API key
export ANTHROPIC_API_KEY=sk-ant-...
```

## Quick Start

```bash
# Initialize in your rental folder
cd ~/Documents/MyRental
r2s init

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
└── spreadsheets/
    ├── Operating_Expenses_2026.xlsx
    ├── Capital_Improvements.xlsx
    └── Year_End_Summary.xlsx
```

## Commands

| Command | Description |
|---------|-------------|
| `r2s init` | Set up a new rental folder |
| `r2s process` | Parse receipts from inbox |
| `r2s add` | Manually add an expense |
| `r2s status` | Show expense summary |
| `r2s year finalize` | Lock a year and start fresh |

## Configuration

Edit `r2s.yaml` to add your properties and vendors:

```yaml
properties:
  - id: cabin
    name: "Lake Cabin"
    location: "Lake Tahoe, CA"
    placed_in_service: 2026-01

vendors:
  "Local Plumber":
    category: Repairs
  "Electric Co":
    category: Utilities
```

## Multi-Property Support

Track multiple rentals with one tool:

```bash
r2s process --property cabin
r2s process --property condo
r2s status --property all
```

## How It Works

1. **Text extraction** — Pulls text from PDFs (no OCR needed for digital receipts)
2. **Claude parsing** — Identifies vendor, date, amount, and suggests category
3. **You confirm** — Review and edit before anything changes
4. **Spreadsheet update** — Appends to your expenses file
5. **Receipt archived** — Moves to processed/ folder

## Cost

Claude API usage is minimal:
- ~$0.01–0.05 per receipt (text extraction)
- ~$0.10–0.20 per receipt if vision needed (scanned docs)
- Typical month: **$1–3** for 50 receipts

## License

MIT

## See Also

- [PLAN.md](./PLAN.md) — Detailed implementation spec
- [SKILL.md](./SKILL.md) — For Claude Code/Desktop users
