import { TILE, VIEW_HEIGHT, VIEW_WIDTH, WAVES } from '../../config';
import type { DebugApi, DebugSnapshot } from '../../debug';
import type { Enemy } from '../../entities/Enemy';
import type { WaveSystem } from '../../systems/WaveSystem';
import type { EnemyType, ModifierId } from '../../types/game';
import type { TurretManager } from '../../world/TurretManager';
import type { CombatController } from './CombatController';
import type { GameContext } from './GameContext';
import type { PickupController } from './PickupController';

export interface DebugDeps {
  ctx: GameContext;
  waves: WaveSystem;
  combat: CombatController;
  pickups: PickupController;
  turrets: TurretManager;
  spawnEnemy(type: EnemyType, x: number, y: number): Enemy;
  finishAsVictory(): void;
  forceModifier(id: ModifierId | null): void;
  /** Estado que só a cena conhece (modo, regra da onda, núcleo, escuridão...). */
  extra(): Pick<DebugSnapshot, 'mode' | 'modifier' | 'core' | 'darkness' | 'meteors' | 'tutorial'>;
}

/**
 * API de inspeção usada pelos testes de navegador. No build de produção a
 * constante `__TEST_API__` é false e todo o resto desta função é descartado
 * do pacote.
 */
export function createDebugApi(d: DebugDeps): DebugApi | null {
  if (!__TEST_API__) return null;
  const { ctx, waves } = d;
  const { match, player, scene } = ctx;
  return {
    snapshot: () => {
      const b = player.arcade;
      return {
        time: ctx.now, paused: ctx.paused, outcome: match.outcome, arena: match.level.id,
        player: {
          x: b.center.x, y: b.bottom, hp: match.playerHealth.hp, maxHp: match.playerHealth.max,
          facing: player.facing, onFloor: player.onFloor,
          tx: Math.floor(b.center.x / TILE), ty: Math.floor((b.bottom - 2) / TILE),
        },
        resources: match.resources.value,
        kills: match.kills,
        offers: match.offers.slice(),
        wave: { number: waves.number, completed: waves.completed, phase: waves.phase, remaining: waves.remaining, timer: waves.timer },
        enemies: (ctx.enemies.getChildren() as Enemy[]).map((e) => ({
          id: e.id, type: e.def.type, x: e.x, y: e.y, hp: e.health.hp, maxHp: e.health.max, state: e.ai, slowed: e.slowed,
        })),
        ownedBlocks: match.building.countOwned(),
        turrets: d.turrets.count,
        bullets: d.combat.activeProjectiles,
        pickups: d.pickups.count,
        ...d.extra(),
      };
    },
    cell: (tx, ty) => match.building.get(tx, ty).id,
    cellHp: (tx, ty) => match.building.hpAt(tx, ty),
    cellToClient: (tx, ty) => {
      const cam = scene.cameras.main;
      const rect = scene.game.canvas.getBoundingClientRect();
      return {
        x: rect.left + (((tx + 0.5) * TILE - cam.scrollX) / VIEW_WIDTH) * rect.width,
        y: rect.top + (((ty + 0.5) * TILE - cam.scrollY) / VIEW_HEIGHT) * rect.height,
      };
    },
    spawnEnemy: (type, tiles) => {
      // Em cima do primeiro bloco sólido da coluna, nunca dentro do terreno.
      const x = player.x + tiles * TILE;
      const tx = Math.floor(x / TILE);
      let ty = 0;
      while (ty < match.building.rows && !match.building.blocks('enemy', tx, ty)) ty++;
      return d.spawnEnemy(type, x, ty * TILE - (type === 'boss' ? 60 : type === 'flyer' ? TILE * 4 : 40)).id;
    },
    damageCell: (tx, ty, amount) => { match.building.damage(tx, ty, amount); },
    setPrepTimer: (seconds) => { if (waves.phase === 'preparing') waves.timer = seconds; },
    forceVictory: () => {
      waves.completed = WAVES.total;
      waves.phase = 'victory';
      d.finishAsVictory();
    },
    forceModifier: (id) => d.forceModifier(id as ModifierId | null),
    setResources: (amount) => {
      const r = match.resources;
      if (amount > r.value) r.add(amount - r.value); else r.spend(r.value - amount);
    },
  };
}
