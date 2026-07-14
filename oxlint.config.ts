import { defineConfig } from 'oxlint';

export default defineConfig({
  categories: {
    correctness: 'error',
    pedantic: 'error',
    perf: 'error',
    suspicious: 'error',
  },
  options: {
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
    typeCheck: true,
  },
  plugins: [
    'eslint',
    'import',
    'node',
    'oxc',
    'promise',
    'typescript',
    'unicorn',
    'vitest',
  ],
  rules: {
    'eslint/max-lines-per-function': 'off',
    'typescript/no-confusing-void-expression': [
      'error',
      { ignoreArrowShorthand: true },
    ],
    'typescript/no-import-type-side-effects': 'error',
    'typescript/no-unnecessary-condition': 'error',
    'typescript/prefer-optional-chain': 'error',
    'typescript/prefer-readonly-parameter-types': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'unicorn/explicit-length-check': 'off',
    'vitest/valid-title': ['error', { ignoreTypeOfDescribeName: true }],
  },
});
