import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  entry: { scrydrop: 'server/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  treeshake: true,
});
