import { describe, expect, it } from 'vitest';
import { composeWave } from '../src/game/data/enemies';
import { WaveSystem } from '../src/game/systems/WaveSystem';
import type { EnemyType, WaveDef } from '../src/game/types/game';

function setup(total = 3, maxActive = 99) {
  let nextId = 1;
  const alive: number[] = [];
  const spawned: EnemyType[] = [];
  const completed: number[] = [];
  let victory = 0;
  const waves = new WaveSystem({
    total, firstPreparation: 5, preparation: 8, completedPause: 2,
    compose: (n): WaveDef => ({ number: n, enemies: Array<EnemyType>(n + 1).fill('basic'), spawnInterval: 1, reward: 10 * n, boss: false, hpScale: 1 }),
    spawn: (type) => {
      if (alive.length >= maxActive) return null;
      spawned.push(type);
      alive.push(nextId);
      return nextId++;
    },
    onWaveComplete: (d) => completed.push(d.number),
    onVictory: () => { victory++; },
  });
  const run = (seconds: number): void => { for (let t = 0; t < seconds; t += 0.1) waves.update(0.1); };
  const killAll = (): void => { while (alive.length) waves.enemyRemoved(alive.pop() as number); };
  return { waves, alive, spawned, completed, run, killAll, victory: () => victory };
}

describe('sistema de ondas', () => {
  it('começa em preparo e só inicia após a contagem', () => {
    const { waves, spawned, run } = setup();
    expect(waves.phase).toBe('preparing');
    run(4);
    expect(waves.phase).toBe('preparing');
    expect(spawned).toHaveLength(0);
    run(1.5);
    expect(waves.phase).toBe('fighting');
    expect(waves.number).toBe(1);
  });

  it('startNow encerra o preparo', () => {
    const { waves, run } = setup();
    waves.startNow();
    run(0.1);
    expect(waves.phase).toBe('fighting');
  });

  it('surge um inimigo por intervalo e conta os restantes', () => {
    const { waves, spawned, run } = setup();
    waves.startNow();
    run(0.1);
    expect(waves.remaining).toBe(2);
    run(0.6);
    expect(spawned).toHaveLength(1);
    expect(waves.remaining).toBe(2);       // 1 vivo + 1 na fila
    run(1.2);
    expect(spawned).toHaveLength(2);
  });

  it('a onda só termina quando todos os seus inimigos morrem', () => {
    const { waves, alive, completed, run } = setup();
    waves.startNow();
    run(5);
    expect(alive).toHaveLength(2);
    expect(waves.phase).toBe('fighting');
    waves.enemyRemoved(alive.pop() as number);
    run(1);
    expect(waves.phase).toBe('fighting');
    expect(waves.remaining).toBe(1);
    waves.enemyRemoved(alive.pop() as number);
    run(0.1);
    expect(waves.phase).toBe('completed');
    expect(completed).toEqual([1]);
  });

  it('ids desconhecidos (projéteis, armadilhas, avulsos) não afetam a contagem', () => {
    const { waves, run } = setup();
    waves.startNow();
    run(5);
    waves.enemyRemoved(9999);
    waves.enemyRemoved(-1);
    expect(waves.remaining).toBe(2);
    expect(waves.phase).toBe('fighting');
  });

  it('remover o mesmo inimigo duas vezes não conta em dobro', () => {
    const { waves, alive, run } = setup();
    waves.startNow();
    run(5);
    const id = alive.pop() as number;
    waves.enemyRemoved(id);
    waves.enemyRemoved(id);
    expect(waves.remaining).toBe(1);
  });

  it('depois de concluir, prepara a próxima e avança o número', () => {
    const { waves, run, killAll } = setup();
    waves.startNow();
    run(5); killAll(); run(0.2);
    expect(waves.phase).toBe('completed');
    run(2.2);
    expect(waves.phase).toBe('preparing');
    expect(waves.number).toBe(2);
    expect(waves.timer).toBeGreaterThan(7);
    run(8.2);
    expect(waves.phase).toBe('fighting');
    expect(waves.remaining).toBe(3);
  });

  it('vitória após a última onda, com opção de continuar', () => {
    const s = setup(2);
    for (let n = 0; n < 2; n++) { s.waves.startNow(); s.run(6); s.killAll(); s.run(2.5); }
    expect(s.waves.phase).toBe('victory');
    expect(s.victory()).toBe(1);
    expect(s.waves.completed).toBe(2);
    s.waves.continueEndless();
    expect(s.waves.phase).toBe('preparing');
    expect(s.waves.number).toBe(3);
    s.waves.startNow(); s.run(8); s.killAll(); s.run(2.5);
    expect(s.waves.phase).toBe('preparing');
    expect(s.waves.number).toBe(4);
  });

  it('respeita o limite de inimigos ativos sem perder ninguém da fila', () => {
    const s = setup(3, 1);
    s.waves.startNow();
    s.run(5);
    expect(s.spawned).toHaveLength(1);
    expect(s.waves.remaining).toBe(2);
    s.killAll(); s.run(1);
    expect(s.spawned).toHaveLength(2);
    s.killAll(); s.run(0.2);
    expect(s.waves.phase).toBe('completed');
  });
});

describe('composição das ondas', () => {
  it('a primeira onda é fácil e só tem o inimigo básico', () => {
    const w = composeWave(1);
    expect(w.enemies).toEqual(['basic', 'basic', 'basic']);
  });

  it('fora das ondas de chefe, cresce em quantidade, ritmo e recompensa', () => {
    const normal = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12].map(composeWave);
    for (let i = 1; i < normal.length; i++) {
      expect(normal[i].enemies.length).toBeGreaterThan(normal[i - 1].enemies.length);
      expect(normal[i].spawnInterval).toBeLessThanOrEqual(normal[i - 1].spawnInterval);
      expect(normal[i].reward).toBeGreaterThan(normal[i - 1].reward);
    }
  });
});
