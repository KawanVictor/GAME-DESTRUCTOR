import type Phaser from 'phaser';
import type { Player } from '../../entities/Player';
import type { Effects } from '../../systems/Effects';
import type { MatchState } from '../../systems/MatchState';
import type { HUD } from '../../ui/HUD';

/**
 * O que os controladores da partida compartilham. A GameScene monta este
 * objeto uma vez em create(); cada controlador recebe só isto e o que mais
 * precisar, em vez de enxergar a cena inteira.
 */
export interface GameContext {
  readonly scene: Phaser.Scene;
  readonly match: MatchState;
  readonly player: Player;
  /** Inimigos vivos (os derrotados saem do grupo na hora). */
  readonly enemies: Phaser.GameObjects.Group;
  readonly fx: Effects;
  readonly hud: HUD;
  /** Tempo da cena em segundos (para junto com a pausa). */
  readonly now: number;
  /** A partida terminou (vitória ou derrota)? */
  readonly ended: boolean;
  readonly paused: boolean;
}
