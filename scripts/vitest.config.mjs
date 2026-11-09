/* global URL */
import { defineConfig } from 'vitest/config';

// Separate from the root config (owned by C0): runs the plain .mjs tests under scripts/.
export default defineConfig({
  test: { environment: 'node', include: ['scripts/**/*.test.mjs'], root: new URL('..', import.meta.url).pathname },
});
