import { MODE_ORDER } from '../data/modes';
import type { Action, ArenaId, ModeId, SaveData, Settings, TouchMode } from '../types/game';

const KEY = 'destructor.save.v1';

/** Subconjunto do localStorage: permite injetar um armazenamento falso nos testes. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  down: ['S', 'DOWN'],
  jump: ['SPACE'],
  melee: ['J'],
  shoot: ['K'],
  dash: ['L', 'SHIFT'],
  build: ['B'],
  demolish: ['R'],
  repair: ['T'],
  startWave: ['ENTER'],
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: { volume: 0.6, muted: false, music: true, arena: 'colina', mode: 'classic', touch: 'auto', bindings: cloneBindings(DEFAULT_BINDINGS) },
    bestWave: 0,
    stats: { kills: 0, games: 0, blocksPlaced: 0 },
    daily: { date: '', bestWave: 0 },
    achievements: [],
    tutorialDone: false,
  };
}

export const ARENA_IDS: readonly ArenaId[] = ['colina', 'vale', 'planalto', 'ponte', 'noite'];
const TOUCH_MODES: readonly TouchMode[] = ['auto', 'on', 'off'];

function cloneBindings(b: Record<Action, string[]>): Record<Action, string[]> {
  const out = {} as Record<Action, string[]>;
  for (const k of Object.keys(b) as Action[]) out[k] = b[k].slice();
  return out;
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/** Transforma os dados em texto. Só campos simples; nada do motor de física. */
export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

/**
 * Reconstrói um SaveData válido a partir de texto. Qualquer campo ausente,
 * corrompido ou de tipo errado volta ao padrão em vez de quebrar o jogo.
 */
export function restore(raw: string | null): SaveData {
  const d = defaultSave();
  if (!raw) return d;
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return d;
  }
  if (!j || typeof j !== 'object') return d;
  const o = j as Record<string, unknown>;
  d.bestWave = Math.floor(num(o.bestWave, 0, 0, 9999));
  const st = (o.stats ?? {}) as Record<string, unknown>;
  d.stats.kills = Math.floor(num(st.kills, 0, 0, 1e9));
  d.stats.games = Math.floor(num(st.games, 0, 0, 1e9));
  d.stats.blocksPlaced = Math.floor(num(st.blocksPlaced, 0, 0, 1e9));
  const daily = (o.daily ?? {}) as Record<string, unknown>;
  if (typeof daily.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily.date)) {
    d.daily = { date: daily.date, bestWave: Math.floor(num(daily.bestWave, 0, 0, 9999)) };
  }
  if (Array.isArray(o.achievements)) {
    d.achievements = [...new Set(o.achievements.filter((a): a is string => typeof a === 'string' && /^[a-z0-9_]{1,32}$/.test(a)))].slice(0, 64);
  }
  d.tutorialDone = o.tutorialDone === true;
  const se = (o.settings ?? {}) as Record<string, unknown>;
  const settings: Settings = d.settings;
  settings.volume = num(se.volume, settings.volume, 0, 1);
  settings.muted = typeof se.muted === 'boolean' ? se.muted : settings.muted;
  settings.music = typeof se.music === 'boolean' ? se.music : settings.music;
  if (ARENA_IDS.includes(se.arena as ArenaId)) settings.arena = se.arena as ArenaId;
  if (MODE_ORDER.includes(se.mode as ModeId)) settings.mode = se.mode as ModeId;
  if (TOUCH_MODES.includes(se.touch as TouchMode)) settings.touch = se.touch as TouchMode;
  const b = (se.bindings ?? {}) as Record<string, unknown>;
  for (const action of Object.keys(settings.bindings) as Action[]) {
    const keys = b[action];
    if (Array.isArray(keys) && keys.length > 0 && keys.every((k) => typeof k === 'string' && /^[A-Z0-9_]{1,16}$/.test(k))) {
      settings.bindings[action] = (keys as string[]).slice(0, 4);
    }
  }
  return d;
}

export class SaveSystem {
  data: SaveData;
  /** false quando o navegador recusa gravar (modo privado, cota...). */
  persistent = true;

  constructor(private readonly storage: StorageLike | null) {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      this.data = restore(this.storage ? this.storage.getItem(KEY) : null);
    } catch {
      this.data = defaultSave();
    }
    return this.data;
  }

  save(): boolean {
    try {
      if (!this.storage) throw new Error('sem armazenamento');
      this.storage.setItem(KEY, serialize(this.data));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    return this.persistent;
  }

  /** Registra o fim de uma partida. Retorna true se bateu o recorde. */
  recordMatch(wavesCompleted: number, kills: number, blocksPlaced: number): boolean {
    const record = wavesCompleted > this.data.bestWave;
    if (record) this.data.bestWave = wavesCompleted;
    this.data.stats.games += 1;
    this.data.stats.kills += Math.max(0, kills);
    this.data.stats.blocksPlaced += Math.max(0, blocksPlaced);
    this.save();
    return record;
  }

  updateSettings(patch: Partial<Omit<Settings, 'bindings'>>): void {
    const s = this.data.settings;
    if (patch.volume !== undefined) s.volume = num(patch.volume, s.volume, 0, 1);
    if (patch.muted !== undefined) s.muted = patch.muted;
    if (patch.music !== undefined) s.music = patch.music;
    if (patch.arena !== undefined && ARENA_IDS.includes(patch.arena)) s.arena = patch.arena;
    if (patch.mode !== undefined && MODE_ORDER.includes(patch.mode)) s.mode = patch.mode;
    if (patch.touch !== undefined && TOUCH_MODES.includes(patch.touch)) s.touch = patch.touch;
    this.save();
  }

  /**
   * Atribui uma tecla a uma ação. Se a tecla já era de outra ação, as duas
   * trocam, para nenhuma ficar sem tecla nem haver tecla duplicada.
   */
  rebind(action: Action, key: string): boolean {
    if (!/^[A-Z0-9_]{1,16}$/.test(key)) return false;
    const b = this.data.settings.bindings;
    const previous = b[action][0];
    for (const other of Object.keys(b) as Action[]) {
      if (other === action || !b[other].includes(key)) continue;
      b[other] = b[other].filter((k) => k !== key);
      if (b[other].length === 0 && previous) b[other] = [previous];
    }
    b[action] = [key];
    this.save();
    return true;
  }

  /** Registra conquistas e devolve só as que são novas. */
  unlock(ids: readonly string[]): string[] {
    const fresh = ids.filter((id) => !this.data.achievements.includes(id));
    if (!fresh.length) return [];
    this.data.achievements.push(...fresh);
    this.save();
    return fresh;
  }

  /** Registra o resultado de um desafio diário. Retorna true se bateu o recorde do dia. */
  recordDaily(date: string, waves: number): boolean {
    const d = this.data.daily;
    if (d.date !== date) this.data.daily = { date, bestWave: 0 };
    const record = waves > this.data.daily.bestWave;
    if (record) this.data.daily.bestWave = waves;
    this.save();
    return record;
  }

  markTutorialDone(): void {
    if (this.data.tutorialDone) return;
    this.data.tutorialDone = true;
    this.save();
  }

  resetBindings(): void {
    this.data.settings.bindings = cloneBindings(DEFAULT_BINDINGS);
    this.save();
  }
}

/** localStorage do navegador, ou null se estiver indisponível/bloqueado. */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    return null;
  }
}
