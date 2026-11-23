import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
  server: {
    watch: {
      // Artefatos de análise que não fazem parte do app.
      ignored: ['**/*.har', '**/analise-rea/**', '**/pagina-salva/**', '**/.wrangler/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
