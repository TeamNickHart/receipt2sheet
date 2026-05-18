# Privacy & Security

receipt2sheet is designed with privacy as a core principle. Your financial data is sensitive, and we treat it that way.

## TL;DR

- ✅ All spreadsheets stay on your machine
- ✅ Credit card and bank numbers are auto-redacted before API calls
- ✅ No analytics, telemetry, or cloud sync
- ✅ Anthropic API calls are not used for AI training
- ✅ Open source — audit the code yourself

---

## What Data Goes Where

### Stays on your machine (never transmitted)

| Data | Location |
|------|----------|
| Your spreadsheets | `spreadsheets/*.xlsx` |
| Your configuration | `r2s.yaml` |
| Processed receipts | `processed/` folder |
| Vendor mappings | `.r2s/vendor-cache.json` |

### Sent to Claude API (for parsing only)

| Data | Purpose |
|------|---------|
| Receipt text | Extracted from PDFs, with sensitive data redacted |
| Receipt images | Only when text extraction fails (scanned docs) |

### Never sent anywhere

| Data | Why it's protected |
|------|-------------------|
| Full credit card numbers | Auto-redacted to `****-****-****-1234` |
| Bank account numbers | Auto-redacted to `****5678` |
| Social Security Numbers | Auto-redacted completely |
| Routing numbers | Auto-redacted completely |
| Your spreadsheet contents | Never leaves your machine |
| Historical expenses | Never leaves your machine |

---

## Automatic Redaction

Before any text is sent to the Claude API, receipt2sheet automatically redacts sensitive patterns:

```
Credit Card:    4532-1234-5678-9012  →  ****-****-****-9012
Bank Account:   12345678901234       →  ****1234
SSN:            123-45-6789          →  ***-**-****
Routing:        021000021            →  *********
```

This happens **before** the API call — sensitive data never leaves your machine in its original form.

### Verify with dry-run

You can see exactly what would be sent without making any API calls:

```bash
r2s process --dry-run
```

This shows the redacted text that would be transmitted, so you can verify nothing sensitive is included.

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

## Local-Only Mode (Future)

For users who want zero external transmission, we plan to add a local-only mode that uses regex-based extraction without any API calls. It will be less accurate but fully private.

Track this feature: [GitHub Issue #TBD]

---

## What We Don't Do

❌ **No analytics** — We don't track usage, errors, or behavior  
❌ **No telemetry** — No phone-home, no crash reporting  
❌ **No cloud sync** — Your files stay on your machine  
❌ **No accounts** — No sign-up, no login, no user database  
❌ **No ads** — This is a tool, not a business  

---

## Open Source Transparency

This project is fully open source under the [MIT License](./LICENSE). You can:

- **Read the code** — See exactly what data is transmitted
- **Audit the redaction logic** — Verify sensitive data is scrubbed
- **Fork and modify** — Add your own privacy controls
- **Run offline** — Use local-only mode (when available)

The redaction logic is in [`src/core/redact.ts`](./src/core/redact.ts) — we encourage you to review it.

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: [your-email@example.com] with details
3. Allow reasonable time for a fix before disclosure

We take security seriously and will respond promptly.

---

## Questions?

If you have privacy or security concerns not addressed here, please [open a discussion](https://github.com/yourusername/receipt2sheet/discussions) on GitHub.
