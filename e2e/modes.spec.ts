import { expect, type Page, test } from '@playwright/test';
import type { DebugApi } from '../src/game/debug';
import { cell, clickCell, guardPages, openMenu, SAVE_KEY, snap, startGame, waitForMatch } from './helpers';

const game = (page: Page) => ({
  spawn: (type: string, tiles: number) => page.evaluate(([t, d]) => (window.__destructor?.game as DebugApi).spawnEnemy(t as never, d as number), [type, tiles] as const),
  damageCell: (x: number, y: number, amount: number) => page.evaluate(([cx, cy, a]) => (window.__destructor?.game as DebugApi).damageCell(cx, cy, a), [x, y, amount] as const),
  cellHp: (x: number, y: number) => page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellHp(cx, cy), [x, y] as const),
  prep: (seconds: number) => page.evaluate((s) => (window.__destructor?.game as DebugApi).setPrepTimer(s), seconds),
  modifier: (id: string | null) => page.evaluate((m) => (window.__destructor?.game as DebugApi).forceModifier(m), id),
});

async function build(page: Page, key: string, x: number, y: number): Promise<void> {
  await page.keyboard.press(key);
  await clickCell(page, x, y);
}

test.describe('modos, fases e conteúdo novo', () => {
  guardPages();

  test('Defender o núcleo: o cristal aparece, tem barra própria e a partida acaba se ele cair', async ({ page }) => {
    await openMenu(page);
    await page.click('[data-mode="core"]');
    await expect(page.locator('#mode-desc')).toContainText('cristal');
    await page.click('#btn-play');
    const s = await waitForMatch(page);
    expect(s.mode).toBe('core');
    expect(s.core).toBe(1);
    await expect(page.locator('#core')).toBeVisible();
    await expect(page.locator('#res-value')).toHaveText('200');
    const [cx, cy] = [s.player.tx - 2, s.player.ty];
    expect(await cell(page, cx, cy)).toBe('core');
    // Os inimigos vão no cristal: aqui o dano é aplicado direto para não depender da IA.
    await game(page).damageCell(cx, cy, 300);
    await expect.poll(async () => (await snap(page)).core).toBeLessThan(0.3);
    await expect(page.locator('#core')).toHaveClass(/danger/);
    await game(page).damageCell(cx, cy, 300);
    await expect(page.locator('#gameover')).toBeVisible();
    await expect(page.locator('#over-title')).toHaveText('Derrota');
    await expect(page.locator('#over-detail')).toContainText('núcleo');
  });

  test('desafio diário: a arena do dia fica travada no menu e vale na partida', async ({ page }) => {
    await openMenu(page);
    await page.click('[data-mode="daily"]');
    await expect(page.locator('#arena-list [data-arena]').first()).toBeDisabled();
    const arena = await page.locator('#arena-list [aria-checked="true"]').getAttribute('data-arena');
    await expect(page.locator('#arena-desc')).toContainText('Arena de hoje');
    await page.click('#btn-play');
    const s = await waitForMatch(page);
    expect(s.mode).toBe('daily');
    expect(s.arena).toBe(arena);
    await expect(page.locator('#banner-sub')).toContainText('Desafio de');
    // Voltando ao menu, a escolha do modo continua salva.
    await page.keyboard.press('Escape');
    await page.click('#btn-quit');
    await expect(page.locator('[data-mode="daily"]')).toHaveAttribute('aria-checked', 'true');
    await page.click('[data-mode="classic"]');
    await expect(page.locator('#arena-list [data-arena]').first()).toBeEnabled();
  });

  test('Só construtor: o herói não ataca e começa com mais materiais', async ({ page }) => {
    await startGame(page, { settings: { mode: 'builder' } });
    await expect(page.locator('#res-value')).toHaveText('320');
    await expect(page.locator('.weapon[data-attack]').first()).toBeHidden();
    await page.keyboard.press('k');
    await page.keyboard.press('j');
    await page.waitForTimeout(200);
    expect((await snap(page)).bullets).toBe(0);
  });

  test('Sandbox: materiais infinitos, sem ondas, e um painel para chamar e limpar inimigos', async ({ page }) => {
    const s = await startGame(page, { settings: { mode: 'sandbox', arena: 'vale' } });
    await expect(page.locator('#wave-title')).toHaveText('Sandbox');
    await expect(page.locator('#btn-start-wave')).toBeHidden();
    await expect(page.locator('#res-value')).toHaveText('9999');
    await page.keyboard.press('b');
    await build(page, '7', s.player.tx + 2, s.player.ty);
    expect(await cell(page, s.player.tx + 2, s.player.ty)).toBe('turret');
    await expect(page.locator('#res-value')).toHaveText('9999');
    await page.keyboard.press('Escape');
    await page.click('[data-spawn="basic"]');
    await page.click('[data-spawn="healer"]');
    await expect.poll(async () => (await snap(page)).enemies.length).toBe(2);
    await expect(page.locator('#wave-sub')).toContainText('2');
    await page.click('[data-spawn="clear"]');
    await expect.poll(async () => (await snap(page)).enemies.length).toBe(0);
    expect((await snap(page)).wave.phase).toBe('preparing');
  });

  test('armadilha de gelo deixa lento e o canhão fere com explosão', async ({ page }) => {
    const s = await startGame(page, { settings: { mode: 'sandbox', arena: 'vale' } });
    const { tx, ty } = s.player;
    await page.keyboard.press('b');
    await build(page, '9', tx + 2, ty);
    await build(page, '8', tx + 3, ty);
    await clickCell(page, tx + 4, ty);       // apertar 8 de novo desmarcaria a peça
    await page.keyboard.press('Escape');
    expect([await cell(page, tx + 2, ty), await cell(page, tx + 3, ty), await cell(page, tx + 4, ty)]).toEqual(['cannon', 'ice_trap', 'ice_trap']);
    expect((await snap(page)).turrets).toBe(1);
    const id = await game(page).spawn('tank', 4);
    let slowed = false;
    await expect.poll(async () => {
      const e = (await snap(page)).enemies.find((en) => en.id === id);
      if (e?.slowed) slowed = true;
      return slowed && (e?.hp ?? 0) < 170;
    }, { timeout: 10_000 }).toBe(true);
  });

  test('Sabotador ignora o herói e vai nas defesas; Curandeiro cura os aliados', async ({ page }) => {
    const s = await startGame(page, { settings: { mode: 'sandbox', arena: 'vale' } });
    const { tx, ty } = s.player;
    await page.keyboard.press('b');
    await build(page, '3', tx - 4, ty);
    await page.keyboard.press('Escape');
    expect(await cell(page, tx - 4, ty)).toBe('defensive_wall');
    // Do outro lado do herói: para chegar à parede, o Sabotador passa por ele.
    await game(page).spawn('saboteur', 6);
    await expect.poll(() => game(page).cellHp(tx - 4, ty), { timeout: 12_000 }).toBeLessThan(130);

    await page.click('[data-spawn="clear"]');
    const tank = await game(page).spawn('tank', 5);
    await game(page).spawn('healer', 9);
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('k'); await page.waitForTimeout(420); }
    const hurt = (await snap(page)).enemies.find((e) => e.id === tank)?.hp ?? 0;
    expect(hurt).toBeLessThan(170);
    await expect.poll(async () => (await snap(page)).enemies.find((e) => e.id === tank)?.hp ?? 0, { timeout: 10_000 }).toBeGreaterThan(hurt);
  });

  test('Ponte: quem cai no abismo some; o herói perde vida e volta ao início', async ({ page }) => {
    const s = await startGame(page, { settings: { arena: 'ponte' } });
    await game(page).prep(300);
    const { tx, ty } = s.player;
    expect(await cell(page, tx + 3, ty + 1)).toBe('bridge');
    for (let x = tx + 2; x <= tx + 4; x++) await game(page).damageCell(x, ty + 1, 999);
    expect(await cell(page, tx + 3, ty + 1)).toBe('empty');
    await game(page).spawn('basic', 5);
    await expect.poll(async () => (await snap(page)).kills, { timeout: 15_000 }).toBe(1);
    const after = await snap(page);
    expect(after.enemies).toHaveLength(0);
    expect(after.pickups).toBe(0);

    await page.keyboard.down('d');
    await expect.poll(async () => (await snap(page)).player.hp, { timeout: 8_000 }).toBeLessThan(100);
    await page.keyboard.up('d');
    const back = await snap(page);
    expect(back.player.hp).toBe(70);
    expect(Math.abs(back.player.tx - tx)).toBeLessThanOrEqual(2);
  });

  test('Noite é escura; neblina e chuva de meteoros mudam a onda', async ({ page }) => {
    await startGame(page, { settings: { arena: 'noite' } });
    await expect.poll(async () => (await snap(page)).darkness).toBeGreaterThan(0.8);

    await page.keyboard.press('Escape');
    await page.click('#btn-quit');
    await page.click('[data-arena="colina"]');
    await page.click('#btn-play');
    await waitForMatch(page);
    expect((await snap(page)).darkness).toBe(0);
    await game(page).modifier('fog');
    await game(page).prep(0.1);
    await expect(page.locator('#banner-sub')).toContainText('Neblina');
    await expect.poll(async () => (await snap(page)).darkness).toBeGreaterThan(0.5);
    await expect(page.locator('#wave-sub')).toContainText('Neblina');

    await page.keyboard.press('Escape');
    await page.click('#btn-restart');
    // A partida antiga estava em combate: esperar o preparo garante que a API já é a da nova.
    await page.waitForFunction(() => window.__destructor?.game?.snapshot().wave.phase === 'preparing');
    await waitForMatch(page);
    await game(page).modifier('meteors');
    await game(page).prep(0.1);
    await expect(page.locator('#wave-sub')).toContainText('Chuva de meteoros');
    await expect.poll(async () => (await snap(page)).meteors, { timeout: 8_000 }).toBeGreaterThan(0);
  });

  test('tutorial: as dicas avançam com o que o jogador faz e podem ser puladas', async ({ page }) => {
    await startGame(page, { tutorialDone: false });
    await expect(page.locator('#tutorial')).toBeVisible();
    await expect(page.locator('#tutorial-text')).toContainText('Dica 1/5');
    await page.keyboard.down('a');
    await expect(page.locator('#tutorial-text')).toContainText('Dica 2/5');
    await page.keyboard.up('a');
    await page.keyboard.press('b');
    await expect(page.locator('#tutorial-text')).toContainText('Dica 3/5');
    await page.click('#btn-tutorial-skip');
    await expect(page.locator('#tutorial')).toBeHidden();
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), SAVE_KEY);
    expect(saved.tutorialDone).toBe(true);
    // Na partida seguinte não há mais dicas.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.click('#btn-restart');
    await waitForMatch(page);
    await expect(page.locator('#tutorial')).toBeHidden();
  });

  test('conquistas: lista no menu e aviso das novas na tela final', async ({ page }) => {
    await openMenu(page, { achievements: ['first_win'] });
    await page.click('#btn-achievements');
    await expect(page.locator('#achievements-count')).toHaveText('1 de 12 conquistas');
    await expect(page.locator('#achievements-list li.done')).toHaveCount(1);
    await page.click('#btn-play');
    await waitForMatch(page);
    await page.evaluate(() => (window.__destructor?.game as DebugApi).forceVictory());
    await expect(page.locator('#gameover')).toBeVisible();
    // Vencer sem torretas rende "Na raça"; "Sobrevivente" já era conhecida e não se repete.
    await expect(page.locator('#over-achievements')).toContainText('Na raça');
    await expect(page.locator('#over-achievements')).not.toContainText('Sobrevivente');
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), SAVE_KEY);
    expect(saved.achievements).toEqual(expect.arrayContaining(['first_win', 'no_turrets']));
  });

  test('controle: começa a partida, move, pula e pausa', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'depende de tempo de resposta: o WebKit headless no Windows roda a ~11 fps');
    // Controle simulado: a página lê navigator.getGamepads() e o teste mexe nos botões.
    await page.addInitScript(() => {
      const pad = {
        id: 'teste', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
    });
    const press = (i: number, down: boolean) => page.evaluate(([b, d]) => {
      (window as unknown as { __pad: { buttons: Array<{ pressed: boolean }> } }).__pad.buttons[b as number].pressed = d as boolean;
    }, [i, down] as const);
    const axis = (v: number) => page.evaluate((x) => { (window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = x; }, v);

    await openMenu(page);
    await page.waitForTimeout(200);
    await press(9, true);
    await page.waitForTimeout(150);
    await press(9, false);
    const s0 = await waitForMatch(page);

    await axis(1);
    await expect.poll(async () => (await snap(page)).player.x).toBeGreaterThan(s0.player.x + 40);
    await axis(0);
    await page.waitForTimeout(300);
    const y0 = (await snap(page)).player.y;
    await press(0, true);
    await expect.poll(async () => (await snap(page)).player.y).toBeLessThan(y0 - 20);
    await press(0, false);

    await press(9, true);
    await expect(page.locator('#pause')).toBeVisible();
    await press(9, false);
    await page.waitForTimeout(150);
    await press(9, true);
    await expect(page.locator('#pause')).toBeHidden();
    await press(9, false);
  });
});
