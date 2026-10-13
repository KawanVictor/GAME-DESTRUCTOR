import Phaser from 'phaser';
import { DASH, PLAYER, TILE } from '../config';
import { MELEE, RANGED } from '../data/weapons';
import type { BuildingSystem } from '../systems/BuildingSystem';
import { Cooldown, type Health, SwingTracker } from '../systems/CombatSystem';
import type { MatchMods } from '../systems/MatchState';
import type { Rect } from '../types/game';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  melee: boolean;
  shoot: boolean;
  dashPressed: boolean;
}

export interface PlayerHooks {
  onJump(): void;
  onLand(): void;
  onJumpPad(): void;
  onMelee(): void;
  onShoot(): void;
  onDash(): void;
}

/**
 * Herói. Todo o movimento é resolvido pelo Arcade Physics (aceleração,
 * arrasto, gravidade); aqui só decidimos forças e velocidades.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: 1 | -1 = 1;
  /** > 0: atravessando plataformas de madeira para baixo. */
  dropTimer = 0;
  readonly meleeCd = new Cooldown();
  readonly shotCd = new Cooldown();
  readonly dashCd = new Cooldown();
  readonly swing = new SwingTracker();

  private coyote = 0;
  private buffer = 0;
  private hurtLock = 0;
  private dashTimer = 0;
  private jumping = false;
  private wasOnFloor = true;

  constructor(
    scene: Phaser.Scene, x: number, y: number,
    readonly health: Health,
    private readonly building: BuildingSystem,
    private readonly mods: MatchMods,
  ) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER.body.width, PLAYER.body.height);
    body.setOffset((48 - PLAYER.body.width) / 2, 46 - PLAYER.body.height);
    body.setMaxVelocity(PLAYER.maxSpeed, PLAYER.maxFallSpeed);
    body.setCollideWorldBounds(true);
    this.setDepth(20);
  }

  get arcade(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get rect(): Rect {
    const b = this.arcade;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  get onFloor(): boolean {
    const b = this.arcade;
    return b.blocked.down || b.touching.down;
  }

  get dashing(): boolean {
    return this.dashTimer > 0;
  }

  /** Área atingida pelo golpe corpo a corpo, à frente do herói. */
  get meleeRect(): Rect {
    const b = this.arcade;
    return {
      x: this.facing > 0 ? b.right - 6 : b.x - MELEE.range + 6,
      y: b.y - 6,
      width: MELEE.range,
      height: MELEE.height,
    };
  }

  /** now/dt em segundos. */
  tick(now: number, dt: number, input: PlayerInput, hooks: PlayerHooks): void {
    const body = this.arcade;
    const onFloor = this.onFloor;
    this.coyote = onFloor ? PLAYER.coyoteTime : this.coyote - dt;
    this.buffer = input.jumpPressed ? PLAYER.jumpBuffer : this.buffer - dt;
    if (this.dropTimer > 0) this.dropTimer -= dt;
    if (this.hurtLock > 0) this.hurtLock -= dt;

    // --- investida: avanço curto em linha reta, invulnerável.
    if (input.dashPressed && this.hurtLock <= 0 && !this.dashing && this.dashCd.trigger(now, DASH.cooldown * this.mods.dashCooldown)) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
      this.dashTimer = DASH.duration;
      this.jumping = false;
      this.health.shield(now, DASH.invulnerability);
      body.setAllowGravity(false);
      body.setMaxVelocityX(DASH.speed);
      hooks.onDash();
    }
    if (this.dashing) {
      this.dashTimer -= dt;
      body.setAcceleration(0, 0);
      body.setVelocity(this.facing * DASH.speed, 0);
      if (this.dashTimer <= 0) {
        body.setAllowGravity(true);
        body.setVelocityX(this.facing * PLAYER.maxSpeed * this.mods.moveSpeed);
      }
      this.setFlipX(this.facing < 0);
      this.setAlpha(0.6);
      this.play('player-run', true);
      this.wasOnFloor = onFloor;
      return;
    }
    body.setMaxVelocityX(PLAYER.maxSpeed * this.mods.moveSpeed);

    // --- horizontal: aceleração controlada; ao soltar, o arrasto freia.
    const dir = this.hurtLock > 0 ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      const turning = Math.sign(body.velocity.x) === -dir;
      const accel = (onFloor ? PLAYER.acceleration : PLAYER.airAcceleration) * (turning ? 1.8 : 1);
      body.setAccelerationX(dir * accel);
      this.facing = dir > 0 ? 1 : -1;
    } else {
      body.setAccelerationX(0);
    }
    body.setDragX(onFloor ? PLAYER.drag : PLAYER.drag * 0.35);

    // --- pulo: buffer + "coyote time" + altura variável.
    if (this.buffer > 0 && this.hurtLock <= 0) {
      if (input.down && onFloor && this.standingOn() === 'wood_platform') {
        this.dropTimer = 0.25;
        this.buffer = 0;
      } else if (this.coyote > 0) {
        body.setVelocityY(-PLAYER.jumpVelocity);
        this.coyote = 0;
        this.buffer = 0;
        this.jumping = true;
        hooks.onJump();
      }
    }
    if (body.velocity.y >= 0) this.jumping = false;
    if (this.jumping && !input.jumpHeld && body.velocity.y < -120) {
      body.setVelocityY(body.velocity.y * PLAYER.jumpCutFactor);
      this.jumping = false;
    }

    // Plataforma de impulso: lança sempre que o herói está apoiado nela.
    if (onFloor && body.velocity.y >= 0 && this.standingOn() === 'jump_pad') {
      body.setVelocityY(-PLAYER.jumpPadVelocity);
      this.jumping = false;
      hooks.onJumpPad();
    } else if (onFloor && !this.wasOnFloor) {
      hooks.onLand();
    }
    this.wasOnFloor = onFloor;

    // --- ataques
    if (this.hurtLock <= 0) {
      if (input.melee && this.meleeCd.trigger(now, MELEE.cooldown)) {
        this.swing.begin(now, MELEE.activeTime);
        this.play('player-attack', true);
        hooks.onMelee();
      }
      if (input.shoot && this.shotCd.trigger(now, RANGED.cooldown * this.mods.shotCooldown)) hooks.onShoot();
    }

    // --- visual
    this.setFlipX(this.facing < 0);
    this.setAlpha(this.health.isInvulnerable(now) && Math.floor(now * 20) % 2 === 0 ? 0.35 : 1);
    const attacking = this.anims.currentAnim?.key === 'player-attack' && this.anims.isPlaying;
    if (this.hurtLock > 0) this.play('player-hurt', true);
    else if (!attacking) {
      if (!onFloor) this.play(body.velocity.y < 0 ? 'player-jump' : 'player-fall', true);
      else this.play(Math.abs(body.velocity.x) > 30 ? 'player-run' : 'player-idle', true);
    }
  }

  /**
   * Bloco sob os pés. Olha o centro e as duas bordas do corpo, para que a
   * plataforma de impulso funcione mesmo com o herói meio fora dela.
   */
  private standingOn(): string {
    const b = this.arcade;
    const row = Math.floor((b.bottom + 2) / TILE);
    const ids = [b.center.x, b.x + 2, b.right - 2].map((x) => this.building.get(Math.floor(x / TILE), row).id);
    return ids.find((id) => id === 'jump_pad') ?? ids[0];
  }

  /** Aplica dano vindo de `fromX`. Retorna o dano efetivo (0 se invulnerável). */
  hurt(amount: number, fromX: number, now: number): number {
    const dealt = this.health.damage(amount, now);
    if (dealt <= 0) return 0;
    this.hurtLock = PLAYER.hurtLock;
    this.jumping = false;
    const body = this.arcade;
    body.setVelocity((this.x < fromX ? -1 : 1) * 240, -260);
    return dealt;
  }
}
