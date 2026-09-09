/**
 * Integration tests — boot a working-tree server against a throwaway local
 * Postgres (test/global-setup.ts) and talk to it over HTTP.
 * Run with: npm test
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/unit/**', 'node_modules/**'],
    testTimeout: 20000,
    hookTimeout: 120000,
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
    },
  },
});
