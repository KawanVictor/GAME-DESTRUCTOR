import { save } from '../services';
import type { Action } from '../types/game';
import { el, show } from './dom';

/** O jogo deve mostrar os controles de toque agora? */
export function touchWanted(): boolean {
  const mode = save.data.settings.touch;
  if (mode !== 'auto') return mode === 'on';
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * Botões de toque sobre o jogo. Mantêm o mesmo estado que o teclado
 * (segurando / acabou de apertar), então a cena trata os dois igual.
 */
export class TouchControls {
  private readonly abort = new AbortController();
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();

  constructor() {
    const s = this.abort.signal;
    el('touch').querySelectorAll<HTMLElement>('[data-touch]').forEach((b) => {
      const action = b.dataset.touch as Action;
      const down = (e: Event): void => {
        e.preventDefault();
        if (!this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
        b.classList.add('down');
      };
      const up = (e: Event): void => {
        e.preventDefault();
        this.held.delete(action);
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', down, { signal: s });
      b.addEventListener('pointerup', up, { signal: s });
      b.addEventListener('pointercancel', up, { signal: s });
      b.addEventListener('pointerleave', up, { signal: s });
      b.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: s });
    });
    this.refresh();
  }

  /** Reaplica a visibilidade (chamar após mudar a opção). */
  refresh(): void {
    const on = touchWanted();
    show(el('touch'), on);
    el('hud').classList.toggle('touch', on);
    if (!on) this.release();
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  wasPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Chamar ao fim de cada quadro. */
  endFrame(): void {
    this.pressed.clear();
  }

  release(): void {
    this.held.clear();
    this.pressed.clear();
    el('touch').querySelectorAll('.down').forEach((b) => b.classList.remove('down'));
  }

  destroy(): void {
    this.abort.abort();
    this.release();
    show(el('touch'), false);
    el('hud').classList.remove('touch');
  }
}
