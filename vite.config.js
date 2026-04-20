import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project-page base path.
// Repo: joseloramospt-ai/curval-tradeoff-explorer
// Served at: https://joseloramospt-ai.github.io/curval-tradeoff-explorer/
export default defineConfig({
  plugins: [react()],
  base: '/curval-tradeoff-explorer/',
});
