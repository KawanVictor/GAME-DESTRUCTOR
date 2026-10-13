import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { setDebugScene } from '../debug';
import { audio, save } from '../services';
import { ARENA_IDS } from '../systems/SaveSystem';
import type { ArenaId } from '../types/game';
import { el, onClick, show } from '../ui/dom';
import { applyKeyLabels } from '../ui/keys';
import { openOptions, optionsOpen } from '../ui/Options';
import { ARENAS } from '../world/LevelBuilder';

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
    onClick(el('btn-menu-options'), s, () => openOptions(() => applyKeyLabels()));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !e.repeat && !optionsOpen()) start();
    }, { signal: s });

    this.renderArenas(s);
    applyKeyLabels();
    const d = save.data;
    el('menu-best').textContent = d.stats.games > 0
      ? `Melhor resultado: onda ${d.bestWave} · ${d.stats.kills} inimigos derrotados em ${d.stats.games} partidas`
      : 'Sobreviva a 10 ondas. Use o cenário a seu favor.';
    show(el('menu-storage'), !save.persistent);
    show(el('menu'), true);
    audio.setMusic('calm');
    setDebugScene('menu', null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      show(el('menu'), false);
    });
  }

  /** Botões de escolha da arena; a escolha fica salva. */
  private renderArenas(signal: AbortSignal): void {
    const list = el('arena-list');
    list.innerHTML = '';
    const select = (id: ArenaId): void => {
      save.updateSettings({ arena: id });
      list.querySelectorAll<HTMLElement>('[data-arena]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.arena === id)));
      el('arena-desc').textContent = ARENAS[id].description;
    };
    for (const id of ARENA_IDS) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.dataset.arena = id;
      b.setAttribute('role', 'radio');
      b.textContent = ARENAS[id].name;
      onClick(b, signal, () => { audio.play('click'); select(id); });
      list.appendChild(b);
    }
    select(save.data.settings.arena);
  }

  override update(_time: number, delta: number): void {
    this.far.tilePositionX += delta * 0.008;
    this.near.tilePositionX += delta * 0.02;
  }
}
