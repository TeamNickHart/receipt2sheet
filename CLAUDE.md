# receipt2sheet - Claude Code Conventions

## Overview
TypeScript CLI tool (`r2s`) for rental property owners to process receipts into Schedule E expense spreadsheets using Claude AI.

## Stack
- **Runtime:** Node >= 20, ESM
- **Package manager:** pnpm (use `pnpm` for all commands)
- **Language:** TypeScript 5.8, strict mode
- **Testing:** Vitest + @vitest/coverage-v8
- **Linting:** ESLint + typescript-eslint
- **Formatting:** Prettier

## Key Commands
```bash
pnpm validate          # typecheck + format + lint + build + test (run before committing)
pnpm test              # run tests
pnpm test:watch        # run tests in watch mode
pnpm test:coverage     # run tests with coverage report
pnpm build             # compile TypeScript
pnpm typecheck         # type-check without emitting
pnpm lint              # lint src/
pnpm format:check      # check formatting
```

## Architecture
```
src/
  commands/     CLI command handlers (init, process, doctor)
  core/         Business logic (config, extract, parse, spreadsheet, ledger, confirm)
  schemas/      Zod schemas (config, receipt, expense)
  utils/        Pure utilities (currency, dates, files)
  index.ts      CLI entry point
```

Flow: `commands/` -> `core/` -> `schemas/` -> `utils/`

## Conventions
- ESM with `.js` extensions in imports (even for .ts files)
- Zod for all runtime validation
- No PII or real receipts in git — `inbox/` and `processed/` are gitignored
- `templates/` contains canonical xlsx spreadsheet templates — don't modify without intent
- Amounts are non-negative numbers; dates are `YYYY-MM-DD` strings

## Testing Patterns
- `vi.mock('@anthropic-ai/sdk')` for Claude API calls
- Use `test/helpers/mock-fs.ts` for temp directories (create in `beforeEach`, clean in `afterEach`)
- Use recorded API responses from `test/fixtures/api-responses/`
- Use generated fixture receipts from `test/fixtures/receipts/`
- Spreadsheet tests: copy real templates to temp dirs, verify with ExcelJS
- Extract tests: use actual fixture PDFs (no mocking needed)

## Commit Conventions
- Focus on the "why" not the "what"
- End with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
