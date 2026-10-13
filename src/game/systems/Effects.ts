import Phaser from 'phaser';

/** Partículas, clarões e números de dano. Tudo com reuso e teto de objetos. */
export class Effects {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private texts: Phaser.GameObjects.Text[] = [];
  private nextText = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 260 }, lifespan: { min: 180, max: 420 }, scale: { start: 1.6, end: 0 },
      blendMode: Phaser.BlendModes.ADD, emitting: false,
    }).setDepth(40);
    this.debris = scene.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 220 }, angle: { min: 200, max: 340 }, lifespan: { min: 300, max: 650 },
      scale: { start: 1.3, end: 0.3 }, gravityY: 900, emitting: false,
    }).setDepth(40);
    for (let i = 0; i < 16; i++) {
      this.texts.push(scene.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#fff', stroke: '#0b1026', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(50).setVisible(false));
    }
  }

  spark(x: number, y: number, tint: number, count = 8): void {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(count, x, y);
  }

  /** Estilhaços que caem (blocos colocados, quebrados, poeira). */
  burst(x: number, y: number, tint: number, count = 10): void {
    this.debris.setParticleTint(tint);
    this.debris.explode(count, x, y);
  }

  /** Clarão aditivo que cresce e some: explosões, tiros, impactos. */
  flash(x: number, y: number, tint: number, scale: number, duration = 260): void {
    const img = this.scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(39).setScale(scale * 0.3);
    this.scene.tweens.add({ targets: img, scale, alpha: 0, duration, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  /** Número flutuante (dano, materiais). */
  number(x: number, y: number, text: string, color: string): void {
    const t = this.texts[this.nextText];
    this.nextText = (this.nextText + 1) % this.texts.length;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setPosition(x, y).setAlpha(1).setVisible(true);
    this.scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => t.setVisible(false) });
  }

  /** Pequena animação de "encaixe" ao construir. */
  pop(x: number, y: number, frame: number): void {
    const img = this.scene.add.image(x, y, 'tiles', frame).setDepth(12).setScale(1.5).setAlpha(0.8);
    this.scene.tweens.add({ targets: img, scale: 1, alpha: 0, duration: 180, ease: 'Back.easeOut', onComplete: () => img.destroy() });
  }
}
