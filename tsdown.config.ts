import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: {
    // NOTE Specify what would otherwise be inferred correctly only to suppress
    //      type definitions for the server binary.
    entry: 'lib/index.ts',
  },
  entry: {
    index: 'lib/index.ts',
    scrydrop: 'server/index.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  treeshake: true,
});
