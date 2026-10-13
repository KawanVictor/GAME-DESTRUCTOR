import { TILE } from '../src/game/config';
import { blockById } from '../src/game/data/blocks';
import { BuildingSystem } from '../src/game/systems/BuildingSystem';
import { ResourceSystem } from '../src/game/systems/ResourceSystem';
import type { BlockId, BuildContext, BuildEvent, LevelData } from '../src/game/types/game';

/** Arena mínima: 20×12, chão nas duas últimas linhas, herói no meio. */
export function makeWorld(resourcesAmount = 200, extra: Array<[number, number, BlockId]> = []) {
  const cols = 20;
  const rows = 12;
  const cells = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) {
    cells[10 * cols + x] = blockById('terrain').index;
    cells[11 * cols + x] = blockById('bedrock').index;
  }
  for (const [x, y, id] of extra) cells[y * cols + x] = blockById(id).index;
  const level: LevelData = {
    id: 'colina', name: 'Teste', cols, rows, cells,
    playerSpawn: { x: 10, y: 9 },
    enemySpawns: [{ x: 1, y: 9 }],
    protectedZones: [{ x: 1, y: 9, radius: 1 }],
  };
  const resources = new ResourceSystem(resourcesAmount);
  const building = new BuildingSystem(level, resources);
  const events: BuildEvent[] = [];
  building.on((e) => events.push(e));
  return { building, resources, events, ctx: ctxAt(10, 9) };
}

/** Contexto com o herói em pé na célula (tx, ty) e, opcionalmente, inimigos. */
export function ctxAt(tx: number, ty: number, enemies: Array<[number, number]> = []): BuildContext {
  return {
    player: { x: tx * TILE + 6, y: ty * TILE - 2, width: 20, height: 34 },
    enemies: enemies.map(([x, y]) => ({ x: x * TILE + 3, y: y * TILE + 4, width: 26, height: 28 })),
  };
}

export class MemoryStorage {
  private map = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.map.has(key) ? (this.map.get(key) as string) : null; }
  setItem(key: string, value: string): void { if (this.failWrites) throw new Error('quota'); this.map.set(key, value); }
}
