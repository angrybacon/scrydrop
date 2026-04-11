import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  entry: { server: 'server/index.ts' },
  format: ['esm'],
  outDir: 'dist',
  treeshake: true,
});
