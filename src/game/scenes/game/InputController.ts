import Phaser from 'phaser';
import { BUILDABLE } from '../../data/blocks';
import type { PlayerInput } from '../../entities/Player';
import { save } from '../../services';
import type { Action } from '../../types/game';
import type { TouchControls } from '../../ui/TouchControls';

type Key = Phaser.Input.Keyboard.Key;
const DIGITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/** Primeiro controle conectado, ou null. */
function firstPad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const p of navigator.getGamepads()) if (p?.connected) return p;
  return null;
}

/** O botão Start (ou Select) de algum controle está apertado? Usado para pausar e despausar. */
export function padStartDown(): boolean {
  const p = firstPad();
  return !!p && (p.buttons[9]?.pressed || p.buttons[8]?.pressed);
}

/**
 * Ações seguradas no controle, no layout padrão (Xbox/PlayStation):
 * analógico ou direcional move · A pula · X golpeia · B ou RT atira ·
 * RB ou LT investe · Y abre a construção · LB começa a onda · Start pausa.
 */
function padActions(): Set<string> {
  const out = new Set<string>();
  const p = firstPad();
  if (!p) return out;
  const b = (i: number): boolean => p.buttons[i]?.pressed ?? false;
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  if (ax < -0.4 || b(14)) out.add('left');
  if (ax > 0.4 || b(15)) out.add('right');
  if (ay > 0.6 || b(13)) out.add('down');
  if (b(0)) out.add('jump');
  if (b(2)) out.add('melee');
  if (b(1) || b(7)) out.add('shoot');
  if (b(5) || b(6)) out.add('dash');
  if (b(3)) out.add('build');
  if (b(4)) out.add('startWave');
  if (b(9) || b(8)) out.add('pad:pause');
  return out;
}

/**
 * Teclado, toque e controle em uma interface só: "está segurando?" e "acabou de
 * apertar?", por ação. As teclas vêm das configurações salvas e podem ser
 * recriadas no meio da partida (remapeamento).
 */
export class InputController {
  private keys = new Map<Action, Key[]>();
  private digitKeys: Key[] = [];
  /** Ações/teclas apertadas desde o último quadro (não perde toques muito rápidos). */
  private justPressed = new Set<string>();
  /** Ações seguradas no controle neste quadro. */
  private pad = new Set<string>();

  constructor(private readonly scene: Phaser.Scene, private readonly touch: TouchControls) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Teclado indisponível');
    this.applyBindings();
    // Botões do controle já segurados (ex.: o Start que abriu a partida) só contam depois de soltos.
    this.pad = padActions();
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

  /** Lê o controle (chamar no início de cada quadro). Bordas de subida viram "acabou de apertar". */
  pollGamepad(): void {
    const now = padActions();
    for (const a of now) if (!this.pad.has(a)) this.justPressed.add(a);
    this.pad = now;
  }

  /** Start do controle apertado neste quadro. */
  get padPausePressed(): boolean {
    return this.justPressed.has('pad:pause');
  }

  held(action: Action): boolean {
    return this.pad.has(action) || this.touch.isHeld(action) || (this.keys.get(action) ?? []).some((k) => k.isDown);
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
    // O que estiver segurado no controle agora só conta depois de soltar.
    this.pad = padActions();
    this.touch.release();
  }

  destroy(): void {
    for (const list of this.keys.values()) for (const k of list) k.removeAllListeners();
    for (const k of this.digitKeys) k.removeAllListeners();
    this.keys.clear();
  }
}
