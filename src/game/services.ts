import { AudioSystem } from './systems/AudioSystem';
import { browserStorage, SaveSystem } from './systems/SaveSystem';

/** Serviços que vivem além de uma partida: salvamento e áudio. */
export const save = new SaveSystem(browserStorage());
export const audio = new AudioSystem();
audio.setVolume(save.data.settings.volume, save.data.settings.muted);

/** `?test=1` liga a API de inspeção usada pelos testes de navegador. */
export const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
