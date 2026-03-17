import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/live/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
