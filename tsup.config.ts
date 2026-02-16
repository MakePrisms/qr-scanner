import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    outDir: 'dist',
  },
  {
    entry: ['src/worker.ts'],
    format: ['esm'],
    outDir: 'dist',
    sourcemap: true,
    noExternal: ['zxing-wasm'],
  },
]);
