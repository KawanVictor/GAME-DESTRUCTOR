// Tipos compartilhados entre dados, sistemas, entidades e interface.

export type BlockId =
  | 'empty'
  | 'terrain'
  | 'bedrock'
  | 'crate'
  | 'wood_platform'
  | 'stone_block'
  | 'defensive_wall'
  | 'explosive_block'
  | 'jump_pad'
  | 'spike_trap'
  | 'turret';

/**
 * Como a peça colide:
 * - solid: bloqueia todos;
 * - oneway: só segura quem vem de cima;
 * - enemy_only: bloqueia inimigos, mas o herói e seus tiros atravessam;
 * - none: não colide (ex.: espinhos).
 */
export type CollisionKind = 'none' | 'solid' | 'oneway' | 'enemy_only';

export interface ExplosiveDef {
  /** Raio em tiles. */
  radius: number;
  /** Dano máximo a personagens (cai com a distância). */
  damage: number;
  /** Dano máximo a blocos. */
  blockDamage: number;
}

export interface BlockDef {
  id: BlockId;
  /** Índice numérico na grade e no tileset (0 = vazio). */
  index: number;
  name: string;
  description: string;
  cost: number;
  /** Infinity = indestrutível. */
  maxHp: number;
  collision: CollisionKind;
  /** Aparece no menu de construção. */
  buildable: boolean;
  /** Precisa de um bloco sólido logo abaixo. */
  requiresFloor?: boolean;
  explosive?: ExplosiveDef;
  trap?: 'spikes' | 'turret';
  /** Materiais soltos ao ser destruído (ex.: caixotes do cenário). */
  drops?: number;
}

export type EnemyType = 'basic' | 'fast' | 'tank';

export interface EnemyDef {
  type: EnemyType;
  maxHp: number;
  speed: number;
  /** Dano por golpe no herói. */
  damage: number;
  /** Segundos entre golpes. */
  attackInterval: number;
  /** Dano por golpe em blocos. */
  blockDamage: number;
  /** Altura (em tiles) que consegue pular. */
  jumpTiles: number;
  /** Distância (em tiles) em que percebe o herói. */
  detectTiles: number;
  /** Materiais que solta ao morrer. */
  reward: number;
  body: { width: number; height: number };
  frame: { width: number; height: number };
  /** Resistência a empurrões (0 = imóvel, 1 = normal). */
  knockback: number;
}

export interface MeleeWeaponDef {
  damage: number;
  /** Alcance horizontal em px. */
  range: number;
  height: number;
  cooldown: number;
  /** Tempo em que o golpe fica ativo, em segundos. */
  activeTime: number;
  knockback: number;
  blockDamage: number;
}

export interface RangedWeaponDef {
  damage: number;
  speed: number;
  /** Alcance em px; o projétil some ao percorrê-lo. */
  range: number;
  cooldown: number;
  blockDamage: number;
}

export interface GridPos {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BuildFailure =
  | 'out_of_bounds'
  | 'not_buildable'
  | 'occupied'
  | 'insufficient_resources'
  | 'needs_support'
  | 'needs_floor'
  | 'entity_in_way'
  | 'out_of_reach'
  | 'would_trap_player'
  | 'protected_zone'
  | 'nothing_to_remove'
  | 'not_owned';

export interface BuildCheck {
  ok: boolean;
  cost: number;
  reason?: BuildFailure;
}

export interface RemoveResult {
  ok: boolean;
  refund: number;
  reason?: BuildFailure;
}

/** Posições das entidades no momento da tentativa de construção. */
export interface BuildContext {
  player: Rect;
  enemies: Rect[];
}

export type BuildEvent =
  | { type: 'placed'; x: number; y: number; block: BlockDef }
  | { type: 'removed'; x: number; y: number; block: BlockDef; refund: number }
  | { type: 'damaged'; x: number; y: number; block: BlockDef; hp: number }
  | { type: 'destroyed'; x: number; y: number; block: BlockDef }
  | { type: 'explosion'; x: number; y: number; block: BlockDef; explosive: ExplosiveDef };

export type WavePhase = 'preparing' | 'fighting' | 'completed' | 'victory';

export interface WaveDef {
  number: number;
  enemies: EnemyType[];
  /** Segundos entre surgimentos. */
  spawnInterval: number;
  /** Materiais pagos ao concluir. */
  reward: number;
}

export type Action =
  | 'left'
  | 'right'
  | 'down'
  | 'jump'
  | 'melee'
  | 'shoot'
  | 'build'
  | 'demolish'
  | 'startWave';

export interface Settings {
  volume: number;
  muted: boolean;
  /** Nomes de tecla do Phaser (ex.: 'A', 'LEFT', 'SPACE'). Remapeável. */
  bindings: Record<Action, string[]>;
}

export interface Stats {
  kills: number;
  games: number;
  blocksPlaced: number;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  bestWave: number;
  stats: Stats;
}

export interface LevelData {
  cols: number;
  rows: number;
  /** Índices de bloco, linha a linha. */
  cells: Uint8Array;
  playerSpawn: GridPos;
  enemySpawns: GridPos[];
  /** Áreas onde não se pode construir (portais de inimigos). */
  protectedZones: Array<GridPos & { radius: number }>;
}
