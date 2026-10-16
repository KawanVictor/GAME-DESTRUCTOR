import { TEST_MODE } from './services';
import type { EnemyType } from './types/game';

/** Retrato do estado da partida, lido pelos testes de navegador. */
export interface DebugSnapshot {
  time: number;
  paused: boolean;
  outcome: string;
  arena: string;
  offers: string[];
  player: { x: number; y: number; hp: number; maxHp: number; facing: number; onFloor: boolean; tx: number; ty: number };
  resources: number;
  kills: number;
  wave: { number: number; completed: number; phase: string; remaining: number; timer: number };
  enemies: Array<{ id: number; type: string; x: number; y: number; hp: number; maxHp: number; state: string; slowed: boolean }>;
  ownedBlocks: number;
  turrets: number;
  bullets: number;
  pickups: number;
  mode: string;
  /** Regra especial da onda atual (ou null). */
  modifier: string | null;
  /** Fração de vida do núcleo, ou null sem núcleo. */
  core: number | null;
  /** Intensidade da escuridão (0 a 1). */
  darkness: number;
  /** Meteoros caindo agora. */
  meteors: number;
  /** Passo do tutorial (-1 = sem tutorial). */
  tutorial: number;
}

export interface DebugApi {
  snapshot(): DebugSnapshot;
  /** Id do bloco na célula. */
  cell(tx: number, ty: number): string;
  /** Resistência atual do bloco na célula. */
  cellHp(tx: number, ty: number): number;
  /** Aplica dano a um bloco (para testar o reparo). */
  damageCell(tx: number, ty: number, amount: number): void;
  /** Centro da célula em coordenadas da página (para cliques). */
  cellToClient(tx: number, ty: number): { x: number; y: number };
  /** Cria um inimigo avulso a `tiles` do herói (não conta para a onda). */
  spawnEnemy(type: EnemyType, tiles: number): number;
  setResources(amount: number): void;
  /** Ajusta a contagem do preparo (para testes longos não serem interrompidos pela onda). */
  setPrepTimer(seconds: number): void;
  /** Encerra a partida como vitória (para testar a tela final e o modo infinito). */
  forceVictory(): void;
  /** Faz a próxima onda vir com esta regra especial (ou sem nenhuma, com null). */
  forceModifier(id: string | null): void;
}

interface DebugRoot {
  scene: string;
  game: DebugApi | null;
}

/**
 * Fora do build de produção, `?test=1` expõe window.__destructor para
 * inspeção. Em produção nada é exposto, com ou sem o parâmetro; a API é
 * recebida como função para nem chegar a ser criada.
 */
export function setDebugScene(scene: string, api: (() => DebugApi | null) | null): void {
  if (!TEST_MODE) return;
  const root: DebugRoot = { scene, game: api ? api() : null };
  (window as unknown as { __destructor: DebugRoot }).__destructor = root;
}
