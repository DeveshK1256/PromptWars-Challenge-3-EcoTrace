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
      thresholds: {
        branches: 70,
      },
    },
  },
});
