import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      thresholds: {
        // Current: 54% statements, 80% branches, 83% functions
        // The gap is from untested interactive CLI commands (doctor, init, confirm).
        // Raise thresholds as those get tested.
        statements: 50,
        lines: 50,
        functions: 60,
        branches: 60,
      },
    },
  },
});
