import Phaser from 'phaser';
import { audio } from '../services';
import { el, onClick, show } from '../ui/dom';
import { setDebugScene } from '../debug';
import type { GameScene } from './GameScene';

export interface GameOverData {
  outcome: 'victory' | 'defeat';
  waves: number;
  kills: number;
  blocksPlaced: number;
  bestWave: number;
  record: boolean;
  /** Por que a derrota: o herói caiu ou o núcleo foi destruído. */
  reason: 'hero' | 'core';
  mode: string;
  modeName: string;
  /** Desafio diário: melhor resultado do dia e se este foi um novo recorde. */
  daily: { best: number; record: boolean } | null;
  /** Nomes das conquistas desbloqueadas nesta partida. */
  achievements: string[];
}

/** Tela de derrota ou de sessão concluída, sobre a partida congelada. */
export class GameOverScene extends Phaser.Scene {
  private abort = new AbortController();

  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    const victory = data.outcome === 'victory';
    el('over-title').textContent = victory ? 'Vitória!' : 'Derrota';
    const fell = data.reason === 'core' ? 'O núcleo foi destruído' : 'Seu herói caiu';
    const plural = data.waves > 1 ? 's' : '';
    el('over-detail').textContent = victory
      ? `Você sobreviveu às ${data.waves} ondas (${data.modeName}).`
      : data.waves > 0 ? `${fell} depois de vencer ${data.waves} onda${plural}.` : `${fell} na primeira onda.`;
    let stats = `Inimigos derrotados: ${data.kills} · Peças construídas: ${data.blocksPlaced}`;
    if (data.daily) stats += data.daily.record ? ` · Recorde do dia: onda ${data.daily.best}!` : ` · Melhor do dia: onda ${data.daily.best}`;
    else if (data.mode !== 'sandbox') stats += data.record ? ` · Novo recorde: onda ${data.bestWave}!` : ` · Recorde: onda ${data.bestWave}`;
    el('over-stats').textContent = stats;
    el('over-achievements').textContent = data.achievements.length ? `Conquistas: ${data.achievements.join(' · ')}` : '';
    show(el('over-achievements'), data.achievements.length > 0);
    show(el('btn-over-continue'), victory);

    this.abort = new AbortController();
    const s = this.abort.signal;
    const game = this.scene.get('Game') as GameScene;
    const restart = (): void => { audio.play('click'); this.scene.stop(); game.restartMatch(); };
    onClick(el('btn-over-restart'), s, restart);
    onClick(el('btn-over-continue'), s, () => { audio.play('click'); this.scene.stop(); game.continueEndless(); });
    onClick(el('btn-over-menu'), s, () => { audio.play('click'); this.scene.stop(); game.quitToMenu(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !e.repeat) restart();
    }, { signal: s });

    show(el('gameover'), true);
    (victory ? el('btn-over-continue') : el('btn-over-restart')).focus();
    setDebugScene('gameover', null);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.abort.abort();
      show(el('gameover'), false);
    });
  }
}
