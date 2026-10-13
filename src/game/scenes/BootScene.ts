import Phaser from 'phaser';

/** Primeira cena: ajustes globais mínimos e segue para a geração dos recursos. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    this.scene.start('Preload');
  }
}
