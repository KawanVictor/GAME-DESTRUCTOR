import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta de hospedagem.
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
