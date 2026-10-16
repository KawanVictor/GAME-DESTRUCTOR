import Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { setDebugScene } from '../debug';
import { ACHIEVEMENTS } from '../data/achievements';
import { MODE_ORDER, MODES } from '../data/modes';
import { audio, save } from '../services';
import { dailyChallenge, dateKey } from '../systems/Daily';
import { ARENA_IDS } from '../systems/SaveSystem';
import type { ArenaId, ModeId } from '../types/game';
import { el, onClick, show } from '../ui/dom';
import { applyKeyLabels } from '../ui/keys';
import { openOptions, optionsOpen } from '../ui/Options';
import { ARENAS } from '../world/LevelBuilder';

/** Menu inicial: fundo animado no canvas, controles em HTML. */
export class MenuScene extends Phaser.Scene {
  private abort = new AbortController();
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private start: () => void = () => {};
  /** Botões do controle segurados no quadro anterior (para pegar só o aperto). */
  private padWasDown = true;

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
    this.start = start;
    this.padWasDown = true;
    onClick(el('btn-play'), s, start);
    onClick(el('btn-howto'), s, () => {
      const panel = el('howto');
      const open = panel.classList.contains('hidden');
      show(panel, open);
      el('btn-howto').setAttribute('aria-expanded', String(open));
    });
    onClick(el('btn-achievements'), s, () => {
      const panel = el('achievements');
      const open = panel.classList.contains('hidden');
      show(panel, open);
      el('btn-achievements').setAttribute('aria-expanded', String(open));
    });
    onClick(el('btn-menu-options'), s, () => openOptions(() => applyKeyLabels()));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !e.repeat && !optionsOpen()) start();
    }, { signal: s });

    this.renderArenas(s);
    this.renderModes(s);
    this.renderAchievements();
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

  /** Botões de escolha do modo; a escolha fica salva. No desafio diário a arena é a do dia. */
  private renderModes(signal: AbortSignal): void {
    const list = el('mode-list');
    list.innerHTML = '';
    const select = (id: ModeId): void => {
      save.updateSettings({ mode: id });
      list.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === id)));
      const daily = id === 'daily';
      el('mode-desc').textContent = MODES[id].description;
      el('arena-list').querySelectorAll<HTMLButtonElement>('[data-arena]').forEach((b) => { b.disabled = daily; });
      if (daily) {
        const today = dateKey();
        const arena = dailyChallenge(today).arena;
        const best = save.data.daily.date === today ? save.data.daily.bestWave : 0;
        el('arena-list').querySelectorAll<HTMLElement>('[data-arena]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.arena === arena)));
        el('arena-desc').textContent = `Arena de hoje: ${ARENAS[arena].name}. ${best > 0 ? `Seu melhor hoje: onda ${best}.` : 'Você ainda não jogou o desafio de hoje.'}`;
      } else {
        this.selectArena(save.data.settings.arena);
      }
    };
    for (const id of MODE_ORDER) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.dataset.mode = id;
      b.setAttribute('role', 'radio');
      b.textContent = MODES[id].name;
      onClick(b, signal, () => { audio.play('click'); select(id); });
      list.appendChild(b);
    }
    select(save.data.settings.mode);
  }

  private renderAchievements(): void {
    const got = new Set(save.data.achievements);
    el('achievements-count').textContent = `${ACHIEVEMENTS.filter((a) => got.has(a.id)).length} de ${ACHIEVEMENTS.length} conquistas`;
    const list = el('achievements-list');
    list.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const li = document.createElement('li');
      li.classList.toggle('done', got.has(a.id));
      li.dataset.achievement = a.id;
      const name = document.createElement('strong');
      name.textContent = a.name;
      li.append(name, a.description);
      list.appendChild(li);
    }
  }

  private selectArena(id: ArenaId): void {
    save.updateSettings({ arena: id });
    el('arena-list').querySelectorAll<HTMLElement>('[data-arena]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.arena === id)));
    el('arena-desc').textContent = ARENAS[id].description;
  }

  /** Botões de escolha da arena; a escolha fica salva. */
  private renderArenas(signal: AbortSignal): void {
    const list = el('arena-list');
    list.innerHTML = '';
    const select = (id: ArenaId): void => this.selectArena(id);
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
    // Controle: A ou Start começa a partida.
    const pad = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p?.connected) : null;
    const down = !!pad && (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed);
    if (down && !this.padWasDown && !optionsOpen()) this.start();
    this.padWasDown = down;
  }
}
