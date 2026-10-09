import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const dev = (f: string) => fileURLToPath(new URL(`./dev/${f}`, import.meta.url));

// Built output is committed to ../studio so GitHub Pages serves it at /studio/.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@client': dev(mode === 'demo' ? 'mock.ts' : 'real.ts') } },
  build: { outDir: '../studio', emptyOutDir: true },
}));
