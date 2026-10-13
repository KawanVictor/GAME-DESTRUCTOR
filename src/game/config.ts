// Parâmetros gerais do jogo. Balanceamento de peças, inimigos e armas fica
// em src/game/data; aqui ficam mundo, física do herói, construção e ondas.

export const TILE = 32;
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
export const WORLD_COLS = 72;
export const WORLD_ROWS = 22;
export const GRAVITY = 1500;

export const PLAYER = {
  maxHp: 100,
  /** Aceleração horizontal no chão e no ar (px/s²). */
  acceleration: 2000,
  airAcceleration: 1400,
  /** Desaceleração ao soltar os controles (px/s²). */
  drag: 1900,
  maxSpeed: 215,
  /** Limite vertical (vale para queda e para o impulso). */
  maxFallSpeed: 900,
  jumpVelocity: 545,
  /** Fração da velocidade mantida ao soltar o pulo cedo (altura variável). */
  jumpCutFactor: 0.45,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  /** Invulnerabilidade após receber dano, em segundos. */
  invulnerability: 0.8,
  hurtLock: 0.22,
  jumpPadVelocity: 880,
  body: { width: 20, height: 34 },
} as const;

export const BUILD = {
  /** Alcance de construção e demolição, em tiles. */
  reach: 6.5,
  /** Fração do custo devolvida na demolição manual (proporcional à resistência restante). */
  refundRatio: 0.5,
  /** Células livres mínimas alcançáveis pelo herói após construir. */
  minFreeCells: 24,
} as const;

export const WAVES = {
  total: 10,
  firstPreparation: 12,
  preparation: 15,
  /** Pausa curta mostrando "onda concluída" antes do preparo seguinte. */
  completedPause: 2.5,
  maxActiveEnemies: 18,
} as const;

export const START_RESOURCES = 150;

export const SPIKES = {
  damage: 14,
  /** Segundos entre danos no mesmo inimigo. */
  interval: 0.5,
  /** Desgaste da armadilha a cada dano causado. */
  wear: 1,
} as const;

export const TURRET = {
  /** Raio de detecção em tiles. */
  range: 7,
  damage: 9,
  fireInterval: 0.7,
  projectileSpeed: 520,
} as const;

export const UPGRADES = {
  maxHp: { cost: 60, amount: 25, label: '+25 vida máxima' },
  damage: { cost: 70, amount: 0.2, label: '+20% de dano' },
  heal: { cost: 30, amount: 40, label: 'Curar 40' },
} as const;

export type UpgradeId = keyof typeof UPGRADES;
