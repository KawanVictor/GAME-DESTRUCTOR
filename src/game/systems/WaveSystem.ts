import type { EnemyType, WaveDef, WavePhase } from '../types/game';

export interface WaveSystemOptions {
  total: number;
  firstPreparation: number;
  preparation: number;
  completedPause: number;
  compose: (n: number) => WaveDef;
  /**
   * Pede o surgimento de um inimigo. Devolve o id dele, ou null se não foi
   * possível agora (ex.: limite de inimigos ativos) — o pedido volta à fila.
   */
  spawn: (type: EnemyType) => number | null;
  onWaveStart?: (def: WaveDef) => void;
  onWaveComplete?: (def: WaveDef) => void;
  onVictory?: () => void;
}

/**
 * Máquina de estados das ondas: preparing -> fighting -> completed -> ...
 * Só conta inimigos que ela mesma pediu (ids em `alive`); projéteis,
 * armadilhas e inimigos avulsos nunca seguram ou encerram uma onda.
 */
export class WaveSystem {
  phase: WavePhase = 'preparing';
  /** Onda em preparo ou em combate (1 = primeira). */
  number = 1;
  /** Ondas concluídas nesta partida. */
  completed = 0;
  /** Contagem regressiva da fase atual, em segundos. */
  timer: number;
  endless = false;

  private queue: EnemyType[] = [];
  private alive = new Set<number>();
  private spawnTimer = 0;
  private def: WaveDef | null = null;

  constructor(private readonly opts: WaveSystemOptions) {
    this.timer = opts.firstPreparation;
  }

  /** Inimigos que ainda faltam: na fila + vivos desta onda. */
  get remaining(): number {
    return this.queue.length + this.alive.size;
  }

  /** Encerra o preparo imediatamente. */
  startNow(): void {
    if (this.phase === 'preparing') this.timer = 0;
  }

  update(dt: number): void {
    if (this.phase === 'preparing') {
      this.timer -= dt;
      if (this.timer <= 0) this.beginWave();
    } else if (this.phase === 'fighting') {
      this.spawnTimer -= dt;
      if (this.queue.length && this.spawnTimer <= 0) {
        const type = this.queue[0];
        const id = this.opts.spawn(type);
        if (id !== null) {
          this.queue.shift();
          this.alive.add(id);
          this.spawnTimer = this.def ? this.def.spawnInterval : 1;
        } else {
          this.spawnTimer = 0.25;      // tenta de novo em instantes
        }
      }
      if (!this.queue.length && this.alive.size === 0) this.finishWave();
    } else if (this.phase === 'completed') {
      this.timer -= dt;
      if (this.timer > 0) return;
      if (this.completed >= this.opts.total && !this.endless) {
        this.phase = 'victory';
        this.opts.onVictory?.();
      } else {
        this.number = this.completed + 1;
        this.phase = 'preparing';
        this.timer = this.opts.preparation;
      }
    }
  }

  /** Avisar sempre que um inimigo for removido; ids desconhecidos são ignorados. */
  enemyRemoved(id: number): void {
    this.alive.delete(id);
  }

  /** Depois da vitória, segue com ondas além do total. */
  continueEndless(): void {
    if (this.phase !== 'victory') return;
    this.endless = true;
    this.number = this.completed + 1;
    this.phase = 'preparing';
    this.timer = this.opts.preparation;
  }

  private beginWave(): void {
    this.def = this.opts.compose(this.number);
    this.queue = this.def.enemies.slice();
    this.alive.clear();
    this.spawnTimer = 0.4;
    this.phase = 'fighting';
    this.timer = 0;
    this.opts.onWaveStart?.(this.def);
  }

  private finishWave(): void {
    this.completed = this.number;
    this.phase = 'completed';
    this.timer = this.opts.completedPause;
    if (this.def) this.opts.onWaveComplete?.(this.def);
  }
}
