import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output is committed to ../studio so GitHub Pages serves it at /studio/.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../studio', emptyOutDir: true },
});
