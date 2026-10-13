import Phaser from 'phaser';

/**
 * Projétil reutilizável (herói e torretas). Some ao percorrer o alcance,
 * sair do mundo ou atingir algo — nunca fica ativo indefinidamente.
 */
export class Projectile extends Phaser.Physics.Arcade.Image {
  damage = 0;
  blockDamage = 0;
  private startX = 0;
  private startY = 0;
  private range = 0;

  fire(x: number, y: number, vx: number, vy: number, damage: number, range: number, blockDamage: number): void {
    this.enableBody(true, x, y, true, true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(vx, vy);
    this.setRotation(Math.atan2(vy, vx));
    this.damage = damage;
    this.blockDamage = blockDamage;
    this.range = range;
    this.startX = x;
    this.startY = y;
  }

  get velocityX(): number {
    return (this.body as Phaser.Physics.Arcade.Body).velocity.x;
  }

  override update(): void {
    if (!this.active) return;
    const bounds = this.scene.physics.world.bounds;
    const travelled = Math.hypot(this.x - this.startX, this.y - this.startY);
    if (travelled >= this.range || !bounds.contains(this.x, this.y)) this.kill();
  }

  kill(): void {
    if (this.active) this.disableBody(true, true);
  }
}
