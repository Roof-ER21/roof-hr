/**
 * Unit tests — pure-function tests that need no server, database or browser.
 * Run with: npm run test:unit
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
    },
  },
});
