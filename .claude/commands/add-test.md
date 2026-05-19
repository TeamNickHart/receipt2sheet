Read the source file at `$ARGUMENTS` and create a comprehensive test file following project conventions:

1. Read the source file to understand all exports and their behavior
2. Create the test file at the corresponding path under `test/` (e.g., `src/core/config.ts` -> `test/core/config.test.ts`)
3. Follow these patterns:
   - Import from `vitest` (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`)
   - Use `test/helpers/mock-fs.ts` for temp directories when testing file operations
   - Use `vi.mock('@anthropic-ai/sdk')` for anything that calls the Claude API
   - Use recorded fixtures from `test/fixtures/api-responses/` where available
   - Test happy paths, edge cases, and error conditions
   - Group related tests with `describe` blocks
4. Run the tests to verify they pass
