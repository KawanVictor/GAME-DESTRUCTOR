import { PLAYER, START_RESOURCES, UPGRADES, type UpgradeId } from '../config';
import { buildArena } from '../world/LevelBuilder';
import type { LevelData } from '../types/game';
import { BuildingSystem } from './BuildingSystem';
import { Health } from './CombatSystem';
import { ResourceSystem } from './ResourceSystem';

/**
 * Tudo o que define uma partida, criado do zero a cada início. Reiniciar é
 * simplesmente descartar este objeto e criar outro: nada da partida anterior
 * (construções, materiais, vida, contadores) sobrevive.
 */
export interface MatchState {
  level: LevelData;
  resources: ResourceSystem;
  building: BuildingSystem;
  playerHealth: Health;
  damageMultiplier: number;
  kills: number;
  blocksPlaced: number;
  outcome: 'playing' | 'victory' | 'defeat';
}

export function createMatch(): MatchState {
  const level = buildArena();
  const resources = new ResourceSystem(START_RESOURCES);
  return {
    level,
    resources,
    building: new BuildingSystem(level, resources),
    playerHealth: new Health(PLAYER.maxHp, PLAYER.invulnerability),
    damageMultiplier: 1,
    kills: 0,
    blocksPlaced: 0,
    outcome: 'playing',
  };
}

/** Compra uma melhoria com materiais. Retorna false se não houver saldo ou não fizer sentido. */
export function buyUpgrade(match: MatchState, id: UpgradeId): boolean {
  const up = UPGRADES[id];
  if (id === 'heal' && match.playerHealth.hp >= match.playerHealth.max) return false;
  if (match.playerHealth.dead || !match.resources.spend(up.cost)) return false;
  if (id === 'maxHp') match.playerHealth.raiseMax(up.amount);
  else if (id === 'damage') match.damageMultiplier += up.amount;
  else match.playerHealth.heal(up.amount);
  return true;
}
