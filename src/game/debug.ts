import { TEST_MODE } from './services';
import type { EnemyType } from './types/game';

/** Retrato do estado da partida, lido pelos testes de navegador. */
export interface DebugSnapshot {
  time: number;
  paused: boolean;
  outcome: string;
  player: { x: number; y: number; hp: number; maxHp: number; facing: number; onFloor: boolean; tx: number; ty: number };
  resources: number;
  kills: number;
  wave: { number: number; completed: number; phase: string; remaining: number; timer: number };
  enemies: Array<{ id: number; type: string; x: number; y: number; hp: number; state: string }>;
  ownedBlocks: number;
  turrets: number;
  bullets: number;
  pickups: number;
}

export interface DebugApi {
  snapshot(): DebugSnapshot;
  /** Id do bloco na célula. */
  cell(tx: number, ty: number): string;
  /** Centro da célula em coordenadas da página (para cliques). */
  cellToClient(tx: number, ty: number): { x: number; y: number };
  /** Cria um inimigo avulso a `tiles` do herói (não conta para a onda). */
  spawnEnemy(type: EnemyType, tiles: number): number;
  setResources(amount: number): void;
  /** Ajusta a contagem do preparo (para testes longos não serem interrompidos pela onda). */
  setPrepTimer(seconds: number): void;
  /** Encerra a partida como vitória (para testar a tela final e o modo infinito). */
  forceVictory(): void;
}

interface DebugRoot {
  scene: string;
  game: DebugApi | null;
}

/**
 * Com `?test=1`, expõe window.__destructor para inspeção. Sem o parâmetro
 * nada é exposto.
 */
export function setDebugScene(scene: string, api: DebugApi | null): void {
  if (!TEST_MODE) return;
  const root: DebugRoot = { scene, game: api };
  (window as unknown as { __destructor: DebugRoot }).__destructor = root;
}
