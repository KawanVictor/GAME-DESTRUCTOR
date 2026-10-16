import { TILE } from '../../config';
import { Enemy, type EnemyWorld } from '../../entities/Enemy';
import type { EnemyType } from '../../types/game';
import type { CombatController } from './CombatController';
import type { GameContext } from './GameContext';

/**
 * Inimigos em campo: surgimento nos portais, IA a cada quadro (com o que ela
 * precisa saber do mundo: herói, núcleo, peças a sabotar, aliados a curar),
 * armadilhas de chão e quedas no abismo.
 */
export class EnemyController {
  readonly spawnPoints: ReadonlyArray<{ x: number; y: number }>;
  private spawnSide = 0;
  /** Peças do jogador que o Sabotador procura (centros em px); refeito quando a grade muda. */
  private sabotageCells: Array<{ x: number; y: number }> | null = null;

  constructor(private readonly ctx: GameContext, private readonly combat: CombatController) {
    this.spawnPoints = ctx.match.level.enemySpawns.map((s) => ({ x: s.x * TILE + TILE / 2, y: (s.y + 1) * TILE - 24 }));
    ctx.match.building.on(() => { this.sabotageCells = null; });
  }

  get count(): number {
    return this.ctx.enemies.getLength();
  }

  spawn(type: EnemyType, x: number, y: number, hpScale = 1, speedScale = 1): Enemy {
    const e = new Enemy(this.ctx.scene, x, y, type, hpScale, speedScale);
    this.ctx.enemies.add(e);
    this.ctx.fx.flash(x, y, 0xb48cff, 1.1, 260);
    return e;
  }

  /** Surge em um portal, alternando entre as pontas. */
  spawnAtPortal(type: EnemyType, hpScale = 1, speedScale = 1): Enemy {
    const p = this.spawnPoints[this.spawnSide++ % this.spawnPoints.length];
    // Grandes nascem mais alto para não ficar dentro do chão; voadores, no ar.
    const lift = type === 'boss' ? 30 : type === 'tank' ? 16 : type === 'flyer' ? TILE * 4 : 0;
    return this.spawn(type, p.x, p.y - lift, hpScale, speedScale);
  }

  /** IA, armadilhas e abismo. Devolve o chefe em campo, se houver. */
  update(now: number, dt: number): Enemy | null {
    const { player, match } = this.ctx;
    const pb = player.arcade;
    const c = match.core;
    const world: EnemyWorld = {
      now, building: match.building,
      target: { x: pb.center.x, y: pb.center.y, bottom: pb.bottom, alive: !match.playerHealth.dead },
      spawnPoints: this.spawnPoints,
      objective: c ? { x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE, bottom: (c.y + 1) * TILE } : null,
      sabotageTarget: (x, y) => this.sabotageTarget(x, y),
      healAround: (healer, radius, amount) => this.healAround(healer, radius, amount),
      hitBlock: (x, y, dmg) => this.combat.enemyHitsBlock(x, y, dmg),
      shoot: (e, x, y, tx, ty) => this.combat.enemyShoot(e, x, y, tx, ty),
      slam: (e) => this.combat.bossSlam(e),
      onRecovered: (e) => this.ctx.fx.flash(e.x, e.y, 0xb48cff, 1.2),
    };
    const abyss = match.level.abyss ? this.ctx.scene.physics.world.bounds.bottom + TILE : Infinity;
    let boss: Enemy | null = null;
    for (const e of (this.ctx.enemies.getChildren() as Enemy[]).slice()) {
      e.tick(dt, world);
      if (!e.alive) continue;
      if (e.arcade.top > abyss) { this.combat.fallIntoAbyss(e); continue; }
      if (e.def.behavior !== 'flyer') this.combat.applyFloorTraps(e, now);
      if (e.alive && e.def.behavior === 'boss') boss = e;
    }
    return boss;
  }

  /** Sabotador: a peça de defesa mais próxima (subir custa mais que andar). */
  private sabotageTarget(fromX: number, fromY: number): { x: number; y: number } | null {
    this.sabotageCells ??= this.ctx.match.building
      .ownedCells((d) => !d.core && (d.trap !== undefined || d.collision === 'enemy_only'))
      .map((c) => ({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE }));
    let best: { x: number; y: number } | null = null;
    let bestCost = Infinity;
    for (const c of this.sabotageCells) {
      const cost = Math.abs(c.x - fromX) + Math.abs(c.y - fromY) * 3;
      if (cost < bestCost) { best = c; bestCost = cost; }
    }
    return best;
  }

  /** Curandeiro: cura os aliados no raio (menos o chefe). Devolve quantos foram curados. */
  private healAround(healer: Enemy, radius: number, amount: number): number {
    const { fx } = this.ctx;
    let healed = 0;
    for (const e of this.ctx.enemies.getChildren() as Enemy[]) {
      // O Titã não é curado: a luta contra o chefe não pode virar uma maratona.
      if (e === healer || !e.alive || e.def.behavior === 'boss' || Math.hypot(e.x - healer.x, e.y - healer.y) > radius) continue;
      const got = e.heal(amount);
      if (got <= 0) continue;
      healed++;
      fx.number(e.x, e.arcade.y - 6, `+${Math.round(got)}`, '#4ee3a4');
      fx.spark(e.x, e.arcade.center.y, 0x4ee3a4, 6);
    }
    if (healed > 0) fx.flash(healer.x, healer.arcade.center.y, 0x4ee3a4, radius / 40, 260);
    return healed;
  }
}
