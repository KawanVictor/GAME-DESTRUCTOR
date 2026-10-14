import Phaser from 'phaser';
import { BUILDABLE } from '../../data/blocks';
import type { PlayerInput } from '../../entities/Player';
import { save } from '../../services';
import type { Action } from '../../types/game';
import type { TouchControls } from '../../ui/TouchControls';

type Key = Phaser.Input.Keyboard.Key;
const DIGITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/**
 * Teclado e toque em uma interface só: "está segurando?" e "acabou de
 * apertar?", por ação. As teclas vêm das configurações salvas e podem ser
 * recriadas no meio da partida (remapeamento).
 */
export class InputController {
  private keys = new Map<Action, Key[]>();
  private digitKeys: Key[] = [];
  /** Ações/teclas apertadas desde o último quadro (não perde toques muito rápidos). */
  private justPressed = new Set<string>();

  constructor(private readonly scene: Phaser.Scene, private readonly touch: TouchControls) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Teclado indisponível');
    this.applyBindings();
    this.digitKeys = DIGITS.slice(0, BUILDABLE.length).map((name, i) => {
      const k = kb.addKey(name, true, false);
      k.on(Phaser.Input.Keyboard.Events.DOWN, () => this.justPressed.add(`digit${i}`));
      return k;
    });
  }

  /** (Re)cria as teclas a partir das configurações salvas. */
  applyBindings(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    for (const list of this.keys.values()) for (const k of list) { k.removeAllListeners(); kb.removeKey(k, true); }
    this.keys.clear();
    const bindings = save.data.settings.bindings;
    for (const action of Object.keys(bindings) as Action[]) {
      const list = bindings[action].map((name) => kb.addKey(name, true, false));
      for (const k of list) k.on(Phaser.Input.Keyboard.Events.DOWN, () => this.justPressed.add(action));
      this.keys.set(action, list);
    }
    this.justPressed.clear();
  }

  held(action: Action): boolean {
    return this.touch.isHeld(action) || (this.keys.get(action) ?? []).some((k) => k.isDown);
  }

  pressed(action: Action): boolean {
    return this.justPressed.has(action) || this.touch.wasPressed(action);
  }

  /** A tecla numérica de índice `i` (0 = "1") foi apertada neste quadro? */
  digitPressed(i: number): boolean {
    return this.justPressed.has(`digit${i}`);
  }

  /** Estado dos controles do herói neste quadro. */
  playerInput(): PlayerInput {
    return {
      left: this.held('left'), right: this.held('right'), down: this.held('down'),
      jumpHeld: this.held('jump'), jumpPressed: this.pressed('jump'),
      melee: this.held('melee') || this.pressed('melee'), shoot: this.held('shoot') || this.pressed('shoot'),
      dashPressed: this.pressed('dash'),
    };
  }

  /** Chamar ao fim de cada quadro. */
  endFrame(): void {
    this.justPressed.clear();
    this.touch.endFrame();
  }

  /** Esquece o que estava apertado (ao pausar ou terminar). */
  release(): void {
    this.justPressed.clear();
    this.touch.release();
  }

  destroy(): void {
    for (const list of this.keys.values()) for (const k of list) k.removeAllListeners();
    for (const k of this.digitKeys) k.removeAllListeners();
    this.keys.clear();
  }
}
