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

/** Mira assistida do disparo: procura um inimigo dentro deste cone à frente do herói. */
export const AIM = {
  coneDegrees: 55,
} as const;

export const DASH = {
  speed: 640,
  /** Duração do avanço, em segundos. */
  duration: 0.16,
  cooldown: 2.2,
  /** Invulnerabilidade concedida ao iniciar a investida. */
  invulnerability: 0.24,
} as const;

export const REPAIR = {
  /** Fração do custo cobrada para restaurar toda a resistência (proporcional ao dano). */
  costRatio: 0.5,
} as const;

/** Golpe de área do chefe ao aterrissar de um salto. */
export const BOSS_SLAM = {
  interval: 4.5,
  windup: 0.6,
  /** Raio do dano ao herói, em tiles. */
  radius: 3,
  damage: 28,
  /** Raio e dano a blocos. */
  blockRadius: 2,
  blockDamage: 70,
  /** O chefe aparece a cada tantas ondas. */
  every: 5,
} as const;

/** Melhorias à venda no preparo. A cada preparo o jogo oferece algumas, sorteadas. */
export const UPGRADES = {
  maxHp: { cost: 60, amount: 25, label: '+25 vida máxima' },
  damage: { cost: 70, amount: 0.2, label: '+20% de dano' },
  heal: { cost: 30, amount: 40, label: 'Curar 40' },
  fireRate: { cost: 60, amount: 0.15, label: 'Disparo 15% mais rápido' },
  speed: { cost: 50, amount: 0.08, label: '+8% de velocidade' },
  turret: { cost: 70, amount: 0.25, label: 'Torretas +25% de dano' },
  dash: { cost: 45, amount: 0.2, label: 'Investida 20% mais rápida' },
} as const;

export type UpgradeId = keyof typeof UPGRADES;
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
/** Quantas melhorias são oferecidas por preparo. */
export const UPGRADE_OFFERS = 3;
