import { defineConfig } from 'tsup';

// Dual CJS/ESM build: apps/api (Nest, CommonJS via tsc) requires CJS,
// apps/kiosk (Vite/Rollup) resolves the ESM build cleanly with no interop guessing.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
