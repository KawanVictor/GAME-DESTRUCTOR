import { WORLD_COLS, WORLD_ROWS } from '../config';
import { blockById } from '../data/blocks';
import type { ArenaId, BlockId, GridPos, LevelData } from '../types/game';

export const ARENAS: Record<ArenaId, { name: string; description: string }> = {
  colina: { name: 'Colina', description: 'Uma elevação central fácil de fortificar.' },
  vale: { name: 'Vale', description: 'Você começa embaixo; os inimigos descem dos dois lados.' },
  planalto: { name: 'Planalto', description: 'Terreno aberto e largo, com um platô comprido.' },
  ponte: { name: 'Ponte', description: 'Uma ponte de tábuas sobre o abismo. Quebre as tábuas e derrube os inimigos.' },
  noite: { name: 'Noite', description: 'Escuridão total: só se enxerga perto do herói, das defesas e dos portais.' },
};

/** Pequeno ajudante para desenhar a grade de uma arena. */
class Grid {
  readonly cells: Uint8Array;
  /** Linha do topo do chão. */
  readonly ground: number;
  readonly mid: number;

  constructor(readonly cols: number, readonly rows: number) {
    this.cells = new Uint8Array(cols * rows);
    this.ground = rows - 4;
    this.mid = Math.floor(cols / 2);
    this.fill(0, this.ground, cols - 1, rows - 2, 'terrain');
    this.fill(0, rows - 1, cols - 1, rows - 1, 'bedrock');
  }

  set(x: number, y: number, id: BlockId): void {
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.cells[y * this.cols + x] = blockById(id).index;
  }

  fill(x0: number, y0: number, x1: number, y1: number, id: BlockId): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, id);
  }

  /** Eleva o terreno das colunas x0..x1 até a linha `top` (inclusive). */
  raise(x0: number, x1: number, top: number): void {
    this.fill(x0, top, x1, this.ground - 1, 'terrain');
  }

  platform(x0: number, y: number, width: number): void {
    this.fill(x0, y, x0 + width - 1, y, 'wood_platform');
  }

  crates(list: Array<[number, number]>): void {
    for (const [x, y] of list) this.set(x, y, 'crate');
  }
}

type Layout = (g: Grid) => { playerSpawn: GridPos; enemySpawns: GridPos[]; abyss?: boolean; dark?: boolean };

// Regra de todas as arenas: degraus de no máximo 1 tile entre colunas
// vizinhas, para qualquer inimigo terrestre conseguir chegar ao herói.
const LAYOUTS: Partial<Record<ArenaId, Layout>> = {
  colina(g) {
    const { mid, ground, cols } = g;
    g.raise(mid - 5, mid + 4, ground - 1);
    g.raise(mid - 3, mid + 2, ground - 2);
    for (const x0 of [12, cols - 19]) g.raise(x0, x0 + 6, ground - 1);
    g.platform(mid - 12, ground - 4, 5); g.platform(mid + 7, ground - 4, 5); g.platform(mid - 3, ground - 6, 6);
    g.platform(5, ground - 4, 4); g.platform(cols - 9, ground - 4, 4);
    g.crates([[mid - 10, ground - 5], [mid + 9, ground - 5], [mid, ground - 7], [6, ground - 5], [cols - 8, ground - 5],
      [14, ground - 2], [cols - 15, ground - 2], [mid - 14, ground - 1], [mid + 13, ground - 1]]);
    return {
      playerSpawn: { x: mid, y: ground - 3 },
      enemySpawns: [{ x: 2, y: ground - 1 }, { x: cols - 3, y: ground - 1 }],
    };
  },

  vale(g) {
    const { mid, ground, cols } = g;
    // Encostas em degraus descendo para o centro, espelhadas.
    const steps: Array<[number, number, number]> = [[0, 13, 3], [14, 17, 2], [18, 21, 1]];
    for (const [a, b, h] of steps) {
      g.raise(a, b, ground - h);
      g.raise(cols - 1 - b, cols - 1 - a, ground - h);
    }
    g.platform(mid - 9, ground - 3, 4); g.platform(mid + 5, ground - 3, 4); g.platform(mid - 3, ground - 5, 6);
    g.platform(6, ground - 6, 4); g.platform(cols - 10, ground - 6, 4);
    g.crates([[mid - 8, ground - 4], [mid + 7, ground - 4], [mid, ground - 6], [7, ground - 7], [cols - 8, ground - 7],
      [mid - 6, ground - 1], [mid + 5, ground - 1], [10, ground - 4], [cols - 11, ground - 4]]);
    return {
      playerSpawn: { x: mid, y: ground - 1 },
      enemySpawns: [{ x: 2, y: ground - 4 }, { x: cols - 3, y: ground - 4 }],
    };
  },

  planalto(g) {
    const { mid, ground, cols } = g;
    g.raise(mid - 13, mid + 12, ground - 1);
    g.raise(mid - 11, mid + 10, ground - 2);
    g.platform(mid - 8, ground - 5, 5); g.platform(mid + 3, ground - 5, 5); g.platform(mid - 2, ground - 8, 4);
    g.platform(7, ground - 3, 5); g.platform(cols - 12, ground - 3, 5);
    g.platform(15, ground - 5, 4); g.platform(cols - 19, ground - 5, 4);
    g.crates([[mid - 6, ground - 6], [mid + 5, ground - 6], [mid, ground - 9], [9, ground - 4], [cols - 10, ground - 4],
      [16, ground - 6], [cols - 17, ground - 6], [mid - 9, ground - 3], [mid + 8, ground - 3], [20, ground - 1], [cols - 21, ground - 1]]);
    return {
      playerSpawn: { x: mid, y: ground - 3 },
      enemySpawns: [{ x: 2, y: ground - 1 }, { x: cols - 3, y: ground - 1 }],
    };
  },
};

/** Arenas com regra própria (abismo, escuridão) ficam no fim da lista. */
Object.assign(LAYOUTS, {
  ponte(g: Grid) {
    const { mid, ground, cols, rows } = g;
    // Abismo no meio: sem chão nem rocha-mãe até o fundo do mapa.
    const a0 = mid - 15;
    const a1 = mid + 14;
    g.fill(a0, ground, a1, rows - 1, 'empty');
    // A ponte de tábuas, no nível do chão, liga os dois lados.
    g.fill(a0, ground, a1, ground, 'bridge');
    g.platform(mid - 10, ground - 4, 5); g.platform(mid + 6, ground - 4, 5); g.platform(mid - 2, ground - 6, 4);
    g.platform(6, ground - 4, 4); g.platform(cols - 10, ground - 4, 4);
    g.crates([[mid - 8, ground - 5], [mid + 8, ground - 5], [mid, ground - 7], [8, ground - 1], [cols - 9, ground - 1]]);
    return {
      playerSpawn: { x: mid, y: ground - 1 },
      enemySpawns: [{ x: 2, y: ground - 1 }, { x: cols - 3, y: ground - 1 }],
      abyss: true,
    };
  },

  noite(g: Grid) {
    const { mid, ground, cols } = g;
    g.raise(mid - 8, mid + 7, ground - 1);
    g.raise(9, 16, ground - 1);
    g.raise(cols - 17, cols - 10, ground - 1);
    g.platform(mid - 4, ground - 5, 8); g.platform(18, ground - 4, 5); g.platform(cols - 23, ground - 4, 5);
    g.platform(4, ground - 4, 4); g.platform(cols - 8, ground - 4, 4);
    g.crates([[mid - 3, ground - 6], [mid + 2, ground - 6], [20, ground - 5], [cols - 21, ground - 5], [12, ground - 2], [cols - 13, ground - 2]]);
    return {
      playerSpawn: { x: mid, y: ground - 2 },
      enemySpawns: [{ x: 2, y: ground - 1 }, { x: cols - 3, y: ground - 1 }],
      dark: true,
    };
  },
} satisfies Partial<Record<ArenaId, Layout>>);

/** Monta uma arena (dados puros, sem Phaser), com um portal inimigo em cada ponta. */
export function buildArena(id: ArenaId = 'colina', cols = WORLD_COLS, rows = WORLD_ROWS): LevelData {
  const grid = new Grid(cols, rows);
  const { playerSpawn, enemySpawns, abyss = false, dark = false } = (LAYOUTS as Record<ArenaId, Layout>)[id](grid);
  return {
    id,
    name: ARENAS[id].name,
    cols,
    rows,
    cells: grid.cells,
    playerSpawn,
    enemySpawns,
    protectedZones: enemySpawns.map((s) => ({ x: s.x, y: s.y, radius: 2 })),
    // O núcleo fica dois tiles à esquerda de onde o herói começa, no mesmo nível.
    coreSpot: { x: playerSpawn.x - 2, y: playerSpawn.y },
    abyss,
    dark,
  };
}
