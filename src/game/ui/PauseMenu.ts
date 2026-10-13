import { el, onClick, show } from './dom';

export interface PauseCallbacks {
  onResume(): void;
  onRestart(): void;
  onOptions(): void;
  onQuit(): void;
}

export class PauseMenu {
  private readonly abort = new AbortController();

  constructor(cb: PauseCallbacks) {
    const s = this.abort.signal;
    onClick(el('btn-resume'), s, cb.onResume);
    onClick(el('btn-restart'), s, cb.onRestart);
    onClick(el('btn-pause-options'), s, cb.onOptions);
    onClick(el('btn-quit'), s, cb.onQuit);
    show(el('pause'), false);
  }

  setOpen(open: boolean): void {
    show(el('pause'), open);
    if (open) el('btn-resume').focus();
  }

  destroy(): void {
    this.abort.abort();
    show(el('pause'), false);
  }
}
