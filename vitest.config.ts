import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    environmentMatchGlobs: [
      // Integration tests that use sharp/node need Node environment
      ['tests/scan-image.test.ts', 'node'],
      ['tests/worker.test.ts', 'node'],
    ],
  },
});
