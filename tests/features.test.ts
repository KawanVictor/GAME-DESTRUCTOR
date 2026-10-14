import { describe, expect, it } from 'vitest';
import { AIM, UPGRADE_IDS, UPGRADE_OFFERS, UPGRADES } from '../src/game/config';
import { blockById } from '../src/game/data/blocks';
import { composeWave, ENEMY_DEFS, FIRST_WAVE } from '../src/game/data/enemies';
import { Health, pickAimTarget } from '../src/game/systems/CombatSystem';
import { buyUpgrade, createMatch, rollOffers } from '../src/game/systems/MatchState';
import { ARENA_IDS, DEFAULT_BINDINGS, restore, SaveSystem, serialize } from '../src/game/systems/SaveSystem';
import type { Action, EnemyType } from '../src/game/types/game';
import { buildArena } from '../src/game/world/LevelBuilder';
import { ctxAt, makeWorld, MemoryStorage } from './helpers';

describe('mira assistida', () => {
  const see = (): boolean => true;
  const origin = { x: 0, y: 0 };

  it('escolhe o inimigo mais próximo à frente, mesmo abaixo do herói', () => {
    const foes = [{ x: 200, y: 90 }, { x: 120, y: 60 }, { x: -50, y: 0 }];
    expect(pickAimTarget(origin, 1, foes, 520, AIM.coneDegrees, see)).toEqual({ x: 120, y: 60 });
    expect(pickAimTarget(origin, -1, foes, 520, AIM.coneDegrees, see)).toEqual({ x: -50, y: 0 });
  });

  it('ignora quem está fora do cone, do alcance ou sem linha de visão', () => {
    expect(pickAimTarget(origin, 1, [{ x: 20, y: 200 }], 520, AIM.coneDegrees, see)).toBeNull();      // quase embaixo
    expect(pickAimTarget(origin, 1, [{ x: 900, y: 0 }], 520, AIM.coneDegrees, see)).toBeNull();
    expect(pickAimTarget(origin, 1, [{ x: 100, y: 0 }], 520, AIM.coneDegrees, () => false)).toBeNull();
    expect(pickAimTarget(origin, 1, [], 520, AIM.coneDegrees, see)).toBeNull();
  });
});

describe('investida', () => {
  it('o escudo dá invulnerabilidade temporária sem encurtar a que já existe', () => {
    const h = new Health(100, 0.8);
    h.shield(10, 0.25);
    expect(h.damage(10, 10.1)).toBe(0);
    expect(h.damage(10, 10.3)).toBe(10);      // agora vale a invulnerabilidade normal (até 11.1)
    h.shield(10.4, 0.1);
    expect(h.isInvulnerable(11)).toBe(true);
  });
});

describe('reparo', () => {
  it('restaura a resistência cobrando proporcionalmente ao dano', () => {
    const { building, resources, ctx, events } = makeWorld(100);
    building.place('stone_block', 12, 9, ctx);                    // custo 20
    const max = blockById('stone_block').maxHp;
    building.damage(12, 9, max / 2);
    expect(building.repairCost(12, 9)).toBe(5);                   // metade do custo x metade do dano
    const before = resources.value;
    expect(building.repair(12, 9, ctx)).toEqual({ ok: true, cost: 5 });
    expect(building.hpAt(12, 9)).toBe(max);
    expect(resources.value).toBe(before - 5);
    expect(events.at(-1)?.type).toBe('repaired');
  });

  it('recusa peça inteira, peça alheia, vazio, longe e sem materiais', () => {
    const { building, resources, ctx } = makeWorld(100);
    building.place('stone_block', 12, 9, ctx);
    expect(building.checkRepair(12, 9, ctx).reason).toBe('not_damaged');
    expect(building.checkRepair(12, 10, ctx).reason).toBe('not_owned');
    expect(building.checkRepair(13, 9, ctx).reason).toBe('nothing_to_remove');
    building.damage(12, 9, 100);
    expect(building.checkRepair(12, 9, ctxAt(1, 9)).reason).toBe('out_of_reach');
    resources.spend(resources.value);
    const r = building.repair(12, 9, ctx);
    expect(r.reason).toBe('insufficient_resources');
    expect(building.hpAt(12, 9)).toBeLessThan(blockById('stone_block').maxHp);
    expect(resources.value).toBe(0);
  });

  it('reparar custa menos do que demolir e reconstruir', () => {
    const { building, ctx } = makeWorld(100);
    building.place('stone_block', 12, 9, ctx);
    building.damage(12, 9, blockById('stone_block').maxHp * 0.9);
    const rebuild = blockById('stone_block').cost - building.refundFor(12, 9);
    expect(building.repairCost(12, 9)).toBeLessThan(rebuild);
  });
});

describe('melhorias', () => {
  it('cada preparo oferece a cura mais algumas melhorias distintas, sorteadas', () => {
    const m = createMatch();
    expect(m.offers).toHaveLength(UPGRADE_OFFERS + 1);
    expect(new Set(m.offers).size).toBe(UPGRADE_OFFERS + 1);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      rollOffers(m);
      expect(m.offers[0]).toBe('heal');                  // a cura nunca depende de sorte
      m.offers.forEach((o) => seen.add(o));
    }
    expect(seen.size).toBe(UPGRADE_IDS.length);
    rollOffers(m, () => 0);
    expect(m.offers).toEqual(['heal', ...UPGRADE_IDS.filter((id) => id !== 'heal').slice(0, UPGRADE_OFFERS)]);
  });

  it('compra desconta materiais, aplica o efeito e sai da oferta', () => {
    const m = createMatch();
    m.offers = ['damage', 'fireRate', 'heal'];
    const before = m.resources.value;
    expect(buyUpgrade(m, 'damage')).toBe(true);
    expect(m.resources.value).toBe(before - UPGRADES.damage.cost);
    expect(m.mods.damage).toBeCloseTo(1.2);
    expect(m.offers).toEqual(['fireRate', 'heal']);
    expect(buyUpgrade(m, 'damage')).toBe(false);                   // já comprada neste preparo
    expect(buyUpgrade(m, 'fireRate')).toBe(true);
    expect(m.mods.shotCooldown).toBeCloseTo(0.85);
  });

  it('não vende o que não está em oferta, nem cura com a vida cheia, nem sem saldo', () => {
    const m = createMatch();
    m.offers = ['heal', 'maxHp', 'speed'];
    const before = m.resources.value;
    expect(buyUpgrade(m, 'turret')).toBe(false);
    expect(buyUpgrade(m, 'heal')).toBe(false);
    expect(m.resources.value).toBe(before);
    m.playerHealth.damage(50, 0);
    expect(buyUpgrade(m, 'heal')).toBe(true);
    expect(m.playerHealth.hp).toBe(90);
    expect(m.offers).toContain('heal');                            // a cura pode repetir
    m.resources.spend(m.resources.value);
    expect(buyUpgrade(m, 'maxHp')).toBe(false);
    expect(m.playerHealth.max).toBe(100);
  });

  it('todas as melhorias têm efeito', () => {
    for (const id of UPGRADE_IDS) {
      const m = createMatch();
      m.resources.add(500);
      m.playerHealth.damage(30, 0);
      m.offers = [id];
      const snapshot = JSON.stringify([m.mods, m.playerHealth.hp, m.playerHealth.max]);
      expect(buyUpgrade(m, id), id).toBe(true);
      expect(JSON.stringify([m.mods, m.playerHealth.hp, m.playerHealth.max]), id).not.toBe(snapshot);
    }
  });
});

describe('arenas', () => {
  for (const id of ARENA_IDS) {
    it(`${id}: herói e portais em lugar válido, chão caminhável`, () => {
      const level = buildArena(id);
      const m = createMatch(id);
      const b = m.building;
      expect(level.id).toBe(id);
      const { x, y } = level.playerSpawn;
      expect(b.get(x, y).id).toBe('empty');
      expect(b.get(x, y - 1).id).toBe('empty');
      for (const s of level.enemySpawns) {
        expect(b.get(s.x, s.y).id).toBe('empty');
        expect(b.blocks('enemy', s.x, s.y + 1)).toBe(true);
      }
      // Altura do terreno por coluna: degraus de no máximo 1 tile, para os inimigos chegarem.
      const top = (col: number): number => {
        for (let row = 0; row < b.rows; row++) if (b.get(col, row).id === 'terrain') return row;
        return b.rows;
      };
      for (let col = 1; col < b.cols; col++) expect(Math.abs(top(col) - top(col - 1)), `coluna ${col}`).toBeLessThanOrEqual(1);
      // O herói nasce no ar, no máximo alguns tiles acima do chão.
      expect(top(x) - y).toBeGreaterThanOrEqual(1);
      expect(top(x) - y).toBeLessThanOrEqual(3);
    });
  }

  it('as arenas são diferentes entre si', () => {
    const cells = ARENA_IDS.map((id) => buildArena(id).cells.join(''));
    expect(new Set(cells).size).toBe(ARENA_IDS.length);
  });
});

describe('ondas com os novos inimigos', () => {
  const count = (n: number, t: EnemyType): number => composeWave(n).enemies.filter((e) => e === t).length;

  it('cada tipo estreia na sua onda', () => {
    for (const type of Object.keys(FIRST_WAVE) as EnemyType[]) {
      expect(count(FIRST_WAVE[type], type), type).toBeGreaterThan(0);
      if (FIRST_WAVE[type] > 1) expect(count(FIRST_WAVE[type] - 1, type), type).toBe(0);
    }
  });

  it('o chefe vem a cada 5 ondas, sozinho no cargo e com escolta menor', () => {
    for (let n = 1; n <= 20; n++) {
      const w = composeWave(n);
      expect(w.boss).toBe(n % 5 === 0);
      expect(count(n, 'boss')).toBe(n % 5 === 0 ? 1 : 0);
    }
    expect(composeWave(5).enemies.length).toBeLessThan(composeWave(4).enemies.length + 2);
    expect(composeWave(5).reward).toBeGreaterThan(composeWave(6).reward - 60);
  });

  it('a vida dos inimigos sobe com as ondas', () => {
    expect(composeWave(1).hpScale).toBe(1);
    expect(composeWave(10).hpScale).toBeGreaterThan(composeWave(5).hpScale);
  });

  it('todo inimigo tem definição coerente com o comportamento', () => {
    for (const def of Object.values(ENEMY_DEFS)) {
      expect(def.maxHp).toBeGreaterThan(0);
      expect(def.body.width).toBeLessThanOrEqual(def.frame.width);
      expect(def.body.height).toBeLessThanOrEqual(def.frame.height);
      expect(def.behavior === 'ranged').toBe(def.ranged !== undefined);
    }
  });
});

describe('teclas e novas configurações', () => {
  it('remapeia uma ação e persiste', () => {
    const storage = new MemoryStorage();
    const a = new SaveSystem(storage);
    expect(a.rebind('jump', 'W')).toBe(true);
    expect(new SaveSystem(storage).data.settings.bindings.jump).toEqual(['W']);
  });

  it('tecla já usada troca com a outra ação, sem duplicar nem deixar ação sem tecla', () => {
    const s = new SaveSystem(new MemoryStorage());
    s.rebind('melee', 'K');                         // K era do disparo
    const b = s.data.settings.bindings;
    expect(b.melee).toEqual(['K']);
    expect(b.shoot).toEqual(['J']);                 // herdou a tecla antiga do golpe
    const all = (Object.keys(b) as Action[]).flatMap((k) => b[k]);
    expect(new Set(all).size).toBe(all.length);
    for (const k of Object.keys(b) as Action[]) expect(b[k].length).toBeGreaterThan(0);
  });

  it('recusa nome de tecla inválido e restaura o padrão', () => {
    const s = new SaveSystem(new MemoryStorage());
    expect(s.rebind('jump', 'tecla ruim')).toBe(false);
    s.rebind('jump', 'W');
    s.resetBindings();
    expect(s.data.settings.bindings).toEqual(DEFAULT_BINDINGS);
  });

  it('salva arena, música e modo de toque; valores inválidos voltam ao padrão', () => {
    const storage = new MemoryStorage();
    const a = new SaveSystem(storage);
    a.updateSettings({ arena: 'vale', music: false, touch: 'on' });
    const b = new SaveSystem(storage).data.settings;
    expect([b.arena, b.music, b.touch]).toEqual(['vale', false, 'on']);
    const bad = restore(JSON.stringify({ settings: { arena: 'lua', music: 'sim', touch: 3 } })).settings;
    expect([bad.arena, bad.music, bad.touch]).toEqual(['colina', true, 'auto']);
  });

  it('um salvamento antigo (sem as teclas novas) ganha os padrões delas', () => {
    const old = JSON.parse(serialize(new SaveSystem(null).data));
    delete old.settings.bindings.dash;
    delete old.settings.bindings.repair;
    old.settings.bindings.jump = ['W'];
    const d = restore(JSON.stringify(old));
    expect(d.settings.bindings.dash).toEqual(DEFAULT_BINDINGS.dash);
    expect(d.settings.bindings.repair).toEqual(DEFAULT_BINDINGS.repair);
    expect(d.settings.bindings.jump).toEqual(['W']);
  });
});
