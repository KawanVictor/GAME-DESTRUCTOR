import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { PLATFORM_INDEX, WALL_INDEX } from '../world/TileRegistry';

type Tile = Phaser.Tilemaps.Tile;

export interface CollisionRefs {
  player: Player;
  layer: Phaser.Tilemaps.TilemapLayer;
  enemies: Phaser.GameObjects.Group;
  pickups: Phaser.GameObjects.Group;
  bullets: Phaser.Physics.Arcade.Group;
  turretBullets: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
}

export interface CollisionHandlers {
  bulletHitsTile(bullet: Projectile, tileX: number, tileY: number): void;
  bulletHitsEnemy(bullet: Projectile, enemy: Enemy): void;
  turretBulletHitsTile(bullet: Projectile): void;
  enemyBulletHitsTile(bullet: Projectile, tileX: number, tileY: number): void;
  enemyBulletHitsPlayer(bullet: Projectile): void;
  enemyTouchesPlayer(enemy: Enemy): void;
  playerCollects(pickup: Phaser.Physics.Arcade.Image): void;
}

/**
 * Registra, em um só lugar, quem colide com quem. Cada par é registrado uma
 * única vez por cena; como a cena é recriada no reinício, não há duplicatas.
 */
export function setupCollisions(scene: Phaser.Scene, r: CollisionRefs, h: CollisionHandlers): void {
  const physics = scene.physics;

  // Herói x cenário: atravessa paredes defensivas e, ao descer, plataformas.
  physics.add.collider(r.player, r.layer, undefined, (_p, t) => {
    const tile = t as Tile;
    if (tile.index === WALL_INDEX) return false;
    return !(tile.index === PLATFORM_INDEX && r.player.dropTimer > 0);
  });

  physics.add.collider(r.enemies, r.layer);
  physics.add.collider(r.pickups, r.layer);

  // Projéteis x cenário: os do herói e das torretas passam pelas paredes defensivas.
  const passesWalls = (_b: unknown, t: unknown): boolean => (t as Tile).index !== WALL_INDEX;
  physics.add.collider(r.bullets, r.layer, (b, t) => {
    const tile = t as Tile;
    h.bulletHitsTile(b as Projectile, tile.x, tile.y);
  }, passesWalls);
  physics.add.collider(r.turretBullets, r.layer, (a, b) => h.turretBulletHitsTile((a instanceof Projectile ? a : b) as Projectile), passesWalls);

  // Grupo x grupo: o Phaser não garante a ordem dos argumentos, então
  // identificamos o projétil pelo tipo em vez de confiar na posição.
  const hitEnemy = (a: unknown, b: unknown): void => {
    const bullet = (a instanceof Projectile ? a : b) as Projectile;
    const enemy = (a instanceof Projectile ? b : a) as Enemy;
    if (bullet.active && enemy.alive) h.bulletHitsEnemy(bullet, enemy);
  };
  physics.add.overlap(r.bullets, r.enemies, hitEnemy);
  physics.add.overlap(r.turretBullets, r.enemies, hitEnemy);

  // Disparos inimigos: qualquer bloco (inclusive a parede defensiva) serve de cobertura.
  physics.add.collider(r.enemyBullets, r.layer, (b, t) => {
    const tile = t as Tile;
    h.enemyBulletHitsTile(b as Projectile, tile.x, tile.y);
  });
  physics.add.overlap(r.player, r.enemyBullets, (a, b) => h.enemyBulletHitsPlayer((a instanceof Projectile ? a : b) as Projectile));

  physics.add.overlap(r.player, r.enemies, (_p, e) => {
    const enemy = e as Enemy;
    if (enemy.alive) h.enemyTouchesPlayer(enemy);
  });
  physics.add.overlap(r.player, r.pickups, (_p, k) => h.playerCollects(k as Phaser.Physics.Arcade.Image));
}
