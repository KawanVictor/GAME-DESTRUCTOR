import type Phaser from 'phaser';
import { METEORS, TILE } from '../../config';
import type { CombatController } from './CombatController';
import type { GameContext } from './GameContext';

interface Falling {
  x: number;
  y: number;
  at: number;
  mark: Phaser.GameObjects.Image;
  rock: Phaser.GameObjects.Image;
}

/** Quão longe do herói (em tiles, para cada lado) os meteoros caem. */
const SPREAD = 7;

/**
 * Regra "Chuva de meteoros": de tempos em tempos marca um ponto no chão
 * perto do herói e, depois do aviso, uma pedra cai ali e explode.
 */
export class Meteors {
  private next = 0;
  private falling: Falling[] = [];

  constructor(private readonly ctx: GameContext, private readonly combat: CombatController) {}

  get pending(): number {
    return this.falling.length;
  }

  /** `active`: a chuva está valendo agora (onda em combate com a regra). */
  update(now: number, active: boolean): void {
    if (active && now >= this.next) {
      this.next = now + METEORS.interval * (0.7 + Math.random() * 0.6);
      this.drop(now);
    }
    for (const f of this.falling.slice()) {
      if (now < f.at) continue;
      this.falling.splice(this.falling.indexOf(f), 1);
      f.mark.destroy();
      f.rock.destroy();
      if (!this.ctx.ended) this.combat.meteor(f.x, f.y, METEORS.radius * TILE, METEORS.damage, METEORS.blockDamage);
    }
  }

  private drop(now: number): void {
    const { scene, player, match } = this.ctx;
    const b = match.building;
    const tx = Math.max(1, Math.min(b.cols - 2, Math.floor(player.x / TILE) + Math.round((Math.random() * 2 - 1) * SPREAD)));
    // Cai no primeiro bloco sólido da coluna; sem chão (abismo), na altura do herói.
    let ty = 0;
    while (ty < b.rows && !b.blocks('enemy', tx, ty)) ty++;
    const x = tx * TILE + TILE / 2;
    const y = ty < b.rows ? ty * TILE - 4 : player.arcade.center.y;
    const mark = scene.add.image(x, y, 'glow').setTint(0xff5d73).setScale(1.4, 0.35).setAlpha(0.8).setDepth(12);
    scene.tweens.add({ targets: mark, alpha: 0.3, duration: 160, yoyo: true, repeat: -1 });
    const rock = scene.add.image(x - 120, y - 520, 'meteor').setDepth(26);
    scene.tweens.add({ targets: rock, x, y, duration: METEORS.warning * 1000, ease: 'Quad.easeIn' });
    this.falling.push({ x, y, at: now + METEORS.warning, mark, rock });
  }

  destroy(): void {
    for (const f of this.falling) { f.mark.destroy(); f.rock.destroy(); }
    this.falling = [];
  }
}
