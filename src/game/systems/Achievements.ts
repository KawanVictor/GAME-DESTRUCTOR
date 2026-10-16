import type { ArenaId, BlockId, EnemyType, ModeId, WaveDef } from '../types/game';

/** Como um inimigo morreu, para as conquistas que dependem disso. */
export type KillCause = 'abyss' | 'explosion' | 'other';

/**
 * Acompanha uma partida e diz quais conquistas ela rendeu. Não sabe nada de
 * salvamento: quem chama pega as novas com takeNew() e grava. No sandbox
 * nada conta.
 */
export class AchievementTracker {
  private earned = new Set<string>();
  private fresh: string[] = [];
  private pieces = 0;
  private defenses = 0;
  private abyssKills = 0;
  private saboteurKills = 0;
  private waveDamage = 0;

  constructor(private readonly mode: ModeId, private readonly arena: ArenaId) {}

  private earn(id: string): void {
    if (this.mode === 'sandbox' || this.earned.has(id)) return;
    this.earned.add(id);
    this.fresh.push(id);
  }

  piecePlaced(id: BlockId): void {
    this.pieces++;
    if (id === 'turret' || id === 'cannon') this.defenses++;
    if (this.pieces >= 40) this.earn('architect');
  }

  enemyKilled(type: EnemyType, cause: KillCause): void {
    if (type === 'boss') this.earn('titan_slayer');
    if (type === 'saboteur' && ++this.saboteurKills >= 10) this.earn('saboteur_hunter');
    if (cause === 'abyss' && ++this.abyssKills >= 8) this.earn('into_the_abyss');
  }

  /** Inimigos derrotados por uma única explosão. */
  explosionKills(count: number): void {
    if (count >= 4) this.earn('chain_reaction');
  }

  damageTaken(amount: number): void {
    if (amount > 0) this.waveDamage += amount;
  }

  waveStarted(): void {
    this.waveDamage = 0;
  }

  waveCompleted(def: WaveDef): void {
    if (def.boss && this.waveDamage === 0) this.earn('flawless_titan');
    if (this.mode === 'daily' && def.number >= 5) this.earn('daily_5');
  }

  matchEnded(outcome: 'victory' | 'defeat'): void {
    if (outcome !== 'victory') return;
    this.earn('first_win');
    if (this.mode === 'core') this.earn('core_keeper');
    if (this.mode === 'builder') this.earn('builder_win');
    if (this.defenses === 0) this.earn('no_turrets');
    if (this.arena === 'noite') this.earn('night_owl');
  }

  /** Conquistas obtidas desde a última chamada. */
  takeNew(): string[] {
    const out = this.fresh;
    this.fresh = [];
    return out;
  }
}
