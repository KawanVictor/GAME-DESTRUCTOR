import { audio, save } from '../services';
import { el, onClick, show } from './dom';

export interface PauseCallbacks {
  onResume(): void;
  onRestart(): void;
  onQuit(): void;
}

/** Liga um controle de volume + "sem som" às configurações salvas. */
export function bindVolume(sliderId: string, muteId: string, signal: AbortSignal): void {
  const slider = el<HTMLInputElement>(sliderId);
  const mute = el<HTMLInputElement>(muteId);
  slider.value = String(save.data.settings.volume);
  mute.checked = save.data.settings.muted;
  const apply = (): void => {
    save.updateSettings({ volume: Number(slider.value), muted: mute.checked });
    audio.setVolume(save.data.settings.volume, save.data.settings.muted);
  };
  slider.addEventListener('input', apply, { signal });
  slider.addEventListener('change', () => { audio.unlock(); audio.play('pickup'); }, { signal });
  mute.addEventListener('change', apply, { signal });
}

export class PauseMenu {
  private readonly abort = new AbortController();

  constructor(cb: PauseCallbacks) {
    const s = this.abort.signal;
    onClick(el('btn-resume'), s, cb.onResume);
    onClick(el('btn-restart'), s, cb.onRestart);
    onClick(el('btn-quit'), s, cb.onQuit);
    bindVolume('pause-volume', 'pause-mute', s);
    show(el('pause'), false);
  }

  setOpen(open: boolean): void {
    show(el('pause'), open);
    if (open) {
      el<HTMLInputElement>('pause-volume').value = String(save.data.settings.volume);
      el<HTMLInputElement>('pause-mute').checked = save.data.settings.muted;
      el('btn-resume').focus();
    }
  }

  destroy(): void {
    this.abort.abort();
    show(el('pause'), false);
  }
}
