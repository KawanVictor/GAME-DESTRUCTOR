import { describe, expect, it } from 'vitest';
import { blockById, BUILDABLE } from '../src/game/data/blocks';
import { createMatch } from '../src/game/systems/MatchState';
import { ctxAt, makeWorld } from './helpers';

describe('recursos e custos', () => {
  it('desconta o custo exato ao construir', () => {
    const { building, resources, ctx } = makeWorld(100);
    const r = building.place('stone_block', 12, 9, ctx);
    expect(r.ok).toBe(true);
    expect(resources.value).toBe(100 - blockById('stone_block').cost);
    expect(building.get(12, 9).id).toBe('stone_block');
    expect(building.isOwned(12, 9)).toBe(true);
  });

  it('não desconta quando a construção é recusada', () => {
    const { building, resources, ctx } = makeWorld(100);
    expect(building.place('stone_block', 12, 5, ctx).ok).toBe(false);
    expect(resources.value).toBe(100);
  });

  it('recusa sem materiais e nunca fica negativo', () => {
    const { building, resources, ctx } = makeWorld(25);
    expect(building.place('stone_block', 12, 9, ctx).ok).toBe(true);
    const r = building.place('stone_block', 13, 9, ctx);
    expect(r).toMatchObject({ ok: false, reason: 'insufficient_resources' });
    expect(resources.value).toBe(5);
    expect(resources.spend(6)).toBe(false);
    expect(resources.spend(-3)).toBe(false);
    expect(resources.value).toBe(5);
  });

  it('não cobra duas vezes pela mesma célula', () => {
    const { building, resources, ctx } = makeWorld(100);
    building.place('wood_platform', 12, 9, ctx);
    const again = building.place('wood_platform', 12, 9, ctx);
    expect(again).toMatchObject({ ok: false, reason: 'occupied' });
    expect(resources.value).toBe(90);
  });

  it('há pelo menos 5 peças e 2 armadilhas no registro', () => {
    expect(BUILDABLE.filter((b) => !b.trap).length).toBeGreaterThanOrEqual(5);
    expect(BUILDABLE.filter((b) => b.trap).length).toBe(2);
    for (const b of BUILDABLE) expect(b.cost).toBeGreaterThan(0);
  });
});

describe('validação de posicionamento', () => {
  it('recusa fora do mapa', () => {
    const { building, ctx } = makeWorld();
    expect(building.check('stone_block', -1, 9, ctx).reason).toBe('out_of_bounds');
    expect(building.check('stone_block', 10, 99, ctx).reason).toBe('out_of_bounds');
  });

  it('recusa peça flutuando e aceita encostada', () => {
    const { building, ctx } = makeWorld();
    expect(building.check('wood_platform', 12, 6, ctx).reason).toBe('needs_support');
    expect(building.place('stone_block', 12, 9, ctx).ok).toBe(true);
    expect(building.place('stone_block', 12, 8, ctx).ok).toBe(true);
    expect(building.check('wood_platform', 13, 8, ctx).ok).toBe(true);
  });

  it('recusa fora de alcance', () => {
    const { building, ctx } = makeWorld();
    expect(building.check('stone_block', 19, 9, ctx).reason).toBe('out_of_reach');
  });

  it('recusa bloco sólido em cima do herói ou de um inimigo', () => {
    const { building } = makeWorld();
    expect(building.check('stone_block', 10, 9, ctxAt(10, 9)).reason).toBe('entity_in_way');
    expect(building.check('stone_block', 13, 9, ctxAt(10, 9, [[13, 9]])).reason).toBe('entity_in_way');
    // Plataforma atravessável pode ficar onde o herói está.
    expect(building.check('wood_platform', 10, 9, ctxAt(10, 9)).ok).toBe(true);
  });

  it('recusa na área protegida do portal', () => {
    const { building } = makeWorld();
    expect(building.check('stone_block', 2, 9, ctxAt(4, 9)).reason).toBe('protected_zone');
  });

  it('armadilhas exigem base sólida', () => {
    const { building, ctx } = makeWorld();
    expect(building.check('spike_trap', 12, 8, ctx).reason).toBe('needs_floor');
    expect(building.check('spike_trap', 12, 9, ctx).ok).toBe(true);
    building.place('wood_platform', 13, 9, ctx);
    expect(building.check('turret', 13, 8, ctx).reason).toBe('needs_floor');
  });

  it('não deixa emparedar o herói', () => {
    const { building, ctx } = makeWorld(1000);
    // Fecha os lados e monta o teto ao redor do herói em (10, 9).
    for (const [x, y] of [[9, 9], [11, 9], [9, 8], [11, 8], [9, 7], [11, 7]]) {
      expect(building.place('stone_block', x, y, ctx).ok).toBe(true);
    }
    expect(building.check('stone_block', 10, 7, ctx).reason).toBe('would_trap_player');
    // Parede defensiva não prende: o herói atravessa.
    expect(building.check('defensive_wall', 10, 7, ctx).ok).toBe(true);
  });

  it('parede defensiva bloqueia inimigos, mas não o herói', () => {
    const { building, ctx } = makeWorld();
    building.place('defensive_wall', 12, 9, ctx);
    expect(building.blocks('enemy', 12, 9)).toBe(true);
    expect(building.blocks('player', 12, 9)).toBe(false);
  });
});

describe('remoção e destruição', () => {
  it('demolição devolve metade do custo', () => {
    const { building, resources, ctx, events } = makeWorld(100);
    building.place('stone_block', 12, 9, ctx);
    const r = building.remove(12, 9, ctx);
    expect(r).toEqual({ ok: true, refund: 10 });
    expect(resources.value).toBe(90);
    expect(building.get(12, 9).id).toBe('empty');
    expect(events.map((e) => e.type)).toEqual(['placed', 'removed']);
  });

  it('colocar e demolir em sequência não gera materiais', () => {
    const { building, resources, ctx } = makeWorld(100);
    for (let i = 0; i < 6; i++) {
      building.place('stone_block', 12, 9, ctx);
      building.remove(12, 9, ctx);
    }
    expect(resources.value).toBeLessThan(100);
    expect(resources.value).toBe(100 - 6 * 10);
  });

  it('peça danificada devolve menos', () => {
    const { building, ctx } = makeWorld(100);
    building.place('stone_block', 12, 9, ctx);
    building.damage(12, 9, blockById('stone_block').maxHp / 2);
    expect(building.remove(12, 9, ctx).refund).toBe(5);
  });

  it('só demole peças do jogador e dentro do alcance', () => {
    const { building, ctx } = makeWorld();
    expect(building.remove(12, 10, ctx).reason).toBe('not_owned');
    expect(building.remove(12, 9, ctx).reason).toBe('nothing_to_remove');
    building.place('stone_block', 12, 9, ctx);
    expect(building.remove(12, 9, ctxAt(1, 9)).reason).toBe('out_of_reach');
    expect(building.get(12, 9).id).toBe('stone_block');
  });

  it('bloco perde resistência e é destruído sem reembolso', () => {
    const { building, resources, ctx, events } = makeWorld(100);
    building.place('wood_platform', 12, 9, ctx);
    const before = resources.value;
    expect(building.damage(12, 9, 20)).toBe('damaged');
    expect(building.hpAt(12, 9)).toBe(25);
    expect(building.damage(12, 9, 30)).toBe('destroyed');
    expect(building.get(12, 9).id).toBe('empty');
    expect(building.blocks('enemy', 12, 9)).toBe(false);
    expect(resources.value).toBe(before);
    expect(events.at(-1)?.type).toBe('destroyed');
  });

  it('terreno é indestrutível', () => {
    const { building } = makeWorld();
    expect(building.damage(5, 10, 9999)).toBe('none');
    expect(building.get(5, 10).id).toBe('terrain');
  });

  it('bloco explosivo explode ao ser destruído e danifica vizinhos', () => {
    const { building, ctx, events } = makeWorld(500);
    building.place('explosive_block', 12, 9, ctx);
    building.place('wood_platform', 13, 9, ctx);
    building.place('stone_block', 11, 9, ctx);
    building.damage(12, 9, 999);
    expect(events.filter((e) => e.type === 'explosion')).toHaveLength(1);
    expect(building.get(12, 9).id).toBe('empty');
    expect(building.get(13, 9).id).toBe('empty');            // madeira não aguenta
    expect(building.get(11, 9).id).toBe('stone_block');      // pedra aguenta, danificada
    expect(building.hpAt(11, 9)).toBeLessThan(blockById('stone_block').maxHp);
  });

  it('explosivos em cadeia detonam todos uma única vez', () => {
    const { building, ctx, events } = makeWorld(500);
    for (const x of [12, 13, 14]) building.place('explosive_block', x, 9, ctx);
    building.damage(12, 9, 999);
    expect(events.filter((e) => e.type === 'explosion')).toHaveLength(3);
    for (const x of [12, 13, 14]) expect(building.get(x, 9).id).toBe('empty');
  });

  it('armadilha cai quando perde a base', () => {
    const { building, ctx } = makeWorld(500);
    building.place('stone_block', 12, 9, ctx);
    building.place('turret', 12, 8, ctx);
    building.remove(12, 9, ctx);
    expect(building.get(12, 8).id).toBe('empty');
  });
});

describe('reinício de partida', () => {
  it('uma nova partida começa do zero', () => {
    const a = createMatch();
    const spawn = a.level.playerSpawn;
    const ctx = ctxAt(spawn.x, spawn.y);
    expect(a.building.place('stone_block', spawn.x + 3, spawn.y + 1, ctx).ok).toBe(true);
    a.playerHealth.damage(60, 0);
    a.kills = 9;
    a.outcome = 'defeat';

    const b = createMatch();
    expect(b.resources.value).toBeGreaterThan(a.resources.value);
    expect(b.building.countOwned()).toBe(0);
    expect(b.building.get(spawn.x + 3, spawn.y + 1).id).toBe('empty');
    expect(b.playerHealth.hp).toBe(b.playerHealth.max);
    expect(b.kills).toBe(0);
    expect(b.outcome).toBe('playing');
    // A arena é reconstruída, não compartilhada.
    expect(b.level.cells).not.toBe(a.level.cells);
  });
});
