# receipt2sheet Skill

Process receipts and invoices for rental property expense tracking.

## When to Use This Skill

- User uploads a receipt or invoice and wants it categorized
- User asks to update their expense spreadsheet
- User needs help with Schedule E categories
- User is setting up or troubleshooting receipt2sheet (r2s)

## Context

This skill supports the `r2s` CLI tool, but also works standalone when users share receipts directly in chat.

## Receipt Parsing

When given a receipt (image or PDF text), extract:

```yaml
vendor: Business name
date: YYYY-MM-DD
amount: Total paid (number only)
description: Brief description of purchase
category: Schedule E category (see below)
```

### Schedule E Categories

Use these IRS-standard categories:

| Category | Use For |
|----------|---------|
| Advertising | Listing fees, photography, marketing |
| Auto and travel | Mileage, parking, flights for property visits |
| Cleaning and maintenance | Cleaning services, lawn care, pest control, consumables restocking |
| Commissions | Booking platform fees, referral fees |
| Insurance | Property insurance, liability coverage |
| Legal and professional fees | Attorney, accountant, property manager setup |
| Management fees | Property manager percentage fees |
| Mortgage interest | Loan interest (not principal) |
| Other interest | Credit card interest on property expenses |
| Repairs | Fixing broken items, plumbing, electrical |
| Supplies | Towels, sheets, kitchenware, toiletries, furniture |
| Taxes | Property taxes, lodging taxes (if not collected by platform) |
| Utilities | Electric, gas, water, internet, trash |
| Depreciation | Calculated by accountant, not direct expense |
| Other | Anything that doesn't fit above |

### Category Decision Guide

**Supplies vs Repairs:**
- Supplies: New items, replacements, consumables
- Repairs: Fixing something broken

**Cleaning and maintenance vs Repairs:**
- Cleaning/maintenance: Routine upkeep, prevention
- Repairs: Something was broken, now it's fixed

**When uncertain:** Ask the user or default to "Other" with a note.

## Spreadsheet Structure

### Operating_Expenses_{year}.xlsx

**Expenses sheet columns:**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Date | Category | Vendor/Payee | Description | Amount | Payment Method | Receipt Path | Notes |

**Summary sheet:** Auto-totals by category using SUMIF formulas.

### Capital_Improvements.xlsx

For items that get depreciated (not expensed in year purchased):
- Major renovations
- New appliances
- Structural improvements
- Anything adding significant value

**Columns:** Date, Year, Area, Description, Provider, Cost, Payment Method, Notes

### Year_End_Summary.xlsx

Pulls together income and expenses for Schedule E filing.

## File Locations

Default structure when using r2s CLI:

```
PropertyName/
├── r2s.yaml                  # Config
├── inbox/                    # Drop receipts here
├── processed/                # Receipts move here after processing
└── spreadsheets/
    ├── Operating_Expenses_2026.xlsx
    ├── Capital_Improvements.xlsx
    └── Year_End_Summary.xlsx
```

## Common Tasks

### Parse a single receipt

When user uploads a receipt:

1. Extract text (if PDF) or read image
2. Identify vendor, date, amount
3. Suggest category with reasoning
4. Format as table for confirmation:

```
| Field       | Value                    |
|-------------|--------------------------|
| Vendor      | Amazon                   |
| Date        | 2026-05-12               |
| Amount      | $45.99                   |
| Description | Replacement towels       |
| Category    | Supplies                 |

Does this look correct?
```

### Batch process receipts

When user uploads multiple receipts:

1. Parse each one
2. Present summary table
3. Ask for confirmation/edits
4. Update spreadsheet or output data

### Update spreadsheet

If user provides their spreadsheet:

1. Read existing data to understand structure
2. Append new rows (don't overwrite)
3. Maintain formatting
4. Return updated file

### Help with categorization

If user asks "what category is X?":

1. Explain the relevant categories
2. Give recommendation with reasoning
3. Note if it's ambiguous (let them decide)

## Multi-Property Support

Users may have multiple rental properties. Always clarify which property an expense belongs to if:
- Config shows multiple properties
- User hasn't specified
- Vendor could apply to either

## Integration with r2s CLI

If user is using the CLI and asks for help:

- `r2s init` — Creates config and templates
- `r2s process` — Parses inbox, confirms, updates spreadsheet
- `r2s status` — Shows expense summary
- `r2s add` — Manual expense entry

Check `r2s.yaml` for their configuration (properties, vendors, categories).

## Response Format

For receipt parsing, always:
1. Show extracted data in a clear table
2. Explain category choice briefly
3. Ask for confirmation before any spreadsheet updates
4. Offer to adjust if something looks wrong

Keep responses concise. Users processing receipts want efficiency, not lengthy explanations.
