import { defineConfig, devices } from '@playwright/test';

// Os testes rodam contra o build de produção servido pelo `vite preview`.
// Padrão: só o Chrome já instalado (channel), sem baixar navegadores.
// Com BROWSERS=all rodam também Firefox e WebKit (o motor do Safari);
// antes, instale-os com `npx playwright install firefox webkit`.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const all = env.BROWSERS === 'all';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chrome', use: { channel: 'chrome' } },
    ...(all
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
          { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } } },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
