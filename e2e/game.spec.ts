import { expect, type Page, test } from '@playwright/test';
import type { DebugApi, DebugSnapshot } from '../src/game/debug';

declare global {
  interface Window {
    __destructor?: { scene: string; game: DebugApi | null };
  }
}

// Os testes usam teclado e mouse de verdade. A API ?test=1 serve para LER o
// estado (posição, recursos, onda) e, em dois casos, criar um inimigo avulso.

const snap = (page: Page): Promise<DebugSnapshot> =>
  page.evaluate(() => (window.__destructor?.game as DebugApi).snapshot());
const cell = (page: Page, x: number, y: number): Promise<string> =>
  page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cell(cx, cy), [x, y]);

async function clickCell(page: Page, x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const p = await page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellToClient(cx, cy), [x, y]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
  await page.mouse.click(p.x, p.y, { button });
  await page.waitForTimeout(80);
}

async function startGame(page: Page): Promise<DebugSnapshot> {
  await page.goto('/?test=1');
  await expect(page.locator('#menu')).toBeVisible();
  await page.click('#btn-play');
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
  return snap(page);
}

/** Leva o herói da colina central para o chão plano à esquerda. */
async function toFlatGround(page: Page): Promise<DebugSnapshot> {
  await page.keyboard.down('a');
  await page.waitForFunction(() => (window.__destructor?.game as DebugApi).snapshot().player.tx <= 27);
  await page.keyboard.up('a');
  await page.waitForTimeout(500);
  return snap(page);
}

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Luta de verdade: vira para o inimigo mais próximo e alterna golpe e disparo. */
async function fightUntil(page: Page, done: (s: DebugSnapshot) => boolean, timeoutMs: number): Promise<DebugSnapshot> {
  const end = Date.now() + timeoutMs;
  let s = await snap(page);
  while (!done(s) && Date.now() < end) {
    const foe = s.enemies.filter((e) => e.state !== 'dead').sort((a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x))[0];
    if (foe) {
      const dir = foe.x < s.player.x ? -1 : 1;
      if (dir !== s.player.facing) await hold(page, dir < 0 ? 'a' : 'd', 60);
      await page.keyboard.down('k');
      await page.keyboard.press('j', { delay: 40 });
      await page.waitForTimeout(120);
      await page.keyboard.up('k');
    } else {
      await page.waitForTimeout(150);
    }
    s = await snap(page);
  }
  return s;
}

// O WebKit do Playwright no Windows roda este jogo a ~11 quadros por segundo e entrega as teclas com
// atraso de centenas de ms. Os testes que medem deslocamento dentro de uma janela curta de tempo não
// são confiáveis nele e ficam de fora; os demais rodam normalmente.
const WEBKIT_LENTO = 'depende de tempo de resposta: o WebKit headless no Windows roda a ~11 fps';

test.describe('DESTRUCTOR', () => {
  // Nenhum teste pode terminar com erro de JavaScript na página.
  // Idem para qualquer recurso bloqueado pela Content-Security-Policy.
  let pageErrors: string[] = [];
  test.beforeEach(({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (/content.security.policy|violates the following/i.test(m.text())) pageErrors.push(`CSP: ${m.text()}`);
    });
  });
  test.afterEach(async ({ page }) => {
    await expect(page.locator('#fatal')).toBeHidden();
    expect(pageErrors).toEqual([]);
  });

  test('menu inicial é exibido e a partida pode ser iniciada', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?test=1');
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('.logo')).toHaveText('DESTRUCTOR');
    await expect(page.locator('#hud')).toBeHidden();
    await expect(page.locator('canvas')).toBeVisible();
    await page.click('#btn-howto');
    await expect(page.locator('#howto')).toBeVisible();
    await page.screenshot({ path: 'test-results/shots/menu.png' });

    await page.click('#btn-play');
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#hp-text')).toHaveText('100/100');
    await expect(page.locator('#res-value')).toHaveText('150');
    await expect(page.locator('#wave-title')).toHaveText('Onda 1 de 10');
    await expect(page.locator('#wave-sub')).toContainText('Preparação');
    await expect(page.locator('#fatal')).toBeHidden();
    expect(errors).toEqual([]);
    // A política de segurança chega junto com a página.
    const response = await page.request.get('/');
    expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('o personagem responde aos controles', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await startGame(page);
    const s0 = await toFlatGround(page);
    await hold(page, 'd', 500);
    const s1 = await snap(page);
    expect(s1.player.x).toBeGreaterThan(s0.player.x + 40);
    expect(s1.player.facing).toBe(1);

    await hold(page, 'ArrowLeft', 500);
    const s2 = await snap(page);
    expect(s2.player.x).toBeLessThan(s1.player.x - 40);
    expect(s2.player.facing).toBe(-1);

    // Solta: o arrasto para o herói.
    await page.waitForTimeout(400);
    const s3 = await snap(page);
    await page.waitForTimeout(200);
    expect(Math.abs((await snap(page)).player.x - s3.player.x)).toBeLessThan(1);

    // Pulo: sai do chão, sobe e volta para o mesmo nível.
    await page.keyboard.down('Space');
    await page.waitForTimeout(220);
    const air = await snap(page);
    await page.keyboard.up('Space');
    expect(air.player.onFloor).toBe(false);
    expect(air.player.y).toBeLessThan(s3.player.y - 40);
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    expect((await snap(page)).player.y).toBeCloseTo(s3.player.y, 0);

    // Pulo curto (toque rápido) sobe menos que o pulo cheio.
    await page.keyboard.press('Space', { delay: 30 });
    let peakShort = s3.player.y;
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(40); peakShort = Math.min(peakShort, (await snap(page)).player.y); }
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    await page.keyboard.down('Space');
    let peakFull = s3.player.y;
    for (let i = 0; i < 14; i++) { await page.waitForTimeout(40); peakFull = Math.min(peakFull, (await snap(page)).player.y); }
    await page.keyboard.up('Space');
    expect(s3.player.y - peakFull).toBeGreaterThan((s3.player.y - peakShort) + 15);
  });

  test('construção: prévia, custo, recusa, armadilhas e demolição', async ({ page }) => {
    const s0 = await startGame(page);
    const { tx, ty } = s0.player;

    await page.keyboard.press('b');
    await expect(page.locator('#build-menu')).toBeVisible();
    await expect(page.locator('#build-items .piece')).toHaveCount(9);       // 7 peças + reparo + demolição

    // Escolher a peça pelo menu não constrói nada por acidente.
    await page.click('[data-piece="stone_block"]');
    await expect(page.locator('[data-piece="stone_block"]')).toHaveClass(/selected/);
    expect((await snap(page)).ownedBlocks).toBe(0);

    // Prévia válida mostra o custo; clique confirma e desconta.
    const p = await page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellToClient(cx, cy), [tx + 2, ty]);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator('#build-tip')).toContainText('custo 20');
    await expect(page.locator('#build-tip')).toHaveClass(/ok/);
    await page.mouse.click(p.x, p.y);
    await expect.poll(() => cell(page, tx + 2, ty)).toBe('stone_block');
    await expect(page.locator('#res-value')).toHaveText('130');

    // Mesma célula de novo: recusada, sem cobrar.
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#toast')).toContainText('Espaço ocupado');
    expect((await snap(page)).resources).toBe(130);

    // Peça flutuando: a prévia explica o motivo e o clique não constrói.
    const air = await page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellToClient(cx, cy), [tx + 5, ty - 2]);
    await page.mouse.move(air.x, air.y);
    await expect(page.locator('#build-tip')).toHaveClass(/bad/);
    await expect(page.locator('#build-tip')).toContainText('encostar');
    await page.mouse.click(air.x, air.y);
    expect(await cell(page, tx + 5, ty - 2)).toBe('empty');
    expect((await snap(page)).resources).toBe(130);

    // Plataforma (tecla 1) apoiada no bloco; armadilhas (6 e 7).
    await page.keyboard.press('1');
    await clickCell(page, tx + 2, ty - 1);
    expect(await cell(page, tx + 2, ty - 1)).toBe('wood_platform');
    await page.keyboard.press('6');
    await clickCell(page, tx - 2, ty);
    expect(await cell(page, tx - 2, ty)).toBe('spike_trap');
    await page.keyboard.press('7');
    await clickCell(page, tx - 3, ty);
    expect(await cell(page, tx - 3, ty)).toBe('turret');
    let s = await snap(page);
    expect(s.resources).toBe(130 - 10 - 30 - 50);
    expect(s.turrets).toBe(1);
    expect(s.ownedBlocks).toBe(4);
    await page.screenshot({ path: 'test-results/shots/build.png' });

    // Botão direito cancela a prévia; clicar depois não constrói.
    await clickCell(page, tx + 1, ty, 'right');
    await expect(page.locator('#build-tip')).toBeHidden();
    await clickCell(page, tx + 1, ty);
    expect(await cell(page, tx + 1, ty)).toBe('empty');

    // Demolição (R): devolve metade do custo do bloco de pedra.
    await page.keyboard.press('r');
    await expect(page.locator('[data-piece="demolish"]')).toHaveClass(/selected/);
    await clickCell(page, tx + 2, ty);
    expect(await cell(page, tx + 2, ty)).toBe('empty');
    s = await snap(page);
    expect(s.resources).toBe(40 + 10);
    // Terreno não é do jogador: não demole.
    await clickCell(page, tx, ty + 1);
    expect(await cell(page, tx, ty + 1)).toBe('terrain');

    // Esc fecha o menu de construção sem pausar.
    await page.keyboard.press('Escape');
    await expect(page.locator('#build-menu')).toBeHidden();
    await expect(page.locator('#pause')).toBeHidden();
  });

  test('combate: golpe, disparo, recompensa e inimigos contra o cenário', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await startGame(page);
    await toFlatGround(page);

    // Golpe corpo a corpo derrota um inimigo vizinho.
    await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('basic', 2));
    await page.waitForTimeout(300);
    let s = await fightUntil(page, (v) => v.kills >= 1, 15_000);
    expect(s.kills).toBe(1);
    expect(s.enemies).toHaveLength(0);
    // As gemas soltas são coletadas e viram materiais.
    await expect.poll(async () => (await snap(page)).resources, { timeout: 8000 }).toBeGreaterThan(150);

    // Disparo fere à distância.
    const id = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('tank', -3));
    await page.waitForTimeout(700);
    await hold(page, 'a', 60);
    const before = (await snap(page)).enemies.find((e) => e.id === id)?.hp ?? 0;
    await hold(page, 'k', 900);
    const after = (await snap(page)).enemies.find((e) => e.id === id)?.hp ?? 0;
    expect(after).toBeLessThan(before);
    expect((await snap(page)).bullets).toBeLessThanOrEqual(40);
    s = await fightUntil(page, (v) => v.kills >= 2, 30_000);
    expect(s.kills).toBe(2);

    // Parede dupla barra o Rastejador; ele ataca a parede. Espinhos no caminho o ferem.
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setResources(300));
    const base = (await snap(page)).player;
    const wx = base.tx + 2;
    await page.keyboard.press('b');
    await page.keyboard.press('3');
    await clickCell(page, wx, base.ty);
    await clickCell(page, wx, base.ty - 1);
    await page.keyboard.press('6');
    await clickCell(page, wx + 1, base.ty);
    expect(await cell(page, wx, base.ty)).toBe('defensive_wall');
    expect(await cell(page, wx + 1, base.ty)).toBe('spike_trap');
    await page.keyboard.press('Escape');
    const foe = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('basic', 5));
    await expect.poll(async () => {
      const e = (await snap(page)).enemies.find((v) => v.id === foe);
      return !e || e.hp < 40;                      // espinhos causaram dano (ou mataram)
    }, { timeout: 15_000 }).toBe(true);
    const e1 = (await snap(page)).enemies.find((v) => v.id === foe);
    if (e1) expect(e1.x).toBeGreaterThan(wx * 32);  // não atravessou a parede
    await page.screenshot({ path: 'test-results/shots/combat.png' });
  });

  test('torreta detecta, atira e fere inimigos sozinha', async ({ page }) => {
    await startGame(page);
    const s0 = await toFlatGround(page);
    await page.keyboard.press('b');
    await page.keyboard.press('7');
    await clickCell(page, s0.player.tx + 1, s0.player.ty);
    expect(await cell(page, s0.player.tx + 1, s0.player.ty)).toBe('turret');
    await page.keyboard.press('Escape');
    // Inimigo do outro lado da torreta; o herói não ataca.
    const id = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('tank', -3));
    await expect.poll(async () => (await snap(page)).enemies.find((e) => e.id === id)?.hp ?? 0, { timeout: 10_000 }).toBeLessThan(170);
    expect((await snap(page)).kills).toBe(0);
    await page.screenshot({ path: 'test-results/shots/turret.png' });
  });

  test('peças especiais: plataforma de impulso e bloco explosivo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await startGame(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));
    const s0 = await toFlatGround(page);
    const { tx, ty } = s0.player;
    const ground = s0.player.y;

    // Plataforma de impulso: o herói pula e ela é construída embaixo dele, no ar.
    await page.keyboard.press('b');
    await page.keyboard.press('5');
    const under = await page.evaluate(([x, y]) => (window.__destructor?.game as DebugApi).cellToClient(x, y), [tx, ty]);
    await page.mouse.move(under.x, under.y);
    await expect(page.locator('#build-tip')).toContainText('alguém no caminho');      // com o herói no lugar, não pode
    await page.keyboard.down('Space');
    await page.waitForFunction((g) => (window.__destructor?.game as DebugApi).snapshot().player.y < g - 60, ground);
    await page.mouse.click(under.x, under.y);
    await page.keyboard.up('Space');
    expect(await cell(page, tx, ty)).toBe('jump_pad');
    // Ao cair nela, é lançado bem acima de um pulo normal (~3 tiles) e alcança a plataforma alta.
    let peak = ground;
    for (let i = 0; i < 45; i++) { await page.waitForTimeout(40); peak = Math.min(peak, (await snap(page)).player.y); }
    expect(ground - peak).toBeGreaterThan(32 * 6);
    await page.keyboard.press('Escape');

    // Sai da coluna do impulso, pela plataforma alta, e desce atravessando a madeira (baixo + pulo).
    await page.keyboard.down('d');
    await page.waitForFunction((x) => {
      const p = (window.__destructor?.game as DebugApi).snapshot().player;
      return p.onFloor && p.tx >= x;
    }, tx + 1, { timeout: 20_000 });
    await page.keyboard.up('d');
    await page.waitForTimeout(300);
    if ((await snap(page)).player.y < ground - 40) {
      await page.keyboard.down('s');
      await page.keyboard.press('Space', { delay: 60 });
      await page.keyboard.up('s');
    }
    await page.waitForFunction((g) => {
      const p = (window.__destructor?.game as DebugApi).snapshot().player;
      return p.onFloor && p.y >= g - 1;
    }, ground, { timeout: 20_000 });

    // Demole a plataforma de impulso para liberar a linha de tiro.
    await page.keyboard.press('r');
    await clickCell(page, tx, ty);
    expect(await cell(page, tx, ty)).toBe('empty');

    // Explosivo ao lado do herói, pedra mais atrás e um inimigo chegando por aquele lado.
    const here = (await snap(page)).player;
    await page.keyboard.press('4');
    await clickCell(page, here.tx - 1, here.ty);
    expect(await cell(page, here.tx - 1, here.ty)).toBe('explosive_block');
    await page.keyboard.press('2');
    await clickCell(page, here.tx - 3, here.ty);
    expect(await cell(page, here.tx - 3, here.ty)).toBe('stone_block');
    await page.keyboard.press('Escape');
    await hold(page, 'a', 40);
    const foe = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('tank', -2.6));
    await page.waitForTimeout(350);
    // Um golpe ativa o bloco: a explosão fere o inimigo e (menos) o próprio herói; a pedra resiste.
    await page.keyboard.press('j', { delay: 40 });
    await expect.poll(() => cell(page, here.tx - 1, here.ty), { timeout: 8000 }).toBe('empty');
    const after = await snap(page);
    expect(after.enemies.find((e) => e.id === foe)?.hp ?? 0).toBeLessThan(170);
    expect(after.player.hp).toBeLessThan(100);
    expect(after.player.hp).toBeGreaterThan(50);
    expect(await cell(page, here.tx - 3, here.ty)).toBe('stone_block');
  });

  test('vitória: tela final e continuação no modo infinito', async ({ page }) => {
    await startGame(page);
    // Atalho de teste: encerra como vitória (as 10 ondas reais levam vários minutos).
    await page.evaluate(() => (window.__destructor?.game as DebugApi).forceVictory());
    await expect(page.locator('#gameover')).toBeVisible();
    await expect(page.locator('#over-title')).toHaveText('Vitória!');
    await expect(page.locator('#btn-over-continue')).toBeVisible();
    await page.click('#btn-over-continue');
    await expect(page.locator('#gameover')).toBeHidden();
    await expect.poll(async () => (await page.evaluate(() => window.__destructor?.scene))).toBe('game');
    const s = await snap(page);
    expect(s.outcome).toBe('playing');
    expect(s.wave.phase).toBe('preparing');
    await expect(page.locator('#wave-title')).toContainText('infinito');
    const t0 = s.time;
    await page.waitForTimeout(300);
    expect((await snap(page)).time).toBeGreaterThan(t0);
  });


  test('mira assistida: do alto da colina o disparo acerta quem está embaixo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await startGame(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));
    // O herói vai até a beira do topo da colina; o inimigo nasce à direita, dois níveis abaixo.
    await page.keyboard.down('d');
    await page.waitForFunction(() => (window.__destructor?.game as DebugApi).snapshot().player.tx >= 38);
    await page.keyboard.up('d');
    await page.waitForTimeout(350);
    // Coluna 42: chão plano à direita da colina, sem plataforma nem caixote em cima.
    const edge = (await snap(page)).player.x;
    const id = await page.evaluate((tiles) => (window.__destructor?.game as DebugApi).spawnEnemy('tank', tiles), 42.5 - edge / 32);
    await page.waitForTimeout(500);
    const before = await snap(page);
    const foe = before.enemies.find((e) => e.id === id);
    expect(foe && foe.y).toBeGreaterThan(before.player.y + 20);      // está mais baixo que o herói
    await hold(page, 'd', 50);
    await hold(page, 'k', 900);
    expect((await snap(page)).enemies.find((e) => e.id === id)?.hp ?? 0).toBeLessThan(foe?.hp ?? 0);
  });

  test('investida: avanço rápido com recarga', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await startGame(page);
    await toFlatGround(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));
    await hold(page, 'd', 50);
    await page.waitForTimeout(400);
    const x0 = (await snap(page)).player.x;
    await page.keyboard.press('l');
    await page.waitForTimeout(260);
    const x1 = (await snap(page)).player.x;
    expect(x1 - x0).toBeGreaterThan(70);
    // Em recarga: apertar de novo logo em seguida não avança outra vez.
    await page.waitForTimeout(300);
    const x2 = (await snap(page)).player.x;
    await page.keyboard.press('l');
    await page.waitForTimeout(260);
    expect((await snap(page)).player.x - x2).toBeLessThan(20);
    await expect(page.locator('#cd-dash')).not.toHaveAttribute('style', /width: 100%/);
  });

  test('reparo: restaura uma peça danificada por um custo proporcional', async ({ page }) => {
    const s0 = await startGame(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));
    const { tx, ty } = s0.player;
    await page.keyboard.press('b');
    await page.keyboard.press('2');
    await clickCell(page, tx + 2, ty);
    await page.evaluate(([x, y]) => (window.__destructor?.game as DebugApi).damageCell(x, y, 110), [tx + 2, ty]);
    const hp = (x: number, y: number): Promise<number> => page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellHp(cx, cy), [x, y]);
    expect(await hp(tx + 2, ty)).toBe(110);
    const before = (await snap(page)).resources;

    await page.keyboard.press('t');
    await expect(page.locator('[data-piece="repair"]')).toHaveClass(/selected/);
    const p = await page.evaluate(([x, y]) => (window.__destructor?.game as DebugApi).cellToClient(x, y), [tx + 2, ty]);
    await page.mouse.move(p.x, p.y);
    await expect(page.locator('#build-tip')).toContainText('Reparar Bloco de pedra — custo 5');
    await page.mouse.click(p.x, p.y);
    await expect.poll(() => hp(tx + 2, ty)).toBe(220);
    expect((await snap(page)).resources).toBe(before - 5);
    // Peça inteira: nada a reparar, nada cobrado.
    await page.mouse.click(p.x, p.y);
    await expect(page.locator('#toast')).toContainText('já está inteira');
    expect((await snap(page)).resources).toBe(before - 5);
  });

  test('novos inimigos: Vespa voa, Cuspidor atira de longe e o Titã tem barra de chefe', async ({ page }) => {
    await startGame(page);
    await toFlatGround(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));

    // Vespa: fica no ar (acima do herói) e é abatida a tiros.
    const flyer = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('flyer', 6));
    await page.waitForTimeout(700);
    let s = await snap(page);
    expect(s.enemies.find((e) => e.id === flyer)?.y ?? 9999).toBeLessThan(s.player.y - 40);
    s = await fightUntil(page, (v) => v.kills >= 1, 40_000);
    expect(s.kills).toBe(1);

    // Cuspidor: fere o herói sem encostar.
    const hp0 = (await snap(page)).player.hp;
    const spitter = await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('spitter', -7));
    await expect.poll(async () => (await snap(page)).player.hp, { timeout: 15_000 }).toBeLessThan(hp0);
    s = await snap(page);
    const sp = s.enemies.find((e) => e.id === spitter);
    expect(sp && Math.abs(sp.x - s.player.x)).toBeGreaterThan(32 * 2.5);
    s = await fightUntil(page, (v) => v.kills >= 2, 40_000);
    expect(s.kills).toBe(2);

    // Titã: aparece com nome e barra de vida.
    await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('boss', 8));
    await expect(page.locator('#boss')).toBeVisible();
    await expect(page.locator('#boss-name')).toHaveText('Titã');
    await page.screenshot({ path: 'test-results/shots/boss.png' });
  });

  test('arenas: a escolha no menu muda o mapa e fica salva', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.locator('#arena-list [data-arena]')).toHaveCount(3);
    await expect(page.locator('[data-arena="colina"]')).toHaveAttribute('aria-checked', 'true');
    await page.click('[data-arena="vale"]');
    await expect(page.locator('[data-arena="vale"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#arena-desc')).toContainText('descem');
    await page.click('#btn-play');
    await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
    const vale = await snap(page);
    expect(vale.arena).toBe('vale');
    await page.screenshot({ path: 'test-results/shots/vale.png' });

    await page.reload();
    await expect(page.locator('[data-arena="vale"]')).toHaveAttribute('aria-checked', 'true');
    await page.click('[data-arena="planalto"]');
    await page.click('#btn-play');
    await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
    const planalto = await snap(page);
    expect(planalto.arena).toBe('planalto');
    expect(planalto.player.y).not.toBe(vale.player.y);       // terrenos diferentes
  });

  test('opções: remapear teclas vale na partida e fica salvo', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await page.goto('/?test=1');
    await page.click('#btn-menu-options');
    await expect(page.locator('#options')).toBeVisible();
    await page.click('[data-rebind="jump"]');
    await expect(page.locator('[data-rebind="jump"]')).toContainText('Aperte');
    await page.keyboard.press('w');
    await expect(page.locator('[data-rebind="jump"]')).toHaveText('W');
    // Tecla já usada troca com a outra ação.
    await page.click('[data-rebind="melee"]');
    await page.keyboard.press('k');
    await expect(page.locator('[data-rebind="melee"]')).toHaveText('K');
    await expect(page.locator('[data-rebind="shoot"]')).toHaveText('J');
    await page.locator('#opt-volume').fill('0.3');
    await page.uncheck('#opt-music');
    await page.keyboard.press('Escape');
    await expect(page.locator('#options')).toBeHidden();
    await expect(page.locator('#menu')).toBeVisible();          // Esc fechou só as opções

    await page.click('#btn-play');
    await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
    await expect(page.locator('.weapons [data-key="melee"]')).toHaveText('K');
    const y0 = (await snap(page)).player.y;
    await page.keyboard.press('Space', { delay: 150 });
    expect((await snap(page)).player.y).toBeCloseTo(y0, 0);    // Espaço não pula mais
    await page.keyboard.down('w');
    await page.waitForTimeout(200);
    expect((await snap(page)).player.y).toBeLessThan(y0 - 30);
    await page.keyboard.up('w');

    // Remapear durante a pausa passa a valer na mesma partida.
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    await page.keyboard.press('Escape');
    await page.click('#btn-pause-options');
    await page.click('#btn-keys-reset');
    await expect(page.locator('[data-rebind="jump"]')).toHaveText('Espaço');
    await page.click('#btn-options-close');
    await expect(page.locator('#pause')).toBeVisible();
    await page.click('#btn-resume');
    await page.waitForTimeout(150);                      // a cena retoma no quadro seguinte
    await page.keyboard.down('Space');
    await page.waitForTimeout(200);
    expect((await snap(page)).player.y).toBeLessThan(y0 - 30);
    await page.keyboard.up('Space');

    await page.reload();
    await page.click('#btn-menu-options');
    await expect(page.locator('#opt-volume')).toHaveValue('0.3');
    await expect(page.locator('#opt-music')).not.toBeChecked();
    await expect(page.locator('[data-rebind="melee"]')).toHaveText('J');
  });

  test('controles de toque movem, pulam e atacam', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', WEBKIT_LENTO);
    await page.goto('/?test=1');
    await page.click('#btn-menu-options');
    await page.selectOption('#opt-touch', 'on');
    await page.click('#btn-options-close');
    await page.click('#btn-play');
    await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
    await expect(page.locator('#touch')).toBeVisible();
    await expect(page.locator('.weapons')).toBeHidden();
    await page.evaluate(() => (window.__destructor?.game as DebugApi).setPrepTimer(600));

    const press = (name: string, type: 'pointerdown' | 'pointerup'): Promise<void> =>
      page.dispatchEvent(`[data-touch="${name}"]`, type, { pointerId: 7, pointerType: 'touch', bubbles: true });
    const x0 = (await snap(page)).player.x;
    await press('left', 'pointerdown');
    await page.waitForTimeout(450);
    await press('left', 'pointerup');
    const s1 = await snap(page);
    expect(s1.player.x).toBeLessThan(x0 - 40);
    expect(s1.player.facing).toBe(-1);
    await page.waitForTimeout(400);
    const still = (await snap(page)).player.x;
    await page.waitForTimeout(200);
    expect(Math.abs((await snap(page)).player.x - still)).toBeLessThan(1);      // soltou: parou

    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    const y0 = (await snap(page)).player.y;
    await press('jump', 'pointerdown');
    await page.waitForTimeout(200);
    expect((await snap(page)).player.y).toBeLessThan(y0 - 30);
    await press('jump', 'pointerup');

    // Golpe pelo botão de toque derrota um inimigo vizinho.
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).spawnEnemy('basic', -1.5));
    const end = Date.now() + 20_000;
    while ((await snap(page)).kills < 1 && Date.now() < end) {
      await press('melee', 'pointerdown');
      await page.waitForTimeout(80);
      await press('melee', 'pointerup');
      await page.waitForTimeout(320);
    }
    expect((await snap(page)).kills).toBe(1);
    await page.screenshot({ path: 'test-results/shots/touch.png' });
  });

  test('ondas: concluir a primeira e começar a seguinte', async ({ page }) => {
    await startGame(page);
    await toFlatGround(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await snap(page)).wave.phase).toBe('fighting');
    await expect(page.locator('#wave-sub')).toContainText('Inimigos restantes: 3');
    await expect(page.locator('#btn-start-wave')).toBeHidden();

    const s = await fightUntil(page, (v) => v.wave.completed >= 1, 90_000);
    expect(s.wave.completed).toBe(1);
    expect(s.kills).toBe(3);
    expect(s.player.hp).toBeGreaterThan(0);
    await expect(page.locator('#banner-title')).toHaveText('Onda 1 concluída');
    // Recompensa da onda (31) somada aos materiais.
    expect(s.resources).toBeGreaterThanOrEqual(150 + 31);

    // Intervalo de preparo: contagem visível, melhorias à venda.
    await expect.poll(async () => (await snap(page)).wave.phase, { timeout: 6000 }).toBe('preparing');
    await expect(page.locator('#wave-title')).toHaveText('Onda 2 de 10');
    await expect(page.locator('#wave-sub')).toContainText('começa em');
    await expect(page.locator('#upgrades')).toBeVisible();
    // A cura mais três melhorias sorteadas; comprar uma desconta o custo e a tira da oferta.
    const before = await snap(page);
    expect(before.offers).toHaveLength(4);
    expect(before.offers).toContain('heal');
    await expect(page.locator('#upgrades [data-upgrade]')).toHaveCount(4);
    const pick = page.locator('#upgrades [data-upgrade]:not([data-upgrade="heal"]):enabled').first();
    const id = await pick.getAttribute('data-upgrade');
    const cost = Number(await pick.getAttribute('data-cost'));
    await pick.click();
    const up = await snap(page);
    expect(up.resources).toBe(before.resources - cost);
    expect(up.offers).not.toContain(id);
    await expect(page.locator('#upgrades [data-upgrade]')).toHaveCount(3);

    await page.click('#btn-start-wave');
    await expect.poll(async () => (await snap(page)).wave.phase).toBe('fighting');
    expect((await snap(page)).wave.number).toBe(2);
    await page.screenshot({ path: 'test-results/shots/wave2.png' });
  });

  test('pausa congela a simulação; reiniciar zera a partida', async ({ page }) => {
    const s0 = await startGame(page);
    await page.keyboard.press('b');
    await page.keyboard.press('2');
    await clickCell(page, s0.player.tx + 2, s0.player.ty);
    expect((await snap(page)).ownedBlocks).toBe(1);
    await page.keyboard.press('Escape');                 // fecha a construção
    await page.keyboard.press('Enter');                  // começa a onda
    await expect.poll(async () => (await snap(page)).enemies.length, { timeout: 8000 }).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('#pause')).toBeVisible();
    const p1 = await snap(page);
    expect(p1.paused).toBe(true);
    await page.keyboard.down('d');
    await page.waitForTimeout(600);
    await page.keyboard.up('d');
    const p2 = await snap(page);
    expect(p2.time).toBe(p1.time);
    expect(p2.player.x).toBe(p1.player.x);
    expect(p2.enemies.map((e) => e.x)).toEqual(p1.enemies.map((e) => e.x));
    expect(p2.wave.timer).toBe(p1.wave.timer);

    await page.click('#btn-resume');
    await expect(page.locator('#pause')).toBeHidden();
    await page.waitForTimeout(300);
    expect((await snap(page)).time).toBeGreaterThan(p1.time);

    await page.click('#btn-pause');
    await expect(page.locator('#pause')).toBeVisible();
    await page.click('#btn-restart');
    await expect(page.locator('#pause')).toBeHidden();
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().player.onFloor === true);
    const r = await snap(page);
    expect(r.resources).toBe(150);
    expect(r.ownedBlocks).toBe(0);
    expect(r.enemies).toHaveLength(0);
    expect(r.kills).toBe(0);
    expect(r.wave).toMatchObject({ number: 1, completed: 0, phase: 'preparing' });
    expect(r.player.hp).toBe(100);
    expect(r.paused).toBe(false);
    expect(await cell(page, s0.player.tx + 2, s0.player.ty)).toBe('empty');
    await expect(page.locator('#res-value')).toHaveText('150');
    // Sem ouvintes duplicados: um único B abre o menu (dois o fechariam de novo).
    await page.keyboard.press('b');
    await expect(page.locator('#build-menu')).toBeVisible();
  });

  test('derrota, reinício sem recarregar e dados salvos', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const g = window.__destructor?.game as DebugApi;
      for (const d of [-1, 1, -2, 2, 0.5]) g.spawnEnemy('tank', d);
    });
    await expect(page.locator('#gameover')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#over-title')).toHaveText('Derrota');
    await expect(page.locator('#btn-over-continue')).toBeHidden();
    await page.screenshot({ path: 'test-results/shots/defeat.png' });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('destructor.save.v1') ?? '{}'));
    expect(saved.stats.games).toBe(1);

    await page.click('#btn-over-restart');
    await expect(page.locator('#gameover')).toBeHidden();
    await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
    const r = await snap(page);
    expect(r.outcome).toBe('playing');
    expect(r.player.hp).toBe(100);
    expect(r.enemies).toHaveLength(0);
    expect(r.resources).toBe(150);

    // Configurações persistem entre recarregamentos.
    await page.keyboard.press('Escape');
    await page.click('#btn-pause-options');
    await page.locator('#opt-volume').fill('0.25');
    await page.click('#btn-options-close');
    await page.click('#btn-quit');
    await expect(page.locator('#menu')).toBeVisible();
    await page.reload();
    await expect(page.locator('#menu')).toBeVisible();
    await page.click('#btn-menu-options');
    await expect(page.locator('#opt-volume')).toHaveValue('0.25');
    await page.click('#btn-options-close');
    await expect(page.locator('#menu-best')).toContainText('1 partidas');
  });
});
