import { PLAYER, START_RESOURCES, UPGRADE_IDS, UPGRADE_OFFERS, UPGRADES, type UpgradeId } from '../config';
import { buildArena } from '../world/LevelBuilder';
import type { ArenaId, LevelData } from '../types/game';
import { BuildingSystem } from './BuildingSystem';
import { Health } from './CombatSystem';
import { ResourceSystem } from './ResourceSystem';

/** Multiplicadores acumulados pelas melhorias compradas na partida. */
export interface MatchMods {
  damage: number;
  /** Multiplica o intervalo entre disparos (menor = mais rápido). */
  shotCooldown: number;
  moveSpeed: number;
  turretDamage: number;
  /** Multiplica a recarga da investida (menor = mais rápida). */
  dashCooldown: number;
}

/**
 * Tudo o que define uma partida, criado do zero a cada início. Reiniciar é
 * simplesmente descartar este objeto e criar outro: nada da partida anterior
 * (construções, materiais, vida, melhorias, contadores) sobrevive.
 */
export interface MatchState {
  level: LevelData;
  resources: ResourceSystem;
  building: BuildingSystem;
  playerHealth: Health;
  mods: MatchMods;
  /** Melhorias à venda no preparo atual. */
  offers: UpgradeId[];
  kills: number;
  blocksPlaced: number;
  outcome: 'playing' | 'victory' | 'defeat';
}

export function createMatch(arena: ArenaId = 'colina'): MatchState {
  const level = buildArena(arena);
  const resources = new ResourceSystem(START_RESOURCES);
  const match: MatchState = {
    level,
    resources,
    building: new BuildingSystem(level, resources),
    playerHealth: new Health(PLAYER.maxHp, PLAYER.invulnerability),
    mods: { damage: 1, shotCooldown: 1, moveSpeed: 1, turretDamage: 1, dashCooldown: 1 },
    offers: [],
    kills: 0,
    blocksPlaced: 0,
    outcome: 'playing',
  };
  rollOffers(match);
  return match;
}

/**
 * Define as melhorias do próximo preparo: a cura, sempre, mais algumas
 * sorteadas entre as demais (sem repetição).
 */
export function rollOffers(match: MatchState, random: () => number = Math.random): void {
  const pool = UPGRADE_IDS.filter((id) => id !== 'heal');
  const picks: UpgradeId[] = ['heal'];
  while (picks.length < UPGRADE_OFFERS + 1 && pool.length) {
    picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  match.offers = picks;
}

/**
 * Compra uma melhoria em oferta. Retorna false (sem cobrar) se ela não está à
 * venda, se falta saldo ou se não faria efeito (curar com a vida cheia).
 */
export function buyUpgrade(match: MatchState, id: UpgradeId): boolean {
  const up = UPGRADES[id];
  if (!match.offers.includes(id) || match.playerHealth.dead) return false;
  if (id === 'heal' && match.playerHealth.hp >= match.playerHealth.max) return false;
  if (!match.resources.spend(up.cost)) return false;
  const m = match.mods;
  switch (id) {
    case 'maxHp': match.playerHealth.raiseMax(up.amount); break;
    case 'heal': match.playerHealth.heal(up.amount); break;
    case 'damage': m.damage += up.amount; break;
    case 'fireRate': m.shotCooldown *= 1 - up.amount; break;
    case 'speed': m.moveSpeed += up.amount; break;
    case 'turret': m.turretDamage += up.amount; break;
    case 'dash': m.dashCooldown *= 1 - up.amount; break;
  }
  // Cada oferta vale uma compra por preparo (a cura pode ser repetida).
  if (id !== 'heal') match.offers = match.offers.filter((o) => o !== id);
  return true;
}
