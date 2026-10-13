import { describe, expect, it } from 'vitest';
import { Cooldown, explosionDamage, Health, SwingTracker } from '../src/game/systems/CombatSystem';
import { selectTurretTarget, SpikeTimer } from '../src/game/world/Trap';

describe('vida e dano', () => {
  it('aplica dano e detecta a morte', () => {
    const h = new Health(40);
    expect(h.damage(15, 0)).toBe(15);
    expect(h.hp).toBe(25);
    expect(h.dead).toBe(false);
    expect(h.damage(100, 1)).toBe(25);
    expect(h.hp).toBe(0);
    expect(h.dead).toBe(true);
  });

  it('morto não recebe mais dano nem cura', () => {
    const h = new Health(10);
    h.damage(10, 0);
    expect(h.damage(5, 1)).toBe(0);
    expect(h.heal(5)).toBe(0);
    expect(h.hp).toBe(0);
  });

  it('ignora valores inválidos', () => {
    const h = new Health(10);
    expect(h.damage(-5, 0)).toBe(0);
    expect(h.damage(Number.NaN, 0)).toBe(0);
    expect(h.hp).toBe(10);
  });

  it('invulnerabilidade temporária após o dano', () => {
    const h = new Health(100, 0.8);
    expect(h.damage(10, 5)).toBe(10);
    expect(h.damage(10, 5.5)).toBe(0);
    expect(h.isInvulnerable(5.5)).toBe(true);
    expect(h.damage(10, 5.9)).toBe(10);
    expect(h.hp).toBe(80);
  });

  it('cura não passa do máximo', () => {
    const h = new Health(50);
    h.damage(10, 0);
    expect(h.heal(40)).toBe(10);
    expect(h.hp).toBe(50);
  });
});

describe('golpes e recargas', () => {
  it('um golpe atinge cada alvo uma única vez', () => {
    const s = new SwingTracker();
    s.begin(0, 0.14);
    let hits = 0;
    // O golpe fica ativo por ~8 quadros; o mesmo alvo é testado em todos.
    for (let f = 0; f < 8; f++) if (s.tryHit(7, f / 60)) hits++;
    expect(hits).toBe(1);
    expect(s.tryHit(8, 0.05)).toBe(true);
  });

  it('golpe expirado não atinge; um novo golpe atinge de novo', () => {
    const s = new SwingTracker();
    s.begin(0, 0.14);
    expect(s.tryHit(1, 0.2)).toBe(false);
    s.begin(1, 0.14);
    expect(s.tryHit(1, 1.01)).toBe(true);
  });

  it('recarga impede uso repetido', () => {
    const c = new Cooldown();
    expect(c.trigger(0, 0.3)).toBe(true);
    expect(c.trigger(0.1, 0.3)).toBe(false);
    expect(c.fraction(0.15)).toBeCloseTo(0.5);
    expect(c.trigger(0.31, 0.3)).toBe(true);
  });

  it('dano de explosão cai com a distância', () => {
    expect(explosionDamage(70, 0, 80)).toBe(70);
    expect(explosionDamage(70, 40, 80)).toBe(49);
    expect(explosionDamage(70, 80, 80)).toBe(0);
    expect(explosionDamage(70, 200, 80)).toBe(0);
  });
});

describe('armadilhas', () => {
  const foes = [
    { id: 1, x: 300, y: 0, alive: true },
    { id: 2, x: 100, y: 0, alive: true },
    { id: 3, x: 50, y: 0, alive: false },
    { id: 4, x: 60, y: 0, alive: true },
  ];

  it('torreta escolhe o inimigo vivo mais próximo no raio', () => {
    expect(selectTurretTarget(0, 0, foes, 224, () => true)?.id).toBe(4);
  });

  it('torreta ignora alvos sem linha de visão ou fora do raio', () => {
    expect(selectTurretTarget(0, 0, foes, 224, (x) => x !== 60)?.id).toBe(2);
    expect(selectTurretTarget(0, 0, foes, 40, () => true)).toBeNull();
  });

  it('espinhos respeitam o intervalo por inimigo', () => {
    const t = new SpikeTimer();
    expect(t.tryDamage(1, 0, 0.5)).toBe(true);
    expect(t.tryDamage(1, 0.2, 0.5)).toBe(false);
    expect(t.tryDamage(2, 0.2, 0.5)).toBe(true);
    expect(t.tryDamage(1, 0.5, 0.5)).toBe(true);
  });
});
