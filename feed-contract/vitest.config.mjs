/* global URL */
import { defineConfig } from 'vitest/config';

// Separate from the root config (owned by C0): runs the plain .mjs tests in this folder.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['feed-contract/**/*.test.mjs'],
    root: new URL('..', import.meta.url).pathname,
  },
});
