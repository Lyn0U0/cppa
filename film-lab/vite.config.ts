/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode demo` produces one self-contained HTML file
// (JS + CSS inlined) that opens with a sample photo loaded.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
