import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/game/data/achievements';
import { blockById, BUILDABLE } from '../src/game/data/blocks';
import { composeWave, ENEMY_DEFS, FIRST_WAVE } from '../src/game/data/enemies';
import { MODE_ORDER, MODES } from '../src/game/data/modes';
import { MODIFIER_IDS, pickModifier } from '../src/game/data/modifiers';
import { AchievementTracker } from '../src/game/systems/Achievements';
import { dailyChallenge, dateKey, hashSeed, seededRandom } from '../src/game/systems/Daily';
import { createMatch } from '../src/game/systems/MatchState';
import { ARENA_IDS, restore, SaveSystem, serialize } from '../src/game/systems/SaveSystem';
import { buildArena } from '../src/game/world/LevelBuilder';
import { MemoryStorage } from './helpers';

const always = (v: number) => () => v;

describe('modos de jogo', () => {
  it('cada modo tem as regras esperadas', () => {
    expect(MODE_ORDER).toEqual(['classic', 'core', 'daily', 'builder', 'sandbox']);
    expect(MODES.builder.canAttack).toBe(false);
    expect(MODES.builder.startResources).toBeGreaterThan(MODES.classic.startResources);
    expect(MODES.sandbox.totalWaves).toBe(0);
    expect(MODES.daily.daily && !MODES.classic.daily).toBe(true);
  });

  it('Defender o núcleo põe o cristal na arena, em chão firme, e ele não pode ser demolido', () => {
    for (const arena of ARENA_IDS) {
      const m = createMatch(arena, 'core');
      const c = m.core;
      expect(c, arena).not.toBeNull();
      if (!c) continue;
      expect(m.building.get(c.x, c.y).id).toBe('core');
      expect(m.building.blocks('enemy', c.x, c.y + 1), `${arena}: chão sob o núcleo`).toBe(true);
      expect(m.building.isOwned(c.x, c.y)).toBe(true);
      const r = m.building.checkRemove(c.x, c.y, { player: { x: c.x * 32, y: c.y * 32, width: 1, height: 1 }, enemies: [] });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('core_locked');
      expect(m.resources.value).toBe(MODES.core.startResources);
    }
    expect(createMatch('colina', 'classic').core).toBeNull();
    expect(createMatch('colina', 'classic').building.ownedCells(() => true)).toEqual([]);
  });

  it('o núcleo não é peça do menu e cai como qualquer bloco', () => {
    expect(BUILDABLE.some((d) => d.core)).toBe(false);
    const m = createMatch('vale', 'core');
    const c = m.core as { x: number; y: number };
    const events: string[] = [];
    m.building.on((e) => events.push(`${e.type}:${e.block.id}`));
    m.building.damage(c.x, c.y, blockById('core').maxHp);
    expect(events).toContain('destroyed:core');
    expect(m.building.get(c.x, c.y).id).toBe('empty');
  });
});

describe('novas arenas', () => {
  it('Ponte: abismo sem fundo no meio, coberto por tábuas, e portais em chão firme', () => {
    const l = buildArena('ponte');
    expect(l.abyss).toBe(true);
    const mid = Math.floor(l.cols / 2);
    const at = (x: number, y: number) => l.cells[y * l.cols + x];
    const ground = l.playerSpawn.y + 1;
    expect(at(mid + 3, ground)).toBe(blockById('bridge').index);
    for (let y = ground + 1; y < l.rows; y++) expect(at(mid + 3, y)).toBe(blockById('empty').index);
    for (const s of l.enemySpawns) expect(at(s.x, s.y + 1)).not.toBe(blockById('empty').index);
  });

  it('Noite é escura; as arenas antigas não têm abismo nem escuridão', () => {
    expect(buildArena('noite').dark).toBe(true);
    for (const id of ['colina', 'vale', 'planalto'] as const) {
      const l = buildArena(id);
      expect(l.abyss || l.dark).toBe(false);
    }
  });
});

describe('desafio diário', () => {
  it('a mesma data gera a mesma arena e os mesmos sorteios', () => {
    const a = dailyChallenge('2026-10-15');
    const b = dailyChallenge('2026-10-15');
    expect(a.arena).toBe(b.arena);
    expect([a.random(), a.random(), a.random()]).toEqual([b.random(), b.random(), b.random()]);
    expect(ARENA_IDS).toContain(a.arena);
  });

  it('datas diferentes variam a arena ao longo do mês', () => {
    const arenas = new Set(Array.from({ length: 30 }, (_, i) => dailyChallenge(`2026-11-${String(i + 1).padStart(2, '0')}`).arena));
    expect(arenas.size).toBeGreaterThan(2);
  });

  it('gerador e data no formato esperado', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    const r = seededRandom(hashSeed('x'));
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('regras especiais das ondas', () => {
  it('não aparecem nas duas primeiras ondas nem nas de chefe; no diário, sempre nas outras', () => {
    expect(pickModifier(1, always(0), true)).toBeNull();
    expect(pickModifier(2, always(0), true)).toBeNull();
    expect(pickModifier(5, always(0), true)).toBeNull();
    expect(pickModifier(3, always(0.99), false)).toBeNull();          // sem sorte, sem regra
    expect(MODIFIER_IDS).toContain(pickModifier(3, always(0.1), false));
    for (let n = 3; n < 30; n++) if (n % 5) expect(pickModifier(n, Math.random, true)).not.toBeNull();
  });

  it('cada regra muda a onda do jeito anunciado', () => {
    const base = composeWave(7);
    expect(base.speedScale).toBe(1);
    expect(composeWave(7, 'haste').speedScale).toBeGreaterThan(1);
    expect(composeWave(7, 'armored').hpScale).toBeGreaterThan(base.hpScale);
    const bounty = composeWave(7, 'bounty');
    expect(bounty.reward).toBe(base.reward * 2);
    expect(bounty.enemies.length).toBeGreaterThan(base.enemies.length);
    expect(composeWave(7, 'fog').modifier).toBe('fog');
    expect(composeWave(7, 'fog').enemies).toEqual(base.enemies);
  });

  it('Sabotador e Curandeiro estreiam nas ondas previstas', () => {
    for (const type of ['saboteur', 'healer'] as const) {
      expect(composeWave(FIRST_WAVE[type] - 1).enemies).not.toContain(type);
      expect(composeWave(FIRST_WAVE[type]).enemies).toContain(type);
    }
    expect(ENEMY_DEFS.healer.heal?.amount).toBeGreaterThan(0);
  });
});

describe('conquistas', () => {
  const win = (t: AchievementTracker) => { t.matchEnded('victory'); return t.takeNew(); };

  it('vitória no núcleo, sem torretas, rende as conquistas certas (uma vez só)', () => {
    const t = new AchievementTracker('core', 'colina');
    t.piecePlaced('stone_block');
    expect(win(t).sort()).toEqual(['core_keeper', 'first_win', 'no_turrets']);
    t.matchEnded('victory');
    expect(t.takeNew()).toEqual([]);
  });

  it('torreta ou canhão tiram o "Na raça"; Noite e Só construtor têm as suas', () => {
    const t = new AchievementTracker('builder', 'noite');
    t.piecePlaced('cannon');
    const got = win(t);
    expect(got).toContain('builder_win');
    expect(got).toContain('night_owl');
    expect(got).not.toContain('no_turrets');
  });

  it('contadores: abismo, explosão, Sabotadores, peças e chefe sem dano', () => {
    const t = new AchievementTracker('classic', 'ponte');
    for (let i = 0; i < 7; i++) t.enemyKilled('basic', 'abyss');
    expect(t.takeNew()).toEqual([]);
    t.enemyKilled('basic', 'abyss');
    expect(t.takeNew()).toEqual(['into_the_abyss']);
    t.explosionKills(3);
    t.explosionKills(4);
    for (let i = 0; i < 10; i++) t.enemyKilled('saboteur', 'other');
    for (let i = 0; i < 40; i++) t.piecePlaced('wood_platform');
    expect(t.takeNew().sort()).toEqual(['architect', 'chain_reaction', 'saboteur_hunter']);
    t.waveStarted();
    t.enemyKilled('boss', 'other');
    t.waveCompleted(composeWave(5));
    expect(t.takeNew().sort()).toEqual(['flawless_titan', 'titan_slayer']);
    t.waveStarted();
    t.damageTaken(5);
    t.waveCompleted(composeWave(10));
    expect(t.takeNew()).toEqual([]);
  });

  it('no sandbox nada conta; no diário, onda 5 rende "Desafiante"', () => {
    const s = new AchievementTracker('sandbox', 'vale');
    s.enemyKilled('boss', 'other');
    expect(win(s)).toEqual([]);
    const d = new AchievementTracker('daily', 'vale');
    d.waveCompleted(composeWave(5));
    expect(d.takeNew()).toContain('daily_5');
  });

  it('toda conquista rastreada existe na lista', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    for (const id of ['first_win', 'titan_slayer', 'flawless_titan', 'core_keeper', 'builder_win', 'no_turrets', 'architect',
      'chain_reaction', 'into_the_abyss', 'night_owl', 'daily_5', 'saboteur_hunter']) expect(ids.has(id)).toBe(true);
  });
});

describe('salvamento de modo, diário, conquistas e tutorial', () => {
  it('guarda e restaura o que é novo', () => {
    const storage = new MemoryStorage();
    const s = new SaveSystem(storage);
    s.updateSettings({ mode: 'core', arena: 'noite' });
    expect(s.unlock(['first_win', 'night_owl'])).toEqual(['first_win', 'night_owl']);
    expect(s.unlock(['first_win', 'architect'])).toEqual(['architect']);
    expect(s.recordDaily('2026-10-15', 4)).toBe(true);
    expect(s.recordDaily('2026-10-15', 2)).toBe(false);
    s.markTutorialDone();
    const again = new SaveSystem(storage).data;
    expect(again.settings.mode).toBe('core');
    expect(again.settings.arena).toBe('noite');
    expect(again.achievements).toEqual(['first_win', 'night_owl', 'architect']);
    expect(again.daily).toEqual({ date: '2026-10-15', bestWave: 4 });
    expect(again.tutorialDone).toBe(true);
  });

  it('um novo dia zera o recorde do diário', () => {
    const s = new SaveSystem(new MemoryStorage());
    s.recordDaily('2026-10-15', 6);
    expect(s.recordDaily('2026-10-16', 1)).toBe(true);
    expect(s.data.daily).toEqual({ date: '2026-10-16', bestWave: 1 });
  });

  it('valores inválidos são descartados', () => {
    const d = restore(JSON.stringify({
      version: 1, settings: { mode: 'hacker' }, daily: { date: 'ontem', bestWave: 9 },
      achievements: ['ok_1', 'NÃO', 42, 'ok_1', '<script>'], tutorialDone: 'sim',
    }));
    expect(d.settings.mode).toBe('classic');
    expect(d.daily).toEqual({ date: '', bestWave: 0 });
    expect(d.achievements).toEqual(['ok_1']);
    expect(d.tutorialDone).toBe(false);
    expect(restore(serialize(d))).toEqual(d);
  });
});
