# Privacy & Security

receipt2sheet is designed with privacy as a core principle. Your financial data is sensitive, and we treat it that way.

## TL;DR

- All spreadsheets stay on your machine
- No analytics, telemetry, or cloud sync
- Anthropic API calls are not used for AI training
- Open source — audit the code yourself

---

## What Data Goes Where

### Stays on your machine (never transmitted)

| Data | Location |
|------|----------|
| Your spreadsheets | `spreadsheets/*.xlsx` |
| Your configuration | `r2s.yaml` |
| Processed receipts | `processed/` folder |
| Processing ledger | `.r2s/processed.json` |

### Sent to Claude API (for parsing only)

| Data | Purpose |
|------|---------|
| Receipt text | Extracted from PDFs, PII-redacted, then sent for parsing |
| Scanned PDFs | Sent as native PDF documents when text extraction fails |
| Receipt images | PNG/JPG/WebP files sent via vision API |

### Never sent anywhere

| Data | Why it's protected |
|------|-------------------|
| Your spreadsheet contents | Never leaves your machine |
| Historical expenses | Never leaves your machine |

**Automatic PII Redaction:** Text content extracted from receipts is automatically scrubbed before being sent to the Claude API. The following PII types are detected and redacted:

- **Credit card numbers** — 13-19 digit sequences validated with Luhn checksum, replaced with `[REDACTED-CC-XXXX]` (last 4 preserved)
- **Social Security Numbers** — `XXX-XX-XXXX` format, replaced with `[REDACTED-SSN]`
- **Bank routing numbers** — 9-digit numbers preceded by keywords like "routing" or "ABA", replaced with `[REDACTED-ROUTING]`
- **Bank account numbers** — 6-17 digit numbers preceded by "account" or "acct", replaced with `[REDACTED-ACCT]`

> **Limitation:** Image and PDF vision paths send binary data directly to the Claude API and cannot be text-redacted. If your scanned receipts contain visible PII (e.g., printed credit card numbers), that data will be transmitted as-is. See the [roadmap](./ROADMAP.md) for planned image-level redaction.

---

## Anthropic's Data Practices

receipt2sheet uses the [Anthropic API](https://www.anthropic.com/api) for AI-powered receipt parsing. Anthropic's data handling:

- **API inputs are not used for training** — Your receipts don't train future models
- **No long-term data retention** — Data is processed and discarded
- **SOC 2 Type II certified** — Enterprise-grade security controls
- **See full details:** [Anthropic Privacy Policy](https://www.anthropic.com/privacy)

### Your API key

Your `ANTHROPIC_API_KEY` is stored as an environment variable on your machine. It is:
- Never logged or stored by receipt2sheet
- Never transmitted anywhere except directly to Anthropic
- Your responsibility to keep secure

---

## Local-Only Mode (Planned)

For users who want zero external transmission, we plan to add a local-only mode that uses regex-based extraction without any API calls. It will be less accurate but fully private.

Track this feature on the [roadmap](./ROADMAP.md).

---

## What We Don't Do

- **No analytics** — We don't track usage, errors, or behavior
- **No telemetry** — No phone-home, no crash reporting
- **No cloud sync** — Your files stay on your machine
- **No accounts** — No sign-up, no login, no user database
- **No ads** — This is a tool, not a business

---

## Open Source Transparency

This project is fully open source under the [MIT License](./LICENSE). You can:

- **Read the code** — See exactly what data is transmitted
- **Fork and modify** — Add your own privacy controls

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: [your-email@example.com] with details
3. Allow reasonable time for a fix before disclosure

We take security seriously and will respond promptly.

---

## Questions?

If you have privacy or security concerns not addressed here, please [open a discussion](https://github.com/TeamNickHart/receipt2sheet/discussions) on GitHub.
