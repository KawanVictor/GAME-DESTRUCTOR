import { AudioSystem } from './systems/AudioSystem';
import { browserStorage, SaveSystem } from './systems/SaveSystem';

/** Serviços que vivem além de uma partida: salvamento e áudio. */
export const save = new SaveSystem(browserStorage());
export const audio = new AudioSystem();
audio.setVolume(save.data.settings.volume, save.data.settings.muted);
audio.setMusicEnabled(save.data.settings.music);

/**
 * `?test=1` liga a API de inspeção usada pelos testes de navegador — mas só
 * onde ela existe: no build de produção `__TEST_API__` é false e o parâmetro
 * não faz nada.
 */
export const TEST_MODE = __TEST_API__ && typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
