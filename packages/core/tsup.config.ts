import { defineConfig } from 'tsup';
import pkg from './package.json';

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['playwright', 'openai'],
  publicDir: 'src/prompts',
  outDir: 'dist',
  define: {
    'process.env.RIFLEBIRD_VERSION': JSON.stringify(pkg.version),
  },
});
