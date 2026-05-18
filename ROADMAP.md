# Roadmap

## Completed

### Phase 1: MVP (v0.1.0)
- [x] `init` command — creates config, directories, spreadsheet templates
- [x] `process` command — parse receipts, confirm, update spreadsheets
- [x] `doctor` command — validate setup, API connection, `--fix` support
- [x] PDF text extraction with vision fallback (native PDF document support)
- [x] Claude API integration with configurable model (small/medium/large)
- [x] Zod validation for all schemas
- [x] Operating vs capital expense routing
- [x] Multi-year spreadsheet support (auto-create per year)
- [x] Processing ledger (`.r2s/processed.json`) with raw API responses
- [x] Interactive confirmation UI with edit mode
- [x] "Confirm invoices only" (skip $0 non-invoice documents)
- [x] Configurable file size limits and model selection via `.env.local`

## Next Up

### Confidence Scores
- [ ] Add `confidence` field (0-1) to Claude's parse response
- [ ] Configure a confidence threshold in `.env.local` (default: 0.8)
- [ ] Auto-confirm high-confidence predictions, prompt for low-confidence
- [ ] In edit mode, highlight which fields are low-confidence
- [ ] Track confidence in the processing ledger for analysis

### Phase 2: Polish
- [ ] Vision fallback quality improvements for scanned receipts
- [ ] Vendor learning/caching — auto-add new vendors to `r2s.yaml`
- [ ] `status` command — show expense summary by category/property
- [ ] `add` command — manual expense entry
- [ ] Processed receipt organization improvements
- [ ] Better error messages and recovery guidance

### Phase 3: Multi-Property & Year-End
- [ ] Multi-property support in process flow
- [ ] `year finalize` command — lock spreadsheet, create next year's file
- [ ] Year-end summary generation for tax filing
- [ ] Spreadsheet backup rotation (keep N backups)

### Phase 4: Nice-to-Haves
- [ ] `vendors` management commands (list, add, remove)
- [ ] Tax summary PDF export
- [ ] Watch mode — auto-process new files in inbox
- [ ] Duplicate receipt detection

### Git Integration (Data Safety)

Use git as a built-in versioning/backup layer for the user's rental data folder. The idea: `r2s init` creates a local git repo (or uses an existing one), and `r2s process` auto-commits after each successful run. Users get full history of every spreadsheet change for free.

- [ ] `r2s init` — optionally `git init` the rental folder (or detect existing repo)
- [ ] Auto-commit after `r2s process` — commit spreadsheet changes + ledger updates
  - Commit message: `r2s: processed 4 receipts (2026-05-17)`
  - Only commit r2s-managed files (spreadsheets, ledger, config) — never receipts
- [ ] Config options in `r2s.yaml`:
  ```yaml
  git:
    enabled: true            # Toggle git integration on/off
    auto_commit: true        # Commit after each process run
    auto_push: false         # Push to remote after commit (opt-in)
    commit_receipts: false   # Whether to include receipt files in commits
  ```
- [ ] `--no-commit` flag on `r2s process` to skip auto-commit (useful for test runs)
- [ ] `r2s log` — show history of changes (thin wrapper around `git log` for r2s files)
- [ ] `r2s undo` — revert last process run (git revert the last r2s commit)
- [ ] Works without a remote — purely local git is fine, remote is optional
- [ ] `r2s doctor` — check git status, warn about uncommitted changes

## Infrastructure

### CI/CD
- [ ] GitHub Actions workflow for validate (typecheck, lint, format, build, test)
- [ ] Automated release workflow (tag → build → publish)
- [ ] PR checks with status reporting

### Testing
- [ ] Generate simulated receipts/invoices as test fixtures
- [ ] Integration tests for the full process flow (mock Claude API)
- [ ] Unit tests for spreadsheet read/write
- [ ] Unit tests for config loading and validation
- [ ] Test coverage reporting

### Publishing
- [ ] Publish to npmjs.com as `receipt2sheet`
- [ ] GitHub Releases with changelogs
- [ ] Homebrew formula (stretch)

### Documentation
- [ ] VitePress doc site (turborepo monorepo)
- [ ] Setup guide with screenshots
- [ ] Category decision guide
- [ ] Year-end tax workflow guide
