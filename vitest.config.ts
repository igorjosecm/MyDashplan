import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts para não subir o runtime do Workers nos testes unitários.
export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'worker/**/*.test.ts'],
    environment: 'node',
  },
});
