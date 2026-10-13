import { audio, save } from '../services';
import type { Action, TouchMode } from '../types/game';
import { el, onClick, show } from './dom';
import { ACTION_NAMES, applyKeyLabels, keyLabel, keyNameFromEvent } from './keys';

let closeCurrent: (() => void) | null = null;

export function optionsOpen(): boolean {
  return closeCurrent !== null;
}

/**
 * Abre a tela de opções (som, toque e teclas). `onClose` é chamado ao
 * fechar, para quem abriu reaplicar o que mudou (ex.: teclas na partida).
 * Todos os ouvintes vivem só enquanto a tela está aberta.
 */
export function openOptions(onClose: () => void): void {
  if (closeCurrent) return;
  const abort = new AbortController();
  const s = abort.signal;
  let listening: Action | null = null;

  const volume = el<HTMLInputElement>('opt-volume');
  const mute = el<HTMLInputElement>('opt-mute');
  const music = el<HTMLInputElement>('opt-music');
  const touch = el<HTMLSelectElement>('opt-touch');
  const st = save.data.settings;
  volume.value = String(st.volume);
  mute.checked = st.muted;
  music.checked = st.music;
  touch.value = st.touch;

  const applySound = (): void => {
    save.updateSettings({ volume: Number(volume.value), muted: mute.checked, music: music.checked });
    audio.setVolume(st.volume, st.muted);
    audio.setMusicEnabled(st.music);
  };
  volume.addEventListener('input', applySound, { signal: s });
  volume.addEventListener('change', () => { audio.unlock(); audio.play('pickup'); }, { signal: s });
  mute.addEventListener('change', applySound, { signal: s });
  music.addEventListener('change', applySound, { signal: s });
  touch.addEventListener('change', () => save.updateSettings({ touch: touch.value as TouchMode }), { signal: s });

  const renderKeys = (): void => {
    const list = el('key-list');
    list.innerHTML = '';
    for (const action of Object.keys(ACTION_NAMES) as Action[]) {
      const row = document.createElement('div');
      row.className = 'key-row';
      const label = document.createElement('span');
      label.textContent = ACTION_NAMES[action];
      const b = document.createElement('button');
      b.className = 'btn small';
      b.dataset.rebind = action;
      b.textContent = listening === action ? 'Aperte uma tecla…' : st.bindings[action].map(keyLabel).join(' ou ');
      b.classList.toggle('primary', listening === action);
      b.addEventListener('click', () => { listening = listening === action ? null : action; renderKeys(); }, { signal: s });
      row.append(label, b);
      list.appendChild(row);
    }
    applyKeyLabels();
  };

  const close = (): void => {
    abort.abort();
    closeCurrent = null;
    show(el('options'), false);
    onClose();
  };
  closeCurrent = close;

  // Fase de captura: enquanto a tela está aberta, nenhuma tecla chega ao jogo.
  window.addEventListener('keydown', (e) => {
    e.stopImmediatePropagation();
    if (listening) {
      e.preventDefault();
      const name = e.code === 'Escape' ? null : keyNameFromEvent(e);
      if (name) { save.rebind(listening, name); audio.play('click'); }
      else if (e.code !== 'Escape') audio.play('deny');
      listening = null;
      renderKeys();
    } else if (e.code === 'Escape') {
      close();
    }
  }, { signal: s, capture: true });
  window.addEventListener('keyup', (e) => e.stopImmediatePropagation(), { signal: s, capture: true });

  onClick(el('btn-keys-reset'), s, () => { save.resetBindings(); listening = null; renderKeys(); });
  onClick(el('btn-options-close'), s, close);

  renderKeys();
  show(el('options'), true);
}
