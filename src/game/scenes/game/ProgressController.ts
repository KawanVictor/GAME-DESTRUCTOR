import { TILE } from '../../config';
import { ACHIEVEMENTS } from '../../data/achievements';
import { audio, save } from '../../services';
import { AchievementTracker, type KillCause } from '../../systems/Achievements';
import type { BlockId, EnemyType, WaveDef } from '../../types/game';
import { Tutorial } from '../../ui/Tutorial';
import type { GameContext } from './GameContext';

/**
 * Progressão fora da partida: conquistas (avisadas na hora e gravadas) e o
 * tutorial da primeira partida.
 */
export class ProgressController {
  private readonly tracker: AchievementTracker;
  private readonly tutorial: Tutorial | null;
  /** Nomes das conquistas desbloqueadas desde o início (ou desde a última vitória). */
  private unlocked: string[] = [];

  constructor(private readonly ctx: GameContext, withTutorial: boolean) {
    this.tracker = new AchievementTracker(ctx.match.mode.id, ctx.match.level.id);
    this.tutorial = withTutorial ? new Tutorial(() => save.markTutorialDone()) : null;
  }

  /** Passo do tutorial (-1 = sem tutorial ou já concluído). */
  get tutorialStep(): number {
    return this.tutorial?.active ? this.tutorial.step : -1;
  }

  /** Conquistas desta partida até agora; `reset` começa uma lista nova (modo infinito). */
  takeUnlocked(reset = false): string[] {
    const out = this.unlocked.slice();
    if (reset) this.unlocked = [];
    return out;
  }

  enemyKilled(type: EnemyType, cause: KillCause): void { this.tracker.enemyKilled(type, cause); this.flush(); }
  explosionKills(count: number): void { this.tracker.explosionKills(count); this.flush(); }
  piecePlaced(id: BlockId): void { this.tracker.piecePlaced(id); this.flush(); }
  damageTaken(amount: number): void { this.tracker.damageTaken(amount); }
  waveStarted(): void { this.tracker.waveStarted(); }
  waveCompleted(def: WaveDef): void { this.tracker.waveCompleted(def); this.flush(); }
  matchEnded(outcome: 'victory' | 'defeat'): void { this.tracker.matchEnded(outcome); this.flush(); }

  /** A cada quadro: avança o tutorial conforme o jogador cumpre cada passo. */
  update(fighting: boolean, buildOpen: boolean): void {
    if (!this.tutorial?.active) return;
    const { player, match } = this.ctx;
    this.tutorial.update({
      moved: Math.abs(player.x - (match.level.playerSpawn.x + 0.5) * TILE) > TILE * 3,
      buildOpen, placed: match.blocksPlaced > 0, fighting, kills: match.kills,
    });
  }

  /** Mostra (e grava) as conquistas que a partida acabou de render. */
  private flush(): void {
    const fresh = save.unlock(this.tracker.takeNew());
    if (!fresh.length) return;
    const names = fresh.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id);
    this.unlocked.push(...names);
    this.ctx.hud.toast(`Conquista: ${names.join(' · ')}`, 2800, true);
    audio.play('upgrade');
  }

  destroy(): void {
    this.tutorial?.destroy();
  }
}
