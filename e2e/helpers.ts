import { expect, type Page, test } from '@playwright/test';
import type { DebugApi, DebugSnapshot } from '../src/game/debug';

declare global {
  interface Window {
    __destructor?: { scene: string; game: DebugApi | null };
  }
}

export const SAVE_KEY = 'destructor.save.v1';

// Os testes usam teclado e mouse de verdade. A API ?test=1 serve para LER o
// estado (posição, recursos, onda) e, em poucos casos, preparar a cena.

export const snap = (page: Page): Promise<DebugSnapshot> =>
  page.evaluate(() => (window.__destructor?.game as DebugApi).snapshot());
export const cell = (page: Page, x: number, y: number): Promise<string> =>
  page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cell(cx, cy), [x, y]);

export async function clickCell(page: Page, x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const p = await page.evaluate(([cx, cy]) => (window.__destructor?.game as DebugApi).cellToClient(cx, cy), [x, y]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(80);
  await page.mouse.click(p.x, p.y, { button });
  await page.waitForTimeout(80);
}

/** Abre o menu; com `save`, grava antes um salvamento (mesclado ao atual). */
export async function openMenu(page: Page, save?: Record<string, unknown>): Promise<void> {
  await page.goto('/?test=1');
  if (save) {
    // Espera o menu: ao abrir, ele grava as escolhas atuais e apagaria o que for escrito antes.
    await expect(page.locator('#menu')).toBeVisible();
    await page.evaluate(([key, patch]) => {
      const cur = JSON.parse(localStorage.getItem(key) ?? '{"version":1}');
      const settings = { ...(cur.settings ?? {}), ...((patch as { settings?: object }).settings ?? {}) };
      localStorage.setItem(key, JSON.stringify({ ...cur, ...patch, settings }));
    }, [SAVE_KEY, save] as const);
    await page.reload();
  }
  await expect(page.locator('#menu')).toBeVisible();
}

export async function waitForMatch(page: Page): Promise<DebugSnapshot> {
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => window.__destructor?.scene === 'game' && window.__destructor.game?.snapshot().player.onFloor === true);
  return snap(page);
}

export async function startGame(page: Page, save?: Record<string, unknown>): Promise<DebugSnapshot> {
  await openMenu(page, save);
  await page.click('#btn-play');
  return waitForMatch(page);
}

/**
 * Regras comuns a todos os testes: o tutorial da primeira partida fica
 * desligado (salvo quando o teste grava outro salvamento), e nenhum teste
 * pode terminar com erro de JavaScript ou recurso barrado pela CSP.
 */
export function guardPages(): void {
  let pageErrors: string[] = [];
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (/content.security.policy|violates the following/i.test(m.text())) pageErrors.push(`CSP: ${m.text()}`);
    });
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, tutorialDone: true }));
    }, SAVE_KEY);
  });
  test.afterEach(async ({ page }) => {
    await expect(page.locator('#fatal')).toBeHidden();
    expect(pageErrors).toEqual([]);
  });
}
