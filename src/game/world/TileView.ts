import Phaser from 'phaser';
import { TILE } from '../config';
import type { BuildingSystem } from '../systems/BuildingSystem';
import { frameFor } from './TileRegistry';

/**
 * Espelha a grade do BuildingSystem em um Tilemap do Phaser e mantém a
 * colisão em dia. As faces de colisão são calculadas aqui (e não pelo
 * recálculo automático do Phaser) porque plataformas atravessáveis e
 * paredes "só para inimigos" não podem apagar as faces dos vizinhos.
 */
export class TileView {
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  private cracks = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene, private readonly building: BuildingSystem) {
    const map = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: building.cols, height: building.rows });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) throw new Error('Tileset "tiles" não foi gerado');
    const layer = map.createBlankLayer('world', tileset);
    if (!layer) throw new Error('Não foi possível criar a camada do mundo');
    this.layer = layer;
    this.layer.setDepth(10);
    building.forEach((x, y) => this.putTile(x, y));
    for (let y = 0; y < building.rows; y++) for (let x = 0; x < building.cols; x++) this.applyCollision(x, y);
  }

  /** Reflete a célula (x, y) depois de uma mudança na grade. */
  sync(x: number, y: number): void {
    this.putTile(x, y);
    for (let ny = y - 1; ny <= y + 1; ny++) for (let nx = x - 1; nx <= x + 1; nx++) this.applyCollision(nx, ny);
    this.setDamage(x, y);
  }

  private putTile(x: number, y: number): void {
    if (this.building.get(x, y).id === 'empty') this.layer.removeTileAt(x, y, true, false);
    else this.layer.putTileAt(frameFor(this.building, x, y), x, y, false);
  }

  private applyCollision(x: number, y: number): void {
    if (!this.building.inBounds(x, y)) return;
    const tile = this.layer.getTileAt(x, y);
    if (!tile) return;
    const kind = this.building.get(x, y).collision;
    const kindAt = (dx: number, dy: number): string => this.building.get(x + dx, y + dy).collision;
    if (kind === 'none') {
      tile.setCollision(false, false, false, false, false);
    } else if (kind === 'oneway') {
      tile.setCollision(false, false, true, false, false);
      tile.faceTop = kindAt(0, -1) !== 'solid';
      tile.faceBottom = tile.faceLeft = tile.faceRight = false;
    } else {
      tile.setCollision(true, true, true, true, false);
      // Face interna só some entre dois blocos do mesmo "mundo de colisão".
      const merged = (dx: number, dy: number): boolean => {
        const k = kindAt(dx, dy);
        return k === 'solid' || (kind === 'enemy_only' && k === 'enemy_only');
      };
      tile.faceLeft = !merged(-1, 0);
      tile.faceRight = !merged(1, 0);
      tile.faceTop = !merged(0, -1);
      tile.faceBottom = !merged(0, 1);
    }
  }

  /** Mostra rachaduras conforme a resistência restante do bloco. */
  setDamage(x: number, y: number): void {
    const key = y * this.building.cols + x;
    const def = this.building.get(x, y);
    const ratio = Number.isFinite(def.maxHp) && def.id !== 'empty' ? this.building.hpAt(x, y) / def.maxHp : 1;
    let img = this.cracks.get(key);
    if (ratio >= 0.7) {
      if (img) { img.destroy(); this.cracks.delete(key); }
      return;
    }
    if (!img) {
      img = this.scene.add.image(x * TILE, y * TILE, 'cracks', 0).setOrigin(0).setDepth(11);
      this.cracks.set(key, img);
    }
    img.setFrame(ratio < 0.35 ? 1 : 0);
  }
}
