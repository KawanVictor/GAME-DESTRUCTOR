import Phaser from 'phaser';
import { TILE, TURRET } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { BuildingSystem } from '../systems/BuildingSystem';
import { selectTurretTarget } from './Trap';

interface TurretUnit {
  x: number;
  y: number;
  head: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  nextShot: number;
}

/** Parte visual e de disparo das torretas colocadas na grade. */
export class TurretManager {
  private units = new Map<number, TurretUnit>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly building: BuildingSystem,
    private readonly bullets: Phaser.Physics.Arcade.Group,
    /** Multiplicador de dano vindo das melhorias. */
    private readonly damageScale: () => number,
    private readonly onFire: (x: number, y: number) => void,
  ) {}

  private key(x: number, y: number): number {
    return y * this.building.cols + x;
  }

  get count(): number {
    return this.units.size;
  }

  add(x: number, y: number): void {
    const cx = x * TILE + TILE / 2;
    const cy = y * TILE + 9;
    const head = this.scene.add.image(cx, cy, 'turret-head').setOrigin(0.27, 0.5).setDepth(13);
    const glow = this.scene.add.image(cx, cy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb347).setScale(0.9).setAlpha(0.35).setDepth(9);
    this.units.set(this.key(x, y), { x, y, head, glow, nextShot: 0 });
  }

  remove(x: number, y: number): void {
    const u = this.units.get(this.key(x, y));
    if (!u) return;
    u.head.destroy();
    u.glow.destroy();
    this.units.delete(this.key(x, y));
  }

  /** now em segundos. */
  update(now: number, enemies: readonly Enemy[]): void {
    if (!this.units.size) return;
    const candidates = enemies.map((e) => ({ id: e.id, x: e.arcade.center.x, y: e.arcade.center.y, alive: e.alive }));
    for (const u of this.units.values()) {
      const ox = u.head.x;
      const oy = u.head.y;
      const target = selectTurretTarget(ox, oy, candidates, TURRET.range * TILE,
        (tx, ty) => this.building.hasLineOfSight(ox, oy, tx, ty, { x: u.x, y: u.y }));
      if (!target) continue;
      const angle = Math.atan2(target.y - oy, target.x - ox);
      u.head.setRotation(angle);
      if (now < u.nextShot) continue;
      const bullet = this.bullets.get(ox, oy, 'turret-bullet') as Projectile | null;
      if (!bullet) continue;
      u.nextShot = now + TURRET.fireInterval;
      const mx = ox + Math.cos(angle) * 20;
      const my = oy + Math.sin(angle) * 20;
      bullet.fire(mx, my, Math.cos(angle) * TURRET.projectileSpeed, Math.sin(angle) * TURRET.projectileSpeed,
        TURRET.damage * this.damageScale(), TURRET.range * TILE * 1.2, 0);
      this.onFire(mx, my);
    }
  }

  destroy(): void {
    for (const u of this.units.values()) { u.head.destroy(); u.glow.destroy(); }
    this.units.clear();
  }
}
