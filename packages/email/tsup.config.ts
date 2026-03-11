import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    treeshake: true,
    minify: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
