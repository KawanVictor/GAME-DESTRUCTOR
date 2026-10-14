import { defineConfig } from 'vitest/config';
import vercel from './vercel.json';

// Os cabeçalhos de segurança de produção (vercel.json) também valem no
// `vite preview`, então os testes de navegador rodam sob a mesma política.
const headers = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));

export default defineConfig(({ mode }) => ({
  // Caminhos relativos: o build funciona em qualquer subpasta de hospedagem.
  base: './',
  define: {
    // A API de inspeção usada pelos testes só existe fora do build de produção
    // (desenvolvimento e o build de testes, `--mode e2e`).
    __TEST_API__: mode !== 'production',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
    // O build de testes vai para outra pasta: nunca é publicado por engano.
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
  },
  preview: { headers },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
