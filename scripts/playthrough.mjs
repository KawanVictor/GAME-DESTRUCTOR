// Partida completa jogada por um robô simples, para medir o equilíbrio das ondas.
// Uso: npm run playthrough [-- arena]      (arena: colina | vale | planalto)
//
// O robô joga pelo teclado e mouse reais, em tempo real: monta um forte
// básico, luta parado nele, coleta materiais, reconstrói, repara e compra
// melhorias entre as ondas. Ele NÃO é um bom jogador (não desvia, não pula
// golpes, não muda de tática) — serve de piso: se ele vence com folga, está
// fácil demais; se morre cedo, está difícil demais.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4175;
const URL = `http://localhost:${PORT}/?test=1`;
const arena = process.argv[2] ?? 'colina';
const LIMIT_MS = 15 * 60 * 1000;

const api = (page, fn, ...args) => page.evaluate(([f, a]) => window.__destructor.game?.[f](...a), [fn, args]);
const snap = (page) => api(page, 'snapshot');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(URL)).ok) return; } catch { /* ainda subindo */ }
    await sleep(500);
  }
  throw new Error('O servidor de preview não respondeu');
}

async function clickCell(page, x, y) {
  const p = await api(page, 'cellToClient', x, y);
  if (!p) return;
  await page.mouse.move(p.x, p.y);
  await sleep(50);
  await page.mouse.click(p.x, p.y);
  await sleep(50);
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
}

/** Anda até a coluna pedida (ou desiste após um tempo). */
async function walkTo(page, tx, maxMs = 4000) {
  const end = Date.now() + maxMs;
  let s = await snap(page);
  while (s && s.player.tx !== tx && Date.now() < end && s.outcome === 'playing') {
    await hold(page, s.player.tx < tx ? 'd' : 'a', 90);
    s = await snap(page);
  }
}

/** Peças do forte, em ordem de prioridade, relativas ao ponto de partida. */
const PLAN = [
  ['3', 2, 0], ['3', 2, -1], ['3', -3, 0], ['3', -3, -1],     // paredes dos dois lados
  ['7', 1, 0],                                                  // torreta
  ['6', 3, 1],                                                  // espinhos no acesso
  ['7', -2, 0], ['6', -4, 1],                                   // segunda torreta e espinhos
  ['2', 1, -1], ['2', -2, -1],                                  // pedra protegendo as torretas
  ['3', 2, -2], ['3', -3, -2],                                  // paredes mais altas
];
const COST = { 1: 10, 2: 20, 3: 15, 4: 25, 5: 20, 6: 30, 7: 50 };
const PIECE = { 2: 'stone_block', 3: 'defensive_wall', 6: 'spike_trap', 7: 'turret' };

async function prepare(page, home) {
  let s = await snap(page);
  if (!s || s.outcome !== 'playing') return;
  // Coleta o que caiu perto das defesas.
  await walkTo(page, home.tx + 4, 2500);
  await walkTo(page, home.tx - 5, 4500);
  await walkTo(page, home.tx, 3000);
  s = await snap(page);
  if (!s || s.outcome !== 'playing') return;

  await page.keyboard.press('b');
  await sleep(80);
  // Repara o que estiver danificado (clique em peça inteira só gera um aviso).
  await page.keyboard.press('t');
  for (const [, dx, dy] of PLAN) {
    if ((await api(page, 'cell', home.tx + dx, home.ty + dy)) !== 'empty') await clickCell(page, home.tx + dx, home.ty + dy);
  }
  // Constrói o que falta, enquanto houver materiais (guarda uma reserva para melhorias depois da onda 2).
  for (const [key, dx, dy] of PLAN) {
    s = await snap(page);
    const reserve = s.wave.number > 2 ? 60 : 0;
    if ((await api(page, 'cell', home.tx + dx, home.ty + dy)) === PIECE[key]) continue;
    if (s.resources - COST[key] < reserve) continue;
    await page.keyboard.press(key);
    await clickCell(page, home.tx + dx, home.ty + dy);
  }
  await page.keyboard.press('Escape');

  // Melhorias: cura se a vida está baixa; senão, a mais útil que couber no bolso.
  s = await snap(page);
  const want = s.player.hp < s.player.maxHp * 0.6 ? ['heal', 'maxHp'] : ['damage', 'fireRate', 'turret', 'maxHp', 'speed', 'dash'];
  for (const id of want) {
    const b = page.locator(`#upgrades [data-upgrade="${id}"]:enabled`);
    if (await b.count()) { await b.first().click(); await sleep(120); if (id !== 'heal') break; }
  }
}

async function fight(page, home, deadline) {
  let s = await snap(page);
  const began = Date.now();
  let reported = false;
  while (s && s.outcome === 'playing' && s.wave.phase === 'fighting' && Date.now() < deadline) {
    // Onda demorando demais: registra o que sobrou em campo, para diagnosticar travamentos.
    if (!reported && Date.now() - began > 100_000) {
      reported = true;
      console.log('ONDA LENTA', JSON.stringify({ onda: s.wave.number, restantes: s.wave.remaining, heroi: [Math.round(s.player.x), Math.round(s.player.y)],
        inimigos: s.enemies.map((e) => [e.type, Math.round(e.x), Math.round(e.y), Math.round(e.hp), e.state]) }));
      await page.screenshot({ path: 'test-results/onda-lenta.png' });
    }
    const foes = s.enemies.filter((e) => e.state !== 'dead');
    const near = foes.sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
    if (near) {
      const dx = near.x - s.player.x;
      const dir = dx < 0 ? -1 : 1;
      if (dir !== s.player.facing) await hold(page, dir < 0 ? 'a' : 'd', 50);
      await page.keyboard.down('k');
      if (Math.abs(dx) < 62) await page.keyboard.press('j', { delay: 30 });
      await sleep(110);
      await page.keyboard.up('k');
      // Longe de casa e sem ninguém colado: volta para o forte.
      if (Math.abs(s.player.tx - home.tx) > 1 && Math.abs(dx) > 80) await walkTo(page, home.tx, 700);
    } else {
      await sleep(150);
    }
    s = await snap(page);
  }
  return s;
}

const server = spawn(`npm run build:e2e && npx vite preview --mode e2e --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
let browser;
const report = [];
try {
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // Sem o tutorial da primeira partida (ele cobriria a tela).
  await page.addInitScript(() => { if (!localStorage.getItem('destructor.save.v1')) localStorage.setItem('destructor.save.v1', JSON.stringify({ version: 1, tutorialDone: true })); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.click(`[data-arena="${arena}"]`);
  await page.click('#btn-play');
  await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game.snapshot().player.onFloor);
  const start = await snap(page);
  const home = { tx: start.player.tx, ty: start.player.ty };
  const deadline = Date.now() + LIMIT_MS;
  let outcome = 'tempo esgotado';

  while (Date.now() < deadline) {
    let s = await snap(page);
    if (!s || s.outcome !== 'playing') break;
    if (s.wave.phase === 'preparing') {
      await prepare(page, home);
      s = await snap(page);
      if (!s || s.outcome !== 'playing') break;
      const wave = s.wave.number;
      const before = { hp: s.player.hp, kills: s.kills, t: Date.now() };
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__destructor.game?.snapshot().wave.phase !== 'preparing', null, { timeout: 5000 }).catch(() => {});
      s = await fight(page, home, deadline);
      const after = (await snap(page)) ?? s;
      report.push({
        onda: wave, segundos: Math.round((Date.now() - before.t) / 1000), abates: (after?.kills ?? 0) - before.kills,
        vidaAntes: Math.round(before.hp), vidaDepois: Math.round(after?.player.hp ?? 0), vidaMax: after?.player.maxHp ?? 0,
        materiais: after?.resources ?? 0, pecas: after?.ownedBlocks ?? 0, torretas: after?.turrets ?? 0,
        regra: after?.modifier ?? null, fim: after?.outcome ?? 'gameover',
      });
      console.log(JSON.stringify(report.at(-1)));
    } else {
      await sleep(200);
    }
    if (await page.locator('#gameover:not(.hidden)').count()) {
      outcome = (await page.locator('#over-title').textContent()) ?? 'fim';
      break;
    }
  }
  // A tela final aparece cerca de 1 s depois do fim da partida.
  await page.waitForSelector('#gameover:not(.hidden)', { timeout: 4000 }).catch(() => {});
  if (await page.locator('#gameover:not(.hidden)').count()) outcome = (await page.locator('#over-title').textContent()) ?? outcome;
  console.log(`RESULTADO (${arena}): ${outcome} — ${report.filter((r) => r.fim === 'playing' || r.fim === 'victory').length} ondas vencidas`);
  if (errors.length) console.log('ERROS DE PÁGINA:', errors);
} finally {
  if (browser) await browser.close();
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill();
}
