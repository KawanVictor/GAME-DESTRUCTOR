// Gera as capturas de tela do README em docs/screenshots/.
// Uso: npm run screenshots   (faz o build, sobe o preview e joga de verdade)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4174;
const URL = `http://localhost:${PORT}/?test=1`;
const OUT = 'docs/screenshots';

const api = (page, fn, ...args) => page.evaluate(([f, a]) => window.__destructor.game[f](...a), [fn, args]);

async function clickCell(page, x, y) {
  const p = await api(page, 'cellToClient', x, y);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(60);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(60);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('O servidor de preview não respondeu');
}

mkdirSync(OUT, { recursive: true });
const server = spawn(`npm run build && npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 1. Menu inicial
  await page.goto(URL);
  await page.waitForSelector('#menu:not(.hidden)');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/menu.png` });

  // 2. Construção: defesas montadas na colina, com a prévia de uma peça
  await page.click('#btn-play');
  await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game.snapshot().player.onFloor);
  await api(page, 'setResources', 600);
  await api(page, 'setPrepTimer', 45);
  const { tx, ty } = (await api(page, 'snapshot')).player;
  await page.keyboard.press('b');
  const build = async (key, cells) => { await page.keyboard.press(key); for (const [dx, dy] of cells) await clickCell(page, tx + dx, ty + dy); };
  await build('3', [[2, 0], [2, -1], [-3, 0], [-3, -1]]);      // paredes defensivas dos dois lados
  await build('6', [[3, 1], [-4, 1]]);                          // espinhos no degrau de acesso
  await build('7', [[1, 0], [-2, 0]]);                          // torretas atrás das paredes
  await build('2', [[1, -1]]);                                  // bloco de pedra sobre a torreta
  await build('1', [[0, -1]]);                                  // plataforma apoiada no bloco
  await build('4', [[5, 2]]);                                   // explosivo no caminho
  await page.keyboard.press('5');
  const ghost = await api(page, 'cellToClient', tx - 1, ty);
  await page.mouse.move(ghost.x, ghost.y);
  await page.waitForTimeout(700);                               // deixa o aviso inicial sumir
  await page.waitForSelector('#banner', { state: 'hidden' });
  await page.screenshot({ path: `${OUT}/construcao.png` });

  // 3. Combate: a onda chega, as torretas atiram e o herói dispara
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const s = window.__destructor.game.snapshot();
    return s.enemies.filter((e) => Math.abs(e.x - s.player.x) < 230).length >= 2;
  }, null, { timeout: 60_000 });
  await page.waitForSelector('#banner', { state: 'hidden' });
  const s = await api(page, 'snapshot');
  const near = s.enemies.sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
  await page.keyboard.press(near.x < s.player.x ? 'a' : 'd', { delay: 50 });
  await page.keyboard.down('k');
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/combate.png` });
  await page.keyboard.up('k');

  // 4. Chefe: o Titã chega com escolta voadora e um atirador
  await api(page, 'spawnEnemy', 'boss', 7);
  await api(page, 'spawnEnemy', 'flyer', -6);
  await api(page, 'spawnEnemy', 'spitter', -8);
  await page.waitForSelector('#boss:not(.hidden)');
  await page.waitForTimeout(1500);
  await page.keyboard.down('k');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/chefe.png` });
  await page.keyboard.up('k');

  // 5. Controles de toque, em tamanho de celular, na arena Vale
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
  await phone.goto(URL);
  await phone.click('#btn-menu-options');
  await phone.selectOption('#opt-touch', 'on');
  await phone.click('#btn-options-close');
  await phone.click('[data-arena="vale"]');
  await phone.click('#btn-play');
  await phone.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game.snapshot().player.onFloor);
  await phone.waitForSelector('#banner', { state: 'hidden' });
  await phone.screenshot({ path: `${OUT}/toque.png` });
  console.log(`Capturas salvas em ${OUT}/`);
} finally {
  if (browser) await browser.close();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}
