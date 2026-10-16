import Phaser from 'phaser';
import { audio } from '../../services';
import type { GameContext } from './GameContext';

type Pickup = Phaser.Physics.Arcade.Image;
const MAX_ON_GROUND = 50;
const LIFETIME = 25;
const MAGNET_RADIUS = 110;

/** Gemas de materiais: caem de inimigos e caixotes, são atraídas pelo herói e somem com o tempo. */
export class PickupController {
  readonly group: Phaser.GameObjects.Group;

  constructor(private readonly ctx: GameContext) {
    this.group = ctx.scene.add.group();
  }

  get count(): number {
    return this.group.getLength();
  }

  drop(x: number, y: number, value: number): void {
    if (value <= 0) return;
    // Com gemas demais em campo, o valor vai direto para o jogador.
    if (this.count >= MAX_ON_GROUND) { this.ctx.match.resources.add(value); return; }
    const p = this.ctx.scene.physics.add.image(x, y, 'pickup').setDepth(18);
    p.setData('value', value).setData('born', this.ctx.now);
    this.group.add(p);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Phaser.Math.Between(-110, 110), Phaser.Math.Between(-320, -180));
    body.setBounce(0.35).setDragX(160).setCollideWorldBounds(true);
  }

  collect(p: Pickup): void {
    if (!p.active) return;
    const value = (p.getData('value') as number) ?? 0;
    this.ctx.match.resources.add(value);
    this.ctx.fx.number(p.x, p.y - 8, `+${value}`, '#ffd166');
    audio.play('pickup');
    p.destroy();
  }

  update(now: number, dt: number): void {
    const bottom = this.ctx.scene.physics.world.bounds.bottom;
    const px = this.ctx.player.x;
    const py = this.ctx.player.arcade.center.y;
    for (const p of (this.group.getChildren() as Pickup[]).slice()) {
      const age = now - ((p.getData('born') as number) ?? now);
      // Some com o tempo, ou ao cair no abismo.
      if (age > LIFETIME || p.y > bottom + 64) { p.destroy(); continue; }
      p.setAlpha(age > LIFETIME - 4 && Math.floor(now * 8) % 2 === 0 ? 0.3 : 1);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < MAGNET_RADIUS && d > 1 && !this.ctx.ended) {
        const body = p.body as Phaser.Physics.Arcade.Body;
        body.velocity.x += ((px - p.x) / d) * 1500 * dt;
        body.velocity.y += ((py - p.y) / d) * 1500 * dt;
      }
    }
  }
}
