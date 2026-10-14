import type Phaser from 'phaser';
import { AIM, BOSS_SLAM, SPIKES, TILE } from '../../config';
import { MELEE, RANGED } from '../../data/weapons';
import type { Enemy } from '../../entities/Enemy';
import { Projectile } from '../../entities/Projectile';
import { audio } from '../../services';
import { overlaps } from '../../systems/BuildingSystem';
import { explosionDamage, pickAimTarget } from '../../systems/CombatSystem';
import type { ExplosiveDef } from '../../types/game';
import { SpikeTimer } from '../../world/Trap';
import type { GameContext } from './GameContext';
import type { PickupController } from './PickupController';

/** Dano que um disparo inimigo causa ao bloco que o detém. */
const ENEMY_SHOT_BLOCK_DAMAGE = 5;

export interface CombatEvents {
  /** Um inimigo morreu (já fora do grupo de vivos). */
  onEnemyKilled(enemy: Enemy): void;
  onPlayerDead(): void;
}

/**
 * Tudo o que fere alguém: golpes, disparos (do herói, das torretas e dos
 * inimigos), espinhos, explosões e o golpe do chefe. Aplica o dano pelas
 * regras de CombatSystem e cuida dos efeitos e dos projéteis.
 */
export class CombatController {
  readonly bullets: Phaser.Physics.Arcade.Group;
  readonly turretBullets: Phaser.Physics.Arcade.Group;
  readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly spikeTimer = new SpikeTimer();

  constructor(
    private readonly ctx: GameContext,
    private readonly pickups: PickupController,
    private readonly events: CombatEvents,
  ) {
    const pool = (maxSize: number): Phaser.Physics.Arcade.Group =>
      ctx.scene.physics.add.group({ classType: Projectile, maxSize, runChildUpdate: true, allowGravity: false });
    this.bullets = pool(40);
    this.turretBullets = pool(60);
    this.enemyBullets = pool(40);
  }

  private get aliveEnemies(): Enemy[] {
    return this.ctx.enemies.getChildren() as Enemy[];
  }

  /** Projéteis ativos de todos os tipos. */
  get activeProjectiles(): number {
    return this.bullets.countActive(true) + this.turretBullets.countActive(true) + this.enemyBullets.countActive(true);
  }

  // ------------------------------------------------------------------ herói

  /** Disparo com mira assistida: vai no inimigo visível mais próximo à frente, ou reto. */
  shoot(): void {
    const { player, match, fx } = this.ctx;
    const b = this.bullets.get(player.x, player.y, 'bullet') as Projectile | null;
    if (!b) return;
    const f = player.facing;
    const x = player.x + f * 18;
    const y = player.arcade.center.y - 4;
    const candidates = this.aliveEnemies.filter((e) => e.alive).map((e) => ({ x: e.arcade.center.x, y: e.arcade.center.y }));
    // A linha de visão é testada nas duas bordas do projétil, para ele não raspar em quinas.
    const los = match.building;
    const target = pickAimTarget({ x, y }, f, candidates, RANGED.range, AIM.coneDegrees,
      (tx, ty) => los.hasLineOfSight(x, y - 5, tx, ty - 5) && los.hasLineOfSight(x, y + 5, tx, ty + 5));
    const angle = target ? Math.atan2(target.y - y, target.x - x) : f > 0 ? 0 : Math.PI;
    b.fire(x, y, Math.cos(angle) * RANGED.speed, Math.sin(angle) * RANGED.speed, RANGED.damage * match.mods.damage, RANGED.range, RANGED.blockDamage);
    b.setDepth(25);
    fx.flash(x, y, 0x67e8f9, 0.55, 110);
    audio.play('shoot');
  }

  /** Golpe corpo a corpo: cada inimigo (e um bloco) no máximo uma vez por golpe. */
  resolveMelee(now: number): void {
    const { player, match, fx } = this.ctx;
    const swing = player.swing;
    if (!swing.isActive(now)) return;
    const rect = player.meleeRect;
    for (const e of this.aliveEnemies) {
      if (!e.alive || !overlaps(rect, e.rect) || !swing.tryHit(e.id, now)) continue;
      this.damageEnemy(e, MELEE.damage * match.mods.damage, player.facing * MELEE.knockback);
    }
    // Blocos: abre caminho por caixotes e ativa explosivos; não desgasta as próprias defesas.
    const b = match.building;
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.x + rect.width) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.y + rect.height - 1) / TILE);
    const cols = [];
    for (let x = x0; x <= x1; x++) cols.push(x);
    if (player.facing < 0) cols.reverse();
    for (const x of cols) {
      for (let y = y1; y >= y0; y--) {
        const def = b.get(x, y);
        if (def.id === 'empty' || !Number.isFinite(def.maxHp) || (b.isOwned(x, y) && !def.explosive)) continue;
        if (!swing.tryHit(-1, now)) return;
        b.damage(x, y, def.explosive ? def.maxHp : MELEE.blockDamage * match.mods.damage);
        fx.spark(x * TILE + TILE / 2, y * TILE + TILE / 2, 0xffffff, 6);
        audio.play('hit');
        return;
      }
    }
  }

  /** Disparo do herói ou de torreta acertou um inimigo. */
  bulletHitsEnemy(bullet: Projectile, e: Enemy): void {
    this.damageEnemy(e, bullet.damage, Math.sign(bullet.velocityX) * 120);
    bullet.kill();
  }

  /** Disparo do herói bateu em um bloco. */
  bulletHitsTile(bullet: Projectile, x: number, y: number): void {
    if (!bullet.active) return;
    const b = this.ctx.match.building;
    const def = b.get(x, y);
    // Um tiro do herói ativa (detona) o explosivo na hora.
    if (Number.isFinite(def.maxHp) && (!b.isOwned(x, y) || def.explosive)) b.damage(x, y, def.explosive ? def.maxHp : bullet.blockDamage);
    this.ctx.fx.spark(bullet.x, bullet.y, 0x67e8f9, 5);
    bullet.kill();
  }

  hurtPlayer(amount: number, fromX: number): void {
    const { player, match, fx, scene } = this.ctx;
    if (this.ctx.ended) return;
    const dealt = player.hurt(amount, fromX, this.ctx.now);
    if (dealt <= 0) return;
    fx.number(player.x, player.arcade.y - 8, `-${Math.round(dealt)}`, '#ff5d73');
    fx.spark(player.x, player.arcade.center.y, 0xff5d73, 8);
    scene.cameras.main.shake(140, 0.006);
    audio.play('hurt');
    if (match.playerHealth.dead) this.events.onPlayerDead();
  }

  // --------------------------------------------------------------- inimigos

  enemyTouchesPlayer(e: Enemy): void {
    const dmg = e.tryAttack(this.ctx.now);
    if (dmg > 0) this.hurtPlayer(dmg, e.x);
  }

  /** Um inimigo golpeou um bloco que estava no caminho. */
  enemyHitsBlock(x: number, y: number, damage: number): void {
    this.ctx.match.building.damage(x, y, damage);
    this.ctx.fx.spark(x * TILE + TILE / 2, y * TILE + TILE / 2, 0xffffff, 4);
    audio.play('hit');
  }

  enemyShoot(e: Enemy, x: number, y: number, tx: number, ty: number): void {
    const r = e.def.ranged;
    const b = r ? (this.enemyBullets.get(x, y, 'enemy-bullet') as Projectile | null) : null;
    if (!r || !b) return;
    const angle = Math.atan2(ty - y, tx - x);
    b.fire(x, y, Math.cos(angle) * r.speed, Math.sin(angle) * r.speed, r.damage, r.rangeTiles * TILE * 1.3, 0);
    b.setDepth(25);
    this.ctx.fx.flash(x, y, 0xc8ff7a, 0.5, 120);
    audio.play('spit');
  }

  /** Disparo inimigo detido por um bloco: qualquer peça serve de cobertura. */
  enemyBulletHitsTile(bullet: Projectile, x: number, y: number): void {
    if (!bullet.active) return;
    this.ctx.match.building.damage(x, y, ENEMY_SHOT_BLOCK_DAMAGE);
    this.ctx.fx.spark(bullet.x, bullet.y, 0xc8ff7a, 5);
    bullet.kill();
  }

  enemyBulletHitsPlayer(bullet: Projectile): void {
    if (!bullet.active) return;
    this.hurtPlayer(bullet.damage, bullet.x - bullet.velocityX);
    this.ctx.fx.spark(bullet.x, bullet.y, 0xc8ff7a, 6);
    bullet.kill();
  }

  /** Golpe de área do chefe ao aterrissar: fere o herói que estiver no chão por perto e racha estruturas. */
  bossSlam(e: Enemy): void {
    const { player, match, fx, scene } = this.ctx;
    const x = e.x;
    const y = e.arcade.bottom;
    fx.flash(x, y, 0xff5d73, BOSS_SLAM.radius * 1.6, 380);
    fx.burst(x, y, 0xd9c9a8, 22);
    scene.cameras.main.shake(300, 0.014);
    audio.play('explode');
    const pb = player.arcade;
    const grounded = player.onFloor && Math.abs(pb.bottom - y) < TILE * 1.5;
    if (grounded && Math.abs(pb.center.x - x) < BOSS_SLAM.radius * TILE) this.hurtPlayer(BOSS_SLAM.damage, x);
    const b = match.building;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor((y - 2) / TILE);
    for (let ty = cy - 1; ty <= cy; ty++) {
      for (let tx = cx - BOSS_SLAM.blockRadius - 1; tx <= cx + BOSS_SLAM.blockRadius + 1; tx++) b.damage(tx, ty, BOSS_SLAM.blockDamage);
    }
  }

  // ------------------------------------------------------- dano em inimigos

  damageEnemy(e: Enemy, amount: number, knockX: number): void {
    const { fx, scene } = this.ctx;
    const dealt = e.takeDamage(amount, this.ctx.now, knockX);
    if (dealt <= 0) return;
    fx.number(e.x, e.arcade.y - 6, String(Math.round(dealt)), '#ffffff');
    fx.spark(e.x, e.arcade.center.y, 0xffe9a8, 6);
    e.setTintFill(0xffffff);
    scene.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
    audio.play('hit');
    if (!e.alive) this.killEnemy(e);
  }

  /** Remove o inimigo de todos os sistemas uma única vez. */
  private killEnemy(e: Enemy): void {
    const { fx, scene, match } = this.ctx;
    const boss = e.def.behavior === 'boss';
    this.ctx.enemies.remove(e);
    this.spikeTimer.forget(e.id);
    match.kills++;
    this.events.onEnemyKilled(e);
    const gems = Math.min(boss ? 6 : 3, Math.ceil(e.def.reward / 8));
    for (let i = 0; i < gems; i++) this.pickups.drop(e.x, e.arcade.center.y, Math.round(e.def.reward / gems));
    fx.burst(e.x, e.arcade.center.y, 0xb48cff, boss ? 30 : 12);
    fx.flash(e.x, e.arcade.center.y, 0xb48cff, boss ? 3 : 1, 220);
    audio.play(boss ? 'explode' : 'enemyDie');
    scene.tweens.add({
      targets: e, scaleX: 1.3, scaleY: 0.2, alpha: 0, y: e.y + 10, duration: 220, ease: 'Cubic.easeIn',
      onComplete: () => e.destroy(),
    });
  }

  /** Espinhos sob os pés de um inimigo terrestre: dano com intervalo, e desgaste da armadilha. */
  applySpikes(e: Enemy, now: number): void {
    const body = e.arcade;
    const b = this.ctx.match.building;
    const ty = Math.floor((body.bottom - 2) / TILE);
    for (let tx = Math.floor(body.x / TILE); tx <= Math.floor((body.right - 1) / TILE); tx++) {
      if (b.get(tx, ty).trap !== 'spikes') continue;
      if (!this.spikeTimer.tryDamage(e.id, now, SPIKES.interval)) return;
      this.damageEnemy(e, SPIKES.damage, 0);
      b.damage(tx, ty, SPIKES.wear);
      return;
    }
  }

  /** Explosão de um bloco na célula (cx, cy): fere inimigos e, menos, o herói. */
  explode(cx: number, cy: number, ex: ExplosiveDef): void {
    const { player, fx, scene } = this.ctx;
    const x = cx * TILE + TILE / 2;
    const y = cy * TILE + TILE / 2;
    const radius = ex.radius * TILE;
    fx.flash(x, y, 0xffb347, radius / 22, 380);
    fx.flash(x, y, 0xffffff, radius / 40, 200);
    fx.spark(x, y, 0xffb347, 26);
    fx.burst(x, y, 0x55597a, 16);
    scene.cameras.main.shake(260, 0.012);
    audio.play('explode');
    for (const e of this.aliveEnemies.slice()) {
      if (!e.alive) continue;
      const dmg = explosionDamage(ex.damage, Math.hypot(e.x - x, e.arcade.center.y - y), radius + e.arcade.halfWidth);
      if (dmg > 0) this.damageEnemy(e, dmg, (e.x < x ? -1 : 1) * 320);
    }
    // O herói também se fere, mas menos: explosivo é arma de risco.
    const pd = explosionDamage(ex.damage * 0.35, Math.hypot(player.x - x, player.arcade.center.y - y), radius);
    if (pd > 0) this.hurtPlayer(pd, x);
  }
}
