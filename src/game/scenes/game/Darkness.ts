import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';

/** Uma fonte de luz: centro e raio em px, em coordenadas do mundo. */
export interface Light {
  x: number;
  y: number;
  radius: number;
}

/** Tamanho da textura 'light' gerada em PreloadScene. */
const LIGHT_SIZE = 256;

/**
 * Escuridão da arena Noite e da neblina: uma camada escura do tamanho da
 * tela, recortada a cada quadro nas fontes de luz. A intensidade muda aos
 * poucos, para a neblina chegar e ir embora sem corte seco.
 */
export class Darkness {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private level = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.rt = scene.add.renderTexture(0, 0, VIEW_WIDTH, VIEW_HEIGHT).setOrigin(0).setScrollFactor(0).setDepth(40).setVisible(false);
    this.stamp = scene.make.image({ key: 'light', add: false });
  }

  /** Intensidade atual (0 = claro, 1 = escuro). */
  get strength(): number {
    return this.level;
  }

  /** `target` de 0 (sem escuridão) a 1; `lights` em coordenadas do mundo. */
  update(dt: number, target: number, lights: readonly Light[]): void {
    this.level += (target - this.level) * Math.min(1, dt * 2.5);
    if (this.level < 0.02) {
      this.level = target === 0 ? 0 : this.level;
      this.rt.setVisible(false);
      return;
    }
    const cam = this.scene.cameras.main;
    this.rt.setVisible(true).clear().fill(0x02030a, 0.9 * this.level);
    for (const l of lights) {
      const sx = l.x - cam.scrollX;
      const sy = l.y - cam.scrollY;
      if (sx < -l.radius || sy < -l.radius || sx > VIEW_WIDTH + l.radius || sy > VIEW_HEIGHT + l.radius) continue;
      this.stamp.setScale((l.radius * 2) / LIGHT_SIZE);
      this.rt.erase(this.stamp, sx, sy);
    }
  }

  destroy(): void {
    this.stamp.destroy();
    this.rt.destroy();
  }
}
