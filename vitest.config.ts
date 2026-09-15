import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      reportOnFailure: true,
      reporter: ['json', 'json-summary', 'text'],
    },
    mockReset: true,
    reporters: ['dot'],
  },
});
