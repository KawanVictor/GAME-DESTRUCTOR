import { BOSS_SLAM } from '../config';
import type { EnemyDef, EnemyType, ModifierId, WaveDef } from '../types/game';

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  // Rastejador: patrulha e persegue.
  basic: {
    type: 'basic', behavior: 'ground', maxHp: 40, speed: 72, damage: 10, attackInterval: 0.9, blockDamage: 13,
    jumpTiles: 1, detectTiles: 9, reward: 8, knockback: 1,
    body: { width: 26, height: 28 }, frame: { width: 44, height: 40 },
  },
  // Corredor: rápido, frágil, salta obstáculos.
  fast: {
    type: 'fast', behavior: 'ground', maxHp: 24, speed: 158, damage: 8, attackInterval: 0.6, blockDamage: 4,
    jumpTiles: 3, detectTiles: 16, reward: 6, knockback: 1.2,
    body: { width: 26, height: 20 }, frame: { width: 48, height: 32 },
  },
  // Colosso: lento, resistente, derruba estruturas.
  tank: {
    type: 'tank', behavior: 'ground', maxHp: 170, speed: 40, damage: 24, attackInterval: 1.3, blockDamage: 40,
    jumpTiles: 1, detectTiles: 11, reward: 25, knockback: 0.25,
    body: { width: 42, height: 52 }, frame: { width: 68, height: 64 },
  },
  // Vespa: voa por cima de paredes e mergulha no herói. Pede torretas ou tiro.
  flyer: {
    type: 'flyer', behavior: 'flyer', maxHp: 18, speed: 120, damage: 8, attackInterval: 1.0, blockDamage: 0,
    jumpTiles: 0, detectTiles: 99, reward: 7, knockback: 1.3,
    body: { width: 24, height: 18 }, frame: { width: 48, height: 34 },
  },
  // Cuspidor: mantém distância e atira. Paredes e blocos servem de cobertura.
  spitter: {
    type: 'spitter', behavior: 'ranged', maxHp: 32, speed: 62, damage: 8, attackInterval: 1.0, blockDamage: 6,
    jumpTiles: 1, detectTiles: 14, reward: 12, knockback: 1,
    body: { width: 26, height: 30 }, frame: { width: 46, height: 44 },
    ranged: { damage: 9, speed: 300, interval: 2.2, rangeTiles: 9, keepTiles: 5 },
  },
  // Sabotador: ignora o herói e vai direto nas suas torretas e defesas.
  saboteur: {
    type: 'saboteur', behavior: 'saboteur', maxHp: 30, speed: 118, damage: 6, attackInterval: 0.7, blockDamage: 18,
    jumpTiles: 2, detectTiles: 99, reward: 12, knockback: 1.1,
    body: { width: 24, height: 26 }, frame: { width: 44, height: 38 },
  },
  // Curandeiro: fica para trás e cura os aliados. Derrube-o primeiro.
  healer: {
    type: 'healer', behavior: 'healer', maxHp: 36, speed: 58, damage: 4, attackInterval: 1.2, blockDamage: 3,
    jumpTiles: 1, detectTiles: 99, reward: 14, knockback: 1,
    body: { width: 26, height: 34 }, frame: { width: 44, height: 48 },
    heal: { amount: 14, radiusTiles: 3.5, interval: 2.4, keepTiles: 6 },
  },
  // Titã: chefe. Arrebenta estruturas e salta sobre o herói com um golpe de área.
  boss: {
    type: 'boss', behavior: 'boss', maxHp: 520, speed: 46, damage: 20, attackInterval: 1.4, blockDamage: 60,
    jumpTiles: 2, detectTiles: 99, reward: 90, knockback: 0,
    body: { width: 60, height: 76 }, frame: { width: 100, height: 92 },
  },
};

export const ENEMY_NAMES: Record<EnemyType, string> = {
  basic: 'Rastejador', fast: 'Corredor', tank: 'Colosso', flyer: 'Vespa', spitter: 'Cuspidor', boss: 'Titã',
  saboteur: 'Sabotador', healer: 'Curandeiro',
};

/** Em que onda cada tipo estreia. */
export const FIRST_WAVE: Record<EnemyType, number> = {
  basic: 1, fast: 2, flyer: 3, tank: 4, saboteur: 4, spitter: 5, healer: 6, boss: BOSS_SLAM.every,
};

type Escort = Exclude<EnemyType, 'boss'>;

/**
 * Composição da onda n (1, 2, 3...). Cada tipo estreia em uma onda e depois
 * cresce em quantidade; a cada 5 ondas vem o chefe, com escolta reduzida.
 * Uma regra especial (modificador) pode mudar vida, velocidade, quantidade e recompensa.
 */
export function composeWave(n: number, modifier: ModifierId | null = null): WaveDef {
  const boss = n % BOSS_SLAM.every === 0;
  const escort = boss ? 0.55 : 1;
  // Depois da estreia, cada tipo aparece ao menos uma vez por onda.
  const amount = (type: Escort, base: number): number => (n >= FIRST_WAVE[type] ? Math.max(1, Math.floor(base * escort)) : 0);
  const left: Record<Escort, number> = {
    basic: amount('basic', 1.6 + n * 1.4 + (modifier === 'bounty' ? 3 : 0)),
    fast: amount('fast', n),
    flyer: amount('flyer', (n - 1) / 2),
    tank: amount('tank', (n - 2) / 2),
    spitter: amount('spitter', (n - 3) / 2),
    // Sabotador e Curandeiro não escoltam o chefe: as ondas de chefe seguem como eram.
    saboteur: boss ? 0 : amount('saboteur', (n - 2) / 4),
    healer: boss ? 0 : amount('healer', (n - 4) / 4),
  };
  // Intercala os tipos (rodízio) para a onda não vir em blocos previsíveis.
  const order: Escort[] = ['basic', 'fast', 'basic', 'flyer', 'saboteur', 'spitter', 'healer', 'tank'];
  const enemies: EnemyType[] = [];
  let remaining = Object.values(left).reduce((a, b) => a + b, 0);
  for (let i = 0; remaining > 0; i++) {
    const type = order[i % order.length];
    if (left[type] <= 0) continue;
    enemies.push(type);
    left[type]--;
    remaining--;
  }
  if (boss) enemies.splice(Math.min(2, enemies.length), 0, 'boss');
  return {
    number: n,
    enemies,
    spawnInterval: Math.max(0.6, 1.8 - n * 0.1),
    reward: (25 + n * 6 + (boss ? 40 : 0)) * (modifier === 'bounty' ? 2 : 1),
    boss,
    // A vida dos inimigos sobe devagar a cada onda.
    hpScale: (1 + (n - 1) * 0.05) * (modifier === 'armored' ? 1.35 : 1),
    speedScale: modifier === 'haste' ? 1.3 : 1,
    modifier,
  };
}
