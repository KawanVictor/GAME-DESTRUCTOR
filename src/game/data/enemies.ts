import type { EnemyDef, EnemyType, WaveDef } from '../types/game';

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  basic: {
    // Rastejador
    type: 'basic', maxHp: 40, speed: 72, damage: 10, attackInterval: 0.9, blockDamage: 9,
    jumpTiles: 1, detectTiles: 9, reward: 8, knockback: 1,
    body: { width: 26, height: 28 }, frame: { width: 44, height: 40 },
  },
  fast: {
    // Corredor
    type: 'fast', maxHp: 22, speed: 158, damage: 6, attackInterval: 0.6, blockDamage: 4,
    jumpTiles: 3, detectTiles: 16, reward: 6, knockback: 1.2,
    body: { width: 26, height: 20 }, frame: { width: 48, height: 32 },
  },
  tank: {
    // Colosso
    type: 'tank', maxHp: 170, speed: 40, damage: 24, attackInterval: 1.3, blockDamage: 40,
    jumpTiles: 1, detectTiles: 11, reward: 25, knockback: 0.25,
    body: { width: 42, height: 52 }, frame: { width: 68, height: 64 },
  },
};

/**
 * Composição da onda n (1, 2, 3...). Começa só com Rastejadores; Corredores
 * entram na onda 2 e Colossos na 4. A partir daí crescem quantidade e ritmo.
 */
export function composeWave(n: number): WaveDef {
  const basics = 2 + n;
  const fasts = n >= 2 ? Math.floor(n * 0.9) : 0;
  const tanks = n >= 4 ? Math.floor((n - 2) / 2) : 0;
  // Intercala os tipos para a onda não vir em blocos previsíveis.
  const enemies: EnemyType[] = [];
  let b = 0;
  let f = 0;
  while (b < basics || f < fasts) {
    if (b < basics) { enemies.push('basic'); b++; }
    if (f < fasts && (enemies.length % 3 === 2 || b >= basics)) { enemies.push('fast'); f++; }
  }
  // Colossos chegam espalhados, do meio para o fim.
  for (let i = 0; i < tanks; i++) {
    const at = Math.min(enemies.length, Math.floor(((i + 1) / (tanks + 1)) * enemies.length) + 1 + i);
    enemies.splice(at, 0, 'tank');
  }
  return {
    number: n,
    enemies,
    spawnInterval: Math.max(0.55, 1.7 - n * 0.11),
    reward: 30 + n * 10,
  };
}
