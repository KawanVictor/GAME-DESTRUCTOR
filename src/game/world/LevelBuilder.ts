import { WORLD_COLS, WORLD_ROWS } from '../config';
import { blockById } from '../data/blocks';
import type { BlockId, LevelData } from '../types/game';

/**
 * Monta a arena inicial (dados puros, sem Phaser): chão com degraus,
 * plataformas fixas, caixotes de materiais e um portal inimigo em cada ponta.
 */
export function buildArena(cols = WORLD_COLS, rows = WORLD_ROWS): LevelData {
  const cells = new Uint8Array(cols * rows);
  const set = (x: number, y: number, id: BlockId): void => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) cells[y * cols + x] = blockById(id).index;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, id: BlockId): void => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, id);
  };

  const ground = rows - 4;            // linha do topo do chão
  const mid = Math.floor(cols / 2);
  fill(0, ground, cols - 1, rows - 2, 'terrain');
  fill(0, rows - 1, cols - 1, rows - 1, 'bedrock');

  // Colina central em degraus de 1 tile (todo inimigo consegue subir).
  fill(mid - 5, ground - 1, mid + 4, ground - 1, 'terrain');
  fill(mid - 3, ground - 2, mid + 2, ground - 2, 'terrain');

  // Terraços laterais.
  for (const x0 of [12, cols - 19]) {
    fill(x0, ground - 1, x0 + 6, ground - 1, 'terrain');
  }

  // Plataformas fixas de madeira.
  for (const [x0, y, w] of [[mid - 12, ground - 4, 5], [mid + 7, ground - 4, 5], [mid - 3, ground - 6, 6], [5, ground - 4, 4], [cols - 9, ground - 4, 4]] as Array<[number, number, number]>) {
    fill(x0, y, x0 + w - 1, y, 'wood_platform');
  }

  // Caixotes: materiais para quem for buscar.
  for (const [x, y] of [[mid - 10, ground - 5], [mid + 9, ground - 5], [mid, ground - 7], [6, ground - 5], [cols - 8, ground - 5], [14, ground - 2], [cols - 15, ground - 2], [mid - 14, ground - 1], [mid + 13, ground - 1]] as Array<[number, number]>) {
    set(x, y, 'crate');
  }

  const enemySpawns = [{ x: 2, y: ground - 1 }, { x: cols - 3, y: ground - 1 }];
  return {
    cols,
    rows,
    cells,
    playerSpawn: { x: mid, y: ground - 3 },
    enemySpawns,
    protectedZones: enemySpawns.map((s) => ({ x: s.x, y: s.y, radius: 2 })),
  };
}
