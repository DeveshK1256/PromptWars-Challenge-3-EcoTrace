import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.js'],
          exclude: ['tests/dom/**'],
        },
      },
      {
        test: {
          name: 'dom',
          include: ['tests/dom/**/*.test.js'],
          environment: 'jsdom',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 70,
        lines: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
});
