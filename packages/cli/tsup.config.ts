import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  noExternal: ['@riflebird/core'],
  external: [
    'chromium-bidi/lib/cjs/bidiMapper/BidiMapper',
    'chromium-bidi/lib/cjs/cdp/CdpConnection',
  ],
});
