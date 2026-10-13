import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, defaultSave, restore, SaveSystem, serialize } from '../src/game/systems/SaveSystem';
import { MemoryStorage } from './helpers';

describe('salvamento', () => {
  it('salva e restaura configurações, recorde e estatísticas', () => {
    const storage = new MemoryStorage();
    const a = new SaveSystem(storage);
    a.updateSettings({ volume: 0.25, muted: true });
    a.data.settings.bindings.jump = ['W'];
    expect(a.recordMatch(4, 17, 9)).toBe(true);

    const b = new SaveSystem(storage);
    expect(b.data.settings.volume).toBe(0.25);
    expect(b.data.settings.muted).toBe(true);
    expect(b.data.settings.bindings.jump).toEqual(['W']);
    expect(b.data.settings.bindings.left).toEqual(DEFAULT_BINDINGS.left);
    expect(b.data.bestWave).toBe(4);
    expect(b.data.stats).toEqual({ kills: 17, games: 1, blocksPlaced: 9 });
  });

  it('o recorde só sobe', () => {
    const s = new SaveSystem(new MemoryStorage());
    s.recordMatch(5, 0, 0);
    expect(s.recordMatch(3, 0, 0)).toBe(false);
    expect(s.data.bestWave).toBe(5);
    expect(s.data.stats.games).toBe(2);
  });

  it('dados corrompidos voltam ao padrão sem lançar erro', () => {
    expect(restore('{isso não é json')).toEqual(defaultSave());
    expect(restore('null')).toEqual(defaultSave());
    expect(restore('"texto"')).toEqual(defaultSave());
    const odd = restore(JSON.stringify({ bestWave: 'muitas', settings: { volume: 9, muted: 'sim', bindings: { jump: [5], left: [] } }, stats: { kills: -4 } }));
    expect(odd.bestWave).toBe(0);
    expect(odd.settings.volume).toBe(1);
    expect(odd.settings.muted).toBe(false);
    expect(odd.settings.bindings).toEqual(DEFAULT_BINDINGS);
    expect(odd.stats.kills).toBe(0);
  });

  it('serialize/restore são inversos', () => {
    const d = defaultSave();
    d.bestWave = 7;
    d.settings.volume = 0.4;
    expect(restore(serialize(d))).toEqual(d);
  });

  it('funciona sem armazenamento ou com gravação bloqueada', () => {
    const none = new SaveSystem(null);
    expect(none.save()).toBe(false);
    expect(none.persistent).toBe(false);
    expect(none.data.bestWave).toBe(0);

    const storage = new MemoryStorage();
    storage.failWrites = true;
    const blocked = new SaveSystem(storage);
    blocked.recordMatch(3, 1, 1);
    expect(blocked.persistent).toBe(false);
    expect(blocked.data.bestWave).toBe(3);       // vale para a sessão
  });
});
