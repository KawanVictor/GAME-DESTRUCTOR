import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { audio, save } from '../services';
import { el, onClick, show } from '../ui/dom';
import { bindVolume } from '../ui/PauseMenu';
import { setDebugScene } from '../debug';

/** Menu inicial: fundo animado no canvas, controles em HTML. */
export class MenuScene extends Phaser.Scene {
  private abort = new AbortController();
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.image(0, 0, 'bg-sky').setOrigin(0);
    this.far = this.add.tileSprite(0, VIEW_HEIGHT - 360, VIEW_WIDTH, 360, 'bg-far').setOrigin(0);
    this.near = this.add.tileSprite(0, VIEW_HEIGHT - 320, VIEW_WIDTH, 320, 'bg-near').setOrigin(0);
    this.cameras.main.fadeIn(300, 7, 11, 31);

    this.abort = new AbortController();
    const s = this.abort.signal;
    const start = (): void => {
      audio.unlock();
      audio.play('click');
      this.scene.start('Game');
    };
    onClick(el('btn-play'), s, start);
    onClick(el('btn-howto'), s, () => {
      const panel = el('howto');
      const open = panel.classList.contains('hidden');
      show(panel, open);
      el('btn-howto').setAttribute('aria-expanded', String(open));
    });
    bindVolume('menu-volume', 'menu-mute', s);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !e.repeat) start();
    }, { signal: s });

    const d = save.data;
    el('menu-best').textContent = d.stats.games > 0
      ? `Melhor resultado: onda ${d.bestWave} · ${d.stats.kills} inimigos derrotados em ${d.stats.games} partidas`
      : 'Sobreviva a 10 ondas. Use o cenário a seu favor.';
    show(el('menu-storage'), !save.persistent);
    show(el('menu'), true);
    setDebugScene('menu', null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      show(el('menu'), false);
    });
  }

  override update(_time: number, delta: number): void {
    this.far.tilePositionX += delta * 0.008;
    this.near.tilePositionX += delta * 0.02;
  }
}
