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
    el('over-detail').textContent = victory
      ? `Você sobreviveu às ${data.waves} ondas.`
      : data.waves > 0 ? `Seu herói caiu depois de vencer ${data.waves} onda${data.waves > 1 ? 's' : ''}.` : 'Seu herói caiu na primeira onda.';
    el('over-stats').textContent = `Inimigos derrotados: ${data.kills} · Peças construídas: ${data.blocksPlaced} · `
      + (data.record ? `Novo recorde: onda ${data.bestWave}!` : `Recorde: onda ${data.bestWave}`);
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
