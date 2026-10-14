import Phaser from 'phaser';
import { BOSS_SLAM, GRAVITY, TILE } from '../config';
import { ENEMY_DEFS } from '../data/enemies';
import type { BuildingSystem } from '../systems/BuildingSystem';
import { Cooldown, Health } from '../systems/CombatSystem';
import type { EnemyDef, EnemyType, Rect } from '../types/game';

export type EnemyState = 'patrol' | 'chase' | 'attack' | 'hurt' | 'dead';

/** O que o inimigo precisa enxergar do mundo a cada quadro. */
export interface EnemyWorld {
  now: number;
  building: BuildingSystem;
  target: { x: number; y: number; bottom: number; alive: boolean };
  spawnPoints: ReadonlyArray<{ x: number; y: number }>;
  /** Golpe em um bloco (a cena aplica o dano e os efeitos). */
  hitBlock(x: number, y: number, damage: number): void;
  /** Disparo de um inimigo de longo alcance, de (x, y) em direção ao alvo. */
  shoot(enemy: Enemy, x: number, y: number, targetX: number, targetY: number): void;
  /** Golpe de área do chefe ao aterrissar. */
  slam(enemy: Enemy): void;
  onRecovered(enemy: Enemy): void;
}

let nextId = 1;

/**
 * Inimigo com máquina de estados simples:
 *   patrol -> chase -> attack (herói ou bloco) ; hurt ao apanhar ; dead.
 * O `behavior` da definição escolhe como ele se move:
 *   ground — anda, pula o que consegue e demole o que não consegue;
 *   flyer  — voa por cima das barreiras e mergulha no herói;
 *   ranged — mantém distância e atira quando tem linha de visão;
 *   boss   — como ground, mais um salto com golpe de área.
 * Inimigo terrestre parado tempo demais é recolocado em um portal.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly id = nextId++;
  readonly def: EnemyDef;
  readonly health: Health;
  ai: EnemyState = 'patrol';

  private dir: 1 | -1 = 1;
  private readonly attackCd = new Cooldown();
  private readonly specialCd = new Cooldown();
  private hurtTimer = 0;
  private attackAnim = 0;
  private huntTimer = 10;
  private turnTimer = 2;
  private aboveTimer = 0;
  private stuckTimer = 0;
  private lastX = 0;
  private alerted = false;
  private retreat = 0;
  private noSight = 0;
  private windup = 0;
  private leaping = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: EnemyType, hpScale = 1) {
    super(scene, x, y, `enemy-${type}`, 0);
    this.def = ENEMY_DEFS[type];
    this.health = new Health(Math.round(this.def.maxHp * hpScale));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const { width, height } = this.def.body;
    body.setSize(width, height);
    body.setOffset((this.def.frame.width - width) / 2, this.def.frame.height - height - 1);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(600, 900);
    body.setDragX(900);
    if (this.def.behavior === 'flyer') {
      body.setAllowGravity(false);
      body.setDragX(0);              // o arrasto dos terrestres anularia a aceleração suave do voo
      body.setOffset((this.def.frame.width - width) / 2, (this.def.frame.height - height) / 2);
      this.alerted = true;
    }
    this.setDepth(this.def.behavior === 'boss' ? 14 : 15);
    this.lastX = x;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.play(`enemy-${type}-walk`);
  }

  get arcade(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get rect(): Rect {
    const b = this.arcade;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  get alive(): boolean {
    return this.ai !== 'dead';
  }

  tick(dt: number, w: EnemyWorld): void {
    if (this.ai === 'dead') return;
    if (this.attackAnim > 0) this.attackAnim -= dt;

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this.ai = 'hurt';
      return;                       // o empurrão segue pela física (arrasto freia)
    }

    if (this.def.behavior === 'flyer') this.tickFlyer(dt, w);
    else this.tickGround(dt, w);

    this.setFlipX(this.dir < 0);
    if (this.attackAnim > 0 || this.windup > 0) { this.anims.stop(); this.setFrame(4); }
    else if (!this.anims.isPlaying) this.play(`enemy-${this.def.type}-walk`);
  }

  // ----------------------------------------------------------------- solo

  private tickGround(dt: number, w: EnemyWorld): void {
    const body = this.arcade;
    const onFloor = body.blocked.down || body.touching.down;
    const dx = w.target.x - body.center.x;
    const dist = Math.hypot(dx, w.target.y - body.center.y);
    this.huntTimer -= dt;
    const aware = w.target.alive && (this.alerted || this.huntTimer <= 0 || dist < this.def.detectTiles * TILE);

    if (!aware) {
      this.ai = 'patrol';
      this.turnTimer -= dt;
      if (this.turnTimer <= 0 || (this.dir > 0 ? body.blocked.right : body.blocked.left)) {
        // Vira, com leve tendência a ir na direção do herói.
        this.dir = this.turnTimer <= 0 && Math.random() < 0.7 ? (dx < 0 ? -1 : 1) : (this.dir > 0 ? -1 : 1);
        this.turnTimer = 1.5 + Math.random() * 2;
      }
      body.setVelocityX(this.dir * this.def.speed * 0.5);
      return;
    }

    this.alerted = true;
    if (this.ai !== 'attack' || this.attackAnim <= 0) this.ai = 'chase';
    if (this.def.behavior === 'boss' && this.tickSlam(dt, w, onFloor, dx, dist)) return;

    let dir: -1 | 0 | 1 = Math.abs(dx) < 8 ? 0 : dx < 0 ? -1 : 1;
    if (dir !== 0) this.dir = dir;
    if (this.def.ranged) dir = this.tickRanged(dt, w, dir, dist);

    body.setVelocityX(dir * this.def.speed);
    if (dir !== 0 && onFloor && (dir > 0 ? body.blocked.right : body.blocked.left)) this.handleObstacle(dir, w);

    // Herói logo acima e inalcançável: salto alto de tempos em tempos.
    const above = body.bottom - w.target.bottom;
    if (!this.def.ranged && onFloor && Math.abs(dx) < TILE * 1.5 && above > TILE * 1.5) {
      this.aboveTimer += dt;
      if (this.aboveTimer > 2.2) {
        this.aboveTimer = 0;
        body.setVelocityY(-Math.sqrt(2 * GRAVITY * Math.min(TILE * 6, above + 24)));
      }
    } else {
      this.aboveTimer = 0;
    }
    this.watchStuck(dt, dist, w);
  }

  /**
   * Atirador: recua se o herói chega perto, avança se está longe ou sem
   * visão há tempo demais, e dispara quando vê o alvo. Devolve a direção.
   */
  private tickRanged(dt: number, w: EnemyWorld, toward: -1 | 0 | 1, dist: number): -1 | 0 | 1 {
    const r = this.def.ranged;
    if (!r) return toward;
    const body = this.arcade;
    const mx = body.center.x;
    const my = body.y + 8;
    const sees = dist < r.rangeTiles * TILE && w.building.hasLineOfSight(mx, my, w.target.x, w.target.y);
    this.noSight = sees ? 0 : this.noSight + dt;
    if (sees && this.specialCd.trigger(w.now, r.interval)) {
      this.attackAnim = 0.3;
      this.stuckTimer = 0;
      w.shoot(this, mx + this.dir * 12, my, w.target.x, w.target.y);
    }
    if (sees && dist < r.keepTiles * TILE * 0.7) {
      const away = (toward === 0 ? -this.dir : -toward) as 1 | -1;
      const blocked = away > 0 ? body.blocked.right : body.blocked.left;
      return blocked ? 0 : away;
    }
    if (!sees && this.noSight > 2.5) return toward;      // procura um ângulo (ou derruba a cobertura)
    return dist > r.keepTiles * TILE ? toward : 0;
  }

  /** Chefe: prepara, salta sobre o herói e golpeia ao aterrissar. True enquanto ocupado. */
  private tickSlam(dt: number, w: EnemyWorld, onFloor: boolean, dx: number, dist: number): boolean {
    const body = this.arcade;
    if (this.leaping) {
      if (onFloor && body.velocity.y >= 0) {
        this.leaping = false;
        w.slam(this);
      }
      return true;
    }
    if (this.windup > 0) {
      this.windup -= dt;
      body.setVelocityX(0);
      if (this.windup <= 0) {
        body.setVelocity(Phaser.Math.Clamp(dx / 0.85, -320, 320), -640);
        this.leaping = true;
      }
      return true;
    }
    if (onFloor && dist < TILE * 7 && this.specialCd.trigger(w.now, BOSS_SLAM.interval)) {
      this.windup = BOSS_SLAM.windup;
      this.stuckTimer = 0;
      return true;
    }
    return false;
  }

  /** Bloqueado por algo à frente: pula se der, senão ataca o bloco. */
  private handleObstacle(dir: 1 | -1, w: EnemyWorld): void {
    const body = this.arcade;
    const fx = Math.floor((dir > 0 ? body.right + 3 : body.x - 3) / TILE);
    const fy = Math.floor((body.bottom - 2) / TILE);
    let h = 0;
    while (h < 6 && w.building.blocks('enemy', fx, fy - h)) h++;
    if (h === 0) return;
    if (h <= this.def.jumpTiles) {
      body.setVelocityY(-Math.sqrt(2 * GRAVITY * (h * TILE + 14)));
      return;
    }
    // Ataca o bloco destrutível mais baixo da coluna.
    for (let k = 0; k < h; k++) {
      const def = w.building.get(fx, fy - k);
      if (!Number.isFinite(def.maxHp)) continue;
      body.setVelocityX(0);
      this.ai = 'attack';
      if (this.attackCd.trigger(w.now, this.def.attackInterval)) {
        this.attackAnim = 0.25;
        this.stuckTimer = 0;
        w.hitBlock(fx, fy - k, this.def.blockDamage);
      }
      return;
    }
  }

  /** Sem progresso por muito tempo longe do herói: volta para um portal. */
  private watchStuck(dt: number, dist: number, w: EnemyWorld): void {
    const holding = this.def.ranged !== undefined && this.noSight <= 0;     // atirador parado de propósito
    if (Math.abs(this.x - this.lastX) > 10 || dist < TILE * 2.5 || this.ai === 'attack' || holding) {
      this.lastX = this.x;
      this.stuckTimer = 0;
      return;
    }
    this.stuckTimer += dt;
    if (this.stuckTimer < 6) return;
    this.stuckTimer = 0;
    let best = w.spawnPoints[0];
    for (const s of w.spawnPoints) if (Math.abs(s.x - w.target.x) < Math.abs(best.x - w.target.x)) best = s;
    if (!best) return;
    this.arcade.reset(best.x, best.y - this.def.body.height / 2);
    this.lastX = best.x;
    w.onRecovered(this);
  }

  // ------------------------------------------------------------------ voo

  private tickFlyer(dt: number, w: EnemyWorld): void {
    const body = this.arcade;
    this.ai = 'chase';
    if (this.retreat > 0) this.retreat -= dt;
    const dx = w.target.x - body.center.x;
    const diving = w.target.alive && this.retreat <= 0 && Math.abs(dx) < TILE * 5;
    // Paira acima do herói; perto o bastante, mergulha; depois de bater, recua para o alto.
    const gx = diving ? w.target.x : w.target.x - Math.sign(dx || 1) * (this.retreat > 0 ? TILE * 3 : 0);
    const gy = diving ? w.target.y : w.target.y - TILE * (this.retreat > 0 ? 5.5 : 4);
    const ddx = gx - body.center.x;
    const ddy = gy - body.center.y;
    const d = Math.hypot(ddx, ddy) || 1;
    const speed = this.def.speed * (diving ? 1.7 : 1);
    const k = Math.min(1, dt * 4);
    body.velocity.x += ((ddx / d) * speed - body.velocity.x) * k;
    body.velocity.y += ((ddy / d) * speed - body.velocity.y) * k;
    // Encostou em bloco: contorna por cima.
    if (body.blocked.left || body.blocked.right || body.blocked.down) body.velocity.y = -this.def.speed;
    if (Math.abs(dx) > 6) this.dir = dx < 0 ? -1 : 1;
  }

  // ------------------------------------------------------------ interações

  /** Tenta golpear o herói em contato. Retorna o dano (0 se em recarga). */
  tryAttack(now: number): number {
    if (this.ai === 'dead' || this.hurtTimer > 0 || !this.attackCd.trigger(now, this.def.attackInterval)) return 0;
    this.ai = 'attack';
    this.attackAnim = 0.25;
    this.retreat = 1.5;
    return this.def.damage;
  }

  /** Aplica dano e empurrão. Retorna o dano efetivo. */
  takeDamage(amount: number, now: number, knockX: number): number {
    const dealt = this.health.damage(amount, now);
    if (dealt <= 0) return 0;
    this.alerted = true;
    if (this.def.knockback > 0) {
      this.hurtTimer = 0.16;
      this.arcade.setVelocity(knockX * this.def.knockback, -120 * this.def.knockback);
    }
    if (this.health.dead) {
      this.ai = 'dead';
      this.arcade.enable = false;
    }
    return dealt;
  }
}
