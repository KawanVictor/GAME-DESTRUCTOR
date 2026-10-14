import Phaser from 'phaser';
import { AIM, BOSS_SLAM, SPIKES, TILE, UPGRADES, type UpgradeId, VIEW_HEIGHT, VIEW_WIDTH, WAVES } from '../config';
import { blockById, BUILDABLE } from '../data/blocks';
import { composeWave, ENEMY_NAMES } from '../data/enemies';
import { MELEE, RANGED } from '../data/weapons';
import { type DebugApi, setDebugScene } from '../debug';
import { Enemy, type EnemyWorld } from '../entities/Enemy';
import { Player, type PlayerInput } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { audio, save } from '../services';
import { FAILURE_TEXT, overlaps } from '../systems/BuildingSystem';
import { explosionDamage, pickAimTarget } from '../systems/CombatSystem';
import { setupCollisions } from '../systems/CollisionSystem';
import { Effects } from '../systems/Effects';
import { buyUpgrade, createMatch, type MatchState, rollOffers } from '../systems/MatchState';
import { WaveSystem } from '../systems/WaveSystem';
import type { Action, BuildCheck, BuildContext, BuildEvent, EnemyType, ExplosiveDef, WaveDef } from '../types/game';
import { BuildMenu, type BuildTool } from '../ui/BuildMenu';
import { HUD } from '../ui/HUD';
import { openOptions, optionsOpen } from '../ui/Options';
import { PauseMenu } from '../ui/PauseMenu';
import { TouchControls } from '../ui/TouchControls';
import { TileView } from '../world/TileView';
import { SpikeTimer } from '../world/Trap';
import { TurretManager } from '../world/TurretManager';
import type { GameOverData } from './GameOverScene';

type Key = Phaser.Input.Keyboard.Key;
const DIGITS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
const BLOCK_TINT: Record<string, number> = {
  crate: 0xd9a066, wood_platform: 0xd9a066, stone_block: 0xa3acc2, defensive_wall: 0x5d79b8,
  explosive_block: 0xf0575c, jump_pad: 0x67e8f9, spike_trap: 0xc9d2e6, turret: 0xffb347,
};
/** Dano que um disparo inimigo causa ao bloco que o detém. */
const ENEMY_SHOT_BLOCK_DAMAGE = 5;

/**
 * Cena da partida. Não guarda regras: liga os sistemas (construção, ondas,
 * combate, recursos) às entidades do Phaser, à entrada e à interface.
 * Tudo é criado em create() e descartado no shutdown, então reiniciar a
 * cena reinicia a partida sem sobras.
 */
export class GameScene extends Phaser.Scene {
  private match!: MatchState;
  private waves!: WaveSystem;
  private waveDef: WaveDef | null = null;
  private view!: TileView;
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private pickups!: Phaser.GameObjects.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private turretBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private turrets!: TurretManager;
  private fx!: Effects;
  private hud!: HUD;
  private buildMenu!: BuildMenu;
  private pauseMenu!: PauseMenu;
  private touch!: TouchControls;
  private spikeTimer = new SpikeTimer();
  private keys = new Map<Action, Key[]>();
  private digitKeys: Key[] = [];
  /** Ações/teclas apertadas desde o último quadro (não perde toques muito rápidos). */
  private justPressed = new Set<string>();
  private tool: BuildTool = { kind: 'none' };
  private ghost!: Phaser.GameObjects.Image;
  private outline!: Phaser.GameObjects.Graphics;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private spawnPoints: Array<{ x: number; y: number }> = [];
  private spawnSide = 0;
  private paused = false;
  private ended = false;
  private recorded = false;
  private recordedKills = 0;
  private abort = new AbortController();

  constructor() {
    super('Game');
  }

  /** Tempo da cena em segundos (para junto com a pausa). */
  private get now(): number {
    return this.time.now / 1000;
  }

  // ------------------------------------------------------------------ criação

  create(): void {
    this.match = createMatch(save.data.settings.arena);
    this.spikeTimer = new SpikeTimer();
    this.tool = { kind: 'none' };
    this.waveDef = null;
    this.paused = false;
    this.ended = false;
    this.recorded = false;
    this.recordedKills = 0;
    this.spawnSide = 0;
    this.abort = new AbortController();
    const { level, building } = this.match;
    const worldW = level.cols * TILE;
    const worldH = level.rows * TILE;

    // Fundo em camadas (paralaxe em update).
    this.add.image(0, 0, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.far = this.add.tileSprite(0, VIEW_HEIGHT - 400, VIEW_WIDTH, 360, 'bg-far').setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.near = this.add.tileSprite(0, VIEW_HEIGHT - 330, VIEW_WIDTH, 320, 'bg-near').setOrigin(0).setScrollFactor(0).setDepth(-10);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.view = new TileView(this, building);
    this.fx = new Effects(this);

    this.spawnPoints = level.enemySpawns.map((s) => ({ x: s.x * TILE + TILE / 2, y: (s.y + 1) * TILE - 24 }));
    for (const p of this.spawnPoints) {
      const portal = this.add.image(p.x, p.y - 12, 'portal').setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: portal, scaleX: 0.85, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.player = new Player(this, level.playerSpawn.x * TILE + TILE / 2, level.playerSpawn.y * TILE, this.match.playerHealth, building, this.match.mods);
    this.enemies = this.add.group();
    this.pickups = this.add.group();
    const pool = (maxSize: number): Phaser.Physics.Arcade.Group =>
      this.physics.add.group({ classType: Projectile, maxSize, runChildUpdate: true, allowGravity: false });
    this.bullets = pool(40);
    this.turretBullets = pool(60);
    this.enemyBullets = pool(40);
    this.turrets = new TurretManager(this, building, this.turretBullets, () => this.match.mods.turretDamage, (x, y) => {
      this.fx.flash(x, y, 0xffb347, 0.5, 120);
      audio.play('turret');
    });

    setupCollisions(this, {
      player: this.player, layer: this.view.layer, enemies: this.enemies, pickups: this.pickups,
      bullets: this.bullets, turretBullets: this.turretBullets, enemyBullets: this.enemyBullets,
    }, {
      bulletHitsTile: (b, x, y) => this.bulletHitsTile(b, x, y),
      bulletHitsEnemy: (b, e) => { this.damageEnemy(e, b.damage, Math.sign(b.velocityX) * 120); b.kill(); },
      enemyBulletHitsTile: (b, x, y) => {
        if (!b.active) return;
        building.damage(x, y, ENEMY_SHOT_BLOCK_DAMAGE);
        this.fx.spark(b.x, b.y, 0xc8ff7a, 5);
        b.kill();
      },
      enemyBulletHitsPlayer: (b) => {
        if (!b.active) return;
        this.hurtPlayer(b.damage, b.x - b.velocityX);
        this.fx.spark(b.x, b.y, 0xc8ff7a, 6);
        b.kill();
      },
      enemyTouchesPlayer: (e) => { const dmg = e.tryAttack(this.now); if (dmg > 0) this.hurtPlayer(dmg, e.x); },
      playerCollects: (k) => this.collect(k),
    });

    building.on((e) => this.onBuildEvent(e));

    this.waves = new WaveSystem({
      total: WAVES.total, firstPreparation: WAVES.firstPreparation, preparation: WAVES.preparation, completedPause: WAVES.completedPause,
      compose: composeWave,
      spawn: (type) => this.spawnWaveEnemy(type),
      onWaveStart: (def) => this.onWaveStart(def),
      onWaveComplete: (def) => this.onWaveComplete(def),
      onVictory: () => this.finish('victory'),
    });

    // Câmera segue o herói com suavidade, dentro dos limites do mapa.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(90, 60);
    cam.fadeIn(300, 7, 11, 31);

    // Prévia de construção.
    this.ghost = this.add.image(0, 0, 'tiles', 0).setOrigin(0).setAlpha(0.6).setDepth(30).setVisible(false);
    this.outline = this.add.graphics().setDepth(31);

    this.hud = new HUD({
      onPause: () => this.togglePause(),
      onStartWave: () => this.waves.startNow(),
      onToggleBuild: () => this.setBuildOpen(!this.buildMenu.open),
      onUpgrade: (id) => this.buy(id),
    });
    this.buildMenu = new BuildMenu((tool) => this.pickTool(tool));
    this.pauseMenu = new PauseMenu({
      onResume: () => this.togglePause(),
      onRestart: () => this.restartMatch(),
      onOptions: () => openOptions(() => this.optionsChanged()),
      onQuit: () => this.quitToMenu(),
    });
    this.touch = new TouchControls();
    this.setupInput();
    this.hud.banner(level.name, 'Monte suas defesas antes da primeira onda.', 3600);
    audio.setMusic('calm');

    setDebugScene('game', this.debugApi());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // ------------------------------------------------------------------ entrada

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Teclado indisponível');
    this.applyBindings();
    this.digitKeys = DIGITS.slice(0, BUILDABLE.length).map((name, i) => {
      const k = kb.addKey(name, true, false);
      k.on(Phaser.Input.Keyboard.Events.DOWN, () => this.justPressed.add(`digit${i}`));
      return k;
    });

    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.paused || this.ended) return;
      audio.unlock();
      if (p.rightButtonDown()) {
        // Botão direito: cancela a prévia; sem prévia, fecha o menu.
        if (this.tool.kind !== 'none') this.pickTool({ kind: 'none' });
        else this.setBuildOpen(false);
        return;
      }
      this.confirmBuild(p);
    });

    // Esc precisa funcionar com a cena pausada, por isso é ouvido na janela.
    const s = this.abort.signal;
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || e.repeat || this.ended || optionsOpen()) return;
      e.preventDefault();
      if (!this.paused && (this.buildMenu.open || this.tool.kind !== 'none')) this.setBuildOpen(false);
      else this.togglePause();
    }, { signal: s });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && !this.ended) this.togglePause();
    }, { signal: s });
  }

  /** (Re)cria as teclas a partir das configurações salvas. */
  private applyBindings(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    for (const list of this.keys.values()) for (const k of list) { k.removeAllListeners(); kb.removeKey(k, true); }
    this.keys.clear();
    const bindings = save.data.settings.bindings;
    for (const action of Object.keys(bindings) as Action[]) {
      const list = bindings[action].map((name) => kb.addKey(name, true, false));
      for (const k of list) k.on(Phaser.Input.Keyboard.Events.DOWN, () => this.justPressed.add(action));
      this.keys.set(action, list);
    }
    this.justPressed.clear();
  }

  /** As opções foram fechadas: reaplica teclas, rótulos e controles de toque. */
  private optionsChanged(): void {
    this.applyBindings();
    this.hud.refreshKeys();
    this.buildMenu.refreshKeys();
    this.touch.refresh();
  }

  private held(action: Action): boolean {
    return this.touch.isHeld(action) || (this.keys.get(action) ?? []).some((k) => k.isDown);
  }

  private pressed(action: Action): boolean {
    return this.justPressed.has(action) || this.touch.wasPressed(action);
  }

  // ---------------------------------------------------------------- laço

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    const now = this.now;
    const cam = this.cameras.main;
    this.far.tilePositionX = cam.scrollX * 0.12;
    this.near.tilePositionX = cam.scrollX * 0.3;

    if (!this.ended) {
      this.handleHotkeys();
      const input: PlayerInput = {
        left: this.held('left'), right: this.held('right'), down: this.held('down'),
        jumpHeld: this.held('jump'), jumpPressed: this.pressed('jump'),
        melee: this.held('melee') || this.pressed('melee'), shoot: this.held('shoot') || this.pressed('shoot'),
        dashPressed: this.pressed('dash'),
      };
      this.player.tick(now, dt, input, {
        onJump: () => audio.play('jump'),
        onLand: () => { audio.play('land'); this.fx.burst(this.player.x, this.player.arcade.bottom, 0xcfd6ee, 4); },
        onJumpPad: () => { audio.play('pad'); this.fx.spark(this.player.x, this.player.arcade.bottom, 0x67e8f9, 12); },
        onMelee: () => audio.play('slash'),
        onShoot: () => this.shoot(),
        onDash: () => { audio.play('dash'); this.fx.spark(this.player.x, this.player.arcade.center.y, 0x67e8f9, 10); },
      });
      this.resolveMelee(now);
      this.waves.update(dt);
    }

    const alive = this.enemies.getChildren() as Enemy[];
    const pb = this.player.arcade;
    const world: EnemyWorld = {
      now, building: this.match.building,
      target: { x: pb.center.x, y: pb.center.y, bottom: pb.bottom, alive: !this.match.playerHealth.dead },
      spawnPoints: this.spawnPoints,
      hitBlock: (x, y, dmg) => {
        this.match.building.damage(x, y, dmg);
        this.fx.spark(x * TILE + TILE / 2, y * TILE + TILE / 2, 0xffffff, 4);
        audio.play('hit');
      },
      shoot: (e, x, y, tx, ty) => this.enemyShoot(e, x, y, tx, ty),
      slam: (e) => this.bossSlam(e),
      onRecovered: (e) => this.fx.flash(e.x, e.y, 0xb48cff, 1.2),
    };
    let boss: Enemy | null = null;
    for (const e of alive.slice()) {
      e.tick(dt, world);
      if (!e.alive) continue;
      if (e.def.behavior !== 'flyer') this.applySpikes(e, now);
      if (e.def.behavior === 'boss') boss = e;
    }
    this.turrets.update(now, alive);
    this.updatePickups(now, dt);
    this.updatePreview();
    this.updateHud(now, boss);
    if (!this.ended) audio.setMusic(boss ? 'boss' : this.waves.phase === 'fighting' ? 'battle' : 'calm');
    this.justPressed.clear();
    this.touch.endFrame();
  }

  private handleHotkeys(): void {
    if (this.pressed('build')) this.setBuildOpen(!this.buildMenu.open);
    if (this.pressed('startWave')) this.waves.startNow();
    // Demolir e reparar alternam a ferramenta (e abrem o menu se preciso).
    for (const kind of ['demolish', 'repair'] as const) {
      if (this.pressed(kind)) this.pickTool(this.tool.kind === kind ? { kind: 'none' } : { kind });
    }
    this.digitKeys.forEach((_k, i) => {
      if (this.justPressed.has(`digit${i}`) && this.buildMenu.open) this.pickTool({ kind: 'piece', id: BUILDABLE[i].id });
    });
  }

  private updateHud(now: number, boss: Enemy | null): void {
    const h = this.match.playerHealth;
    this.hud.update({
      hp: h.hp, maxHp: h.max, resources: this.match.resources.value,
      wave: this.waves.number, totalWaves: WAVES.total, endless: this.waves.endless,
      phase: this.waves.phase, remaining: this.waves.remaining, timer: this.waves.timer,
      meleeCd: this.player.meleeCd.fraction(now), shotCd: this.player.shotCd.fraction(now), dashCd: this.player.dashCd.fraction(now),
      offers: this.match.offers,
      boss: boss ? { name: ENEMY_NAMES.boss, ratio: boss.health.hp / boss.health.max } : null,
    });
    this.buildMenu.update(this.tool, this.match.resources.value);
  }

  // ------------------------------------------------------------- combate

  /** Disparo com mira assistida: vai no inimigo visível mais próximo à frente, ou reto. */
  private shoot(): void {
    const b = this.bullets.get(this.player.x, this.player.y, 'bullet') as Projectile | null;
    if (!b) return;
    const f = this.player.facing;
    const x = this.player.x + f * 18;
    const y = this.player.arcade.center.y - 4;
    const candidates = (this.enemies.getChildren() as Enemy[]).filter((e) => e.alive).map((e) => ({ x: e.arcade.center.x, y: e.arcade.center.y }));
    // A linha de visão é testada nas duas bordas do projétil, para ele não raspar em quinas.
    const los = this.match.building;
    const target = pickAimTarget({ x, y }, f, candidates, RANGED.range, AIM.coneDegrees,
      (tx, ty) => los.hasLineOfSight(x, y - 5, tx, ty - 5) && los.hasLineOfSight(x, y + 5, tx, ty + 5));
    const angle = target ? Math.atan2(target.y - y, target.x - x) : f > 0 ? 0 : Math.PI;
    b.fire(x, y, Math.cos(angle) * RANGED.speed, Math.sin(angle) * RANGED.speed, RANGED.damage * this.match.mods.damage, RANGED.range, RANGED.blockDamage);
    b.setDepth(25);
    this.fx.flash(x, y, 0x67e8f9, 0.55, 110);
    audio.play('shoot');
  }

  /** Golpe corpo a corpo: cada inimigo (e um bloco) no máximo uma vez por golpe. */
  private resolveMelee(now: number): void {
    const swing = this.player.swing;
    if (!swing.isActive(now)) return;
    const rect = this.player.meleeRect;
    for (const e of this.enemies.getChildren() as Enemy[]) {
      if (!e.alive || !overlaps(rect, e.rect) || !swing.tryHit(e.id, now)) continue;
      this.damageEnemy(e, MELEE.damage * this.match.mods.damage, this.player.facing * MELEE.knockback);
    }
    // Blocos: abre caminho por caixotes e ativa explosivos; não desgasta as próprias defesas.
    const b = this.match.building;
    const x0 = Math.floor(rect.x / TILE);
    const x1 = Math.floor((rect.x + rect.width) / TILE);
    const y0 = Math.floor(rect.y / TILE);
    const y1 = Math.floor((rect.y + rect.height - 1) / TILE);
    const cols = [];
    for (let x = x0; x <= x1; x++) cols.push(x);
    if (this.player.facing < 0) cols.reverse();
    for (const x of cols) {
      for (let y = y1; y >= y0; y--) {
        const def = b.get(x, y);
        if (def.id === 'empty' || !Number.isFinite(def.maxHp) || (b.isOwned(x, y) && !def.explosive)) continue;
        if (!swing.tryHit(-1, now)) return;
        b.damage(x, y, def.explosive ? def.maxHp : MELEE.blockDamage * this.match.mods.damage);
        this.fx.spark(x * TILE + TILE / 2, y * TILE + TILE / 2, 0xffffff, 6);
        audio.play('hit');
        return;
      }
    }
  }

  private bulletHitsTile(bullet: Projectile, x: number, y: number): void {
    if (!bullet.active) return;
    const b = this.match.building;
    const def = b.get(x, y);
    // Um tiro do herói ativa (detona) o explosivo na hora.
    if (Number.isFinite(def.maxHp) && (!b.isOwned(x, y) || def.explosive)) b.damage(x, y, def.explosive ? def.maxHp : bullet.blockDamage);
    this.fx.spark(bullet.x, bullet.y, 0x67e8f9, 5);
    bullet.kill();
  }

  private enemyShoot(e: Enemy, x: number, y: number, tx: number, ty: number): void {
    const r = e.def.ranged;
    const b = r ? (this.enemyBullets.get(x, y, 'enemy-bullet') as Projectile | null) : null;
    if (!r || !b) return;
    const angle = Math.atan2(ty - y, tx - x);
    b.fire(x, y, Math.cos(angle) * r.speed, Math.sin(angle) * r.speed, r.damage, r.rangeTiles * TILE * 1.3, 0);
    b.setDepth(25);
    this.fx.flash(x, y, 0xc8ff7a, 0.5, 120);
    audio.play('spit');
  }

  /** Golpe de área do chefe ao aterrissar: fere o herói que estiver no chão por perto e racha estruturas. */
  private bossSlam(e: Enemy): void {
    const x = e.x;
    const y = e.arcade.bottom;
    this.fx.flash(x, y, 0xff5d73, BOSS_SLAM.radius * 1.6, 380);
    this.fx.burst(x, y, 0xd9c9a8, 22);
    this.cameras.main.shake(300, 0.014);
    audio.play('explode');
    const pb = this.player.arcade;
    const grounded = this.player.onFloor && Math.abs(pb.bottom - y) < TILE * 1.5;
    if (grounded && Math.abs(pb.center.x - x) < BOSS_SLAM.radius * TILE) this.hurtPlayer(BOSS_SLAM.damage, x);
    const b = this.match.building;
    const cx = Math.floor(x / TILE);
    const cy = Math.floor((y - 2) / TILE);
    for (let ty = cy - 1; ty <= cy; ty++) {
      for (let tx = cx - BOSS_SLAM.blockRadius - 1; tx <= cx + BOSS_SLAM.blockRadius + 1; tx++) b.damage(tx, ty, BOSS_SLAM.blockDamage);
    }
  }

  private damageEnemy(e: Enemy, amount: number, knockX: number): void {
    const dealt = e.takeDamage(amount, this.now, knockX);
    if (dealt <= 0) return;
    this.fx.number(e.x, e.arcade.y - 6, String(Math.round(dealt)), '#ffffff');
    this.fx.spark(e.x, e.arcade.center.y, 0xffe9a8, 6);
    e.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
    audio.play('hit');
    if (!e.alive) this.killEnemy(e);
  }

  /** Remove o inimigo de todos os sistemas uma única vez. */
  private killEnemy(e: Enemy): void {
    this.enemies.remove(e);
    this.waves.enemyRemoved(e.id);
    this.spikeTimer.forget(e.id);
    this.match.kills++;
    const gems = Math.min(e.def.behavior === 'boss' ? 6 : 3, Math.ceil(e.def.reward / 8));
    for (let i = 0; i < gems; i++) this.dropPickup(e.x, e.arcade.center.y, Math.round(e.def.reward / gems));
    this.fx.burst(e.x, e.arcade.center.y, 0xb48cff, e.def.behavior === 'boss' ? 30 : 12);
    this.fx.flash(e.x, e.arcade.center.y, 0xb48cff, e.def.behavior === 'boss' ? 3 : 1, 220);
    audio.play(e.def.behavior === 'boss' ? 'explode' : 'enemyDie');
    this.tweens.add({
      targets: e, scaleX: 1.3, scaleY: 0.2, alpha: 0, y: e.y + 10, duration: 220, ease: 'Cubic.easeIn',
      onComplete: () => e.destroy(),
    });
  }

  private hurtPlayer(amount: number, fromX: number): void {
    if (this.ended) return;
    const dealt = this.player.hurt(amount, fromX, this.now);
    if (dealt <= 0) return;
    this.fx.number(this.player.x, this.player.arcade.y - 8, `-${Math.round(dealt)}`, '#ff5d73');
    this.fx.spark(this.player.x, this.player.arcade.center.y, 0xff5d73, 8);
    this.cameras.main.shake(140, 0.006);
    audio.play('hurt');
    if (this.match.playerHealth.dead) this.finish('defeat');
  }

  private applySpikes(e: Enemy, now: number): void {
    const body = e.arcade;
    const b = this.match.building;
    const ty = Math.floor((body.bottom - 2) / TILE);
    for (let tx = Math.floor(body.x / TILE); tx <= Math.floor((body.right - 1) / TILE); tx++) {
      if (b.get(tx, ty).trap !== 'spikes') continue;
      if (!this.spikeTimer.tryDamage(e.id, now, SPIKES.interval)) return;
      this.damageEnemy(e, SPIKES.damage, 0);
      b.damage(tx, ty, SPIKES.wear);
      return;
    }
  }

  private explode(cx: number, cy: number, ex: ExplosiveDef): void {
    const x = cx * TILE + TILE / 2;
    const y = cy * TILE + TILE / 2;
    const radius = ex.radius * TILE;
    this.fx.flash(x, y, 0xffb347, radius / 22, 380);
    this.fx.flash(x, y, 0xffffff, radius / 40, 200);
    this.fx.spark(x, y, 0xffb347, 26);
    this.fx.burst(x, y, 0x55597a, 16);
    this.cameras.main.shake(260, 0.012);
    audio.play('explode');
    for (const e of (this.enemies.getChildren() as Enemy[]).slice()) {
      if (!e.alive) continue;
      const dmg = explosionDamage(ex.damage, Math.hypot(e.x - x, e.arcade.center.y - y), radius + e.arcade.halfWidth);
      if (dmg > 0) this.damageEnemy(e, dmg, (e.x < x ? -1 : 1) * 320);
    }
    // O herói também se fere, mas menos: explosivo é arma de risco.
    const pd = explosionDamage(ex.damage * 0.35, Math.hypot(this.player.x - x, this.player.arcade.center.y - y), radius);
    if (pd > 0) this.hurtPlayer(pd, x);
  }

  // ------------------------------------------------------------ recursos

  private dropPickup(x: number, y: number, value: number): void {
    if (value <= 0) return;
    if (this.pickups.getLength() >= 50) { this.match.resources.add(value); return; }
    const p = this.physics.add.image(x, y, 'pickup').setDepth(18);
    p.setData('value', value).setData('born', this.now);
    this.pickups.add(p);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Phaser.Math.Between(-110, 110), Phaser.Math.Between(-320, -180));
    body.setBounce(0.35).setDragX(160).setCollideWorldBounds(true);
  }

  private collect(p: Phaser.Physics.Arcade.Image): void {
    if (!p.active) return;
    const value = (p.getData('value') as number) ?? 0;
    this.match.resources.add(value);
    this.fx.number(p.x, p.y - 8, `+${value}`, '#ffd166');
    audio.play('pickup');
    p.destroy();
  }

  private updatePickups(now: number, dt: number): void {
    const px = this.player.x;
    const py = this.player.arcade.center.y;
    for (const p of (this.pickups.getChildren() as Phaser.Physics.Arcade.Image[]).slice()) {
      const age = now - ((p.getData('born') as number) ?? now);
      if (age > 25) { p.destroy(); continue; }
      p.setAlpha(age > 21 && Math.floor(now * 8) % 2 === 0 ? 0.3 : 1);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < 110 && d > 1 && !this.ended) {
        const body = p.body as Phaser.Physics.Arcade.Body;
        body.velocity.x += ((px - p.x) / d) * 1500 * dt;
        body.velocity.y += ((py - p.y) / d) * 1500 * dt;
      }
    }
  }

  private buy(id: UpgradeId): void {
    if (this.ended) return;
    if (buyUpgrade(this.match, id)) {
      audio.play('upgrade');
      this.fx.spark(this.player.x, this.player.arcade.center.y, 0x4ee3a4, 16);
      this.hud.toast(`${UPGRADES[id].label} comprado`, 1200, true);
    } else {
      audio.play('deny');
    }
  }

  // ---------------------------------------------------------------- ondas

  private spawnEnemy(type: EnemyType, x: number, y: number, hpScale = 1): Enemy {
    const e = new Enemy(this, x, y, type, hpScale);
    this.enemies.add(e);
    this.fx.flash(x, y, 0xb48cff, 1.1, 260);
    return e;
  }

  private spawnWaveEnemy(type: EnemyType): number | null {
    if (this.enemies.getLength() >= WAVES.maxActiveEnemies) return null;
    const p = this.spawnPoints[this.spawnSide++ % this.spawnPoints.length];
    // Grandes nascem mais alto para não ficar dentro do chão; voadores, no ar.
    const lift = type === 'boss' ? 30 : type === 'tank' ? 16 : type === 'flyer' ? TILE * 4 : 0;
    return this.spawnEnemy(type, p.x, p.y - lift, this.waveDef?.hpScale ?? 1).id;
  }

  private onWaveStart(def: WaveDef): void {
    this.waveDef = def;
    audio.play('waveStart');
    this.hud.banner(`Onda ${def.number}${def.boss ? ' — CHEFE' : ''}`, `${def.enemies.length} inimigos a caminho`, 2400);
  }

  private onWaveComplete(def: WaveDef): void {
    this.match.resources.add(def.reward);
    const healed = Math.round(this.match.playerHealth.heal(WAVES.healOnClear));
    rollOffers(this.match);
    audio.play('waveClear');
    this.hud.banner(`Onda ${def.number} concluída`, `+${def.reward} materiais${healed > 0 ? ` · +${healed} de vida` : ''}`, 2600);
    if (def.number > save.data.bestWave) { save.data.bestWave = def.number; save.save(); }
  }

  // ----------------------------------------------------------- construção

  private buildContext(): BuildContext {
    return {
      player: this.player.rect,
      enemies: (this.enemies.getChildren() as Enemy[]).filter((e) => e.alive).map((e) => e.rect),
    };
  }

  private setBuildOpen(open: boolean): void {
    if (this.ended) return;
    this.buildMenu.setOpen(open);
    if (!open) this.tool = { kind: 'none' };
    audio.play('click');
  }

  private pickTool(tool: BuildTool): void {
    if (this.ended) return;
    // Escolher de novo a ferramenta já ativa desfaz a seleção.
    const same = tool.kind === this.tool.kind && (tool.kind !== 'piece' || (this.tool.kind === 'piece' && tool.id === this.tool.id));
    this.tool = same && tool.kind !== 'none' ? { kind: 'none' } : tool;
    if (this.tool.kind !== 'none' && !this.buildMenu.open) this.buildMenu.setOpen(true);
    audio.play('click');
  }

  private pointerCell(p: Phaser.Input.Pointer): { x: number; y: number } {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(wp.x / TILE), y: Math.floor(wp.y / TILE) };
  }

  /** Clique esquerdo com uma ferramenta ativa: confirma a ação na célula sob o cursor. */
  private confirmBuild(p: Phaser.Input.Pointer): void {
    if (this.tool.kind === 'none') return;
    const cell = this.pointerCell(p);
    const b = this.match.building;
    const ctx = this.buildContext();
    let r: Pick<BuildCheck, 'ok' | 'reason'>;
    if (this.tool.kind === 'piece') r = b.place(this.tool.id, cell.x, cell.y, ctx);
    else if (this.tool.kind === 'repair') r = b.repair(cell.x, cell.y, ctx);
    else r = b.remove(cell.x, cell.y, ctx);
    if (!r.ok && r.reason) { this.hud.toast(FAILURE_TEXT[r.reason]); audio.play('deny'); }
  }

  /** Fantasma da peça sob o cursor: verde se válida, vermelho com o motivo se não. */
  private updatePreview(): void {
    this.outline.clear();
    const p = this.input.activePointer;
    if (this.tool.kind === 'none' || this.ended || this.paused) {
      this.ghost.setVisible(false);
      this.hud.tip(null);
      return;
    }
    const cell = this.pointerCell(p);
    const b = this.match.building;
    const ctx = this.buildContext();
    let ok: boolean;
    let text: string;
    this.ghost.setVisible(false);
    if (this.tool.kind === 'piece') {
      const def = blockById(this.tool.id);
      const r = b.check(this.tool.id, cell.x, cell.y, ctx);
      ok = r.ok;
      text = ok ? `${def.name} — custo ${r.cost} · clique para construir` : `${def.name} (${r.cost}) — ${FAILURE_TEXT[r.reason ?? 'occupied']}`;
      this.ghost.setFrame(def.index).setPosition(cell.x * TILE, cell.y * TILE).setVisible(true).setTint(ok ? 0xaaffcc : 0xff8a8a);
    } else if (this.tool.kind === 'repair') {
      const r = b.checkRepair(cell.x, cell.y, ctx);
      ok = r.ok;
      text = ok ? `Reparar ${b.get(cell.x, cell.y).name} — custo ${r.cost}` : FAILURE_TEXT[r.reason ?? 'nothing_to_remove'];
    } else {
      const r = b.checkRemove(cell.x, cell.y, ctx);
      ok = r.ok;
      text = ok ? `Demolir ${b.get(cell.x, cell.y).name} — devolve ${r.refund}` : FAILURE_TEXT[r.reason ?? 'nothing_to_remove'];
    }
    this.outline.lineStyle(2, ok ? 0x4ee3a4 : 0xff5d73, 1);
    this.outline.strokeRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2);
    this.hud.tip(text, ok);
  }

  /** Reage às mudanças da grade: tilemap, colisão, torretas e efeitos. */
  private onBuildEvent(e: BuildEvent): void {
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE + TILE / 2;
    const tint = BLOCK_TINT[e.block.id] ?? 0xffffff;
    switch (e.type) {
      case 'placed':
        this.view.sync(e.x, e.y);
        if (e.block.trap === 'turret') this.turrets.add(e.x, e.y);
        this.match.blocksPlaced++;
        this.fx.pop(cx, cy, e.block.index);
        this.fx.burst(cx, cy + TILE / 2, 0xcfd6ee, 6);
        audio.play('place');
        break;
      case 'removed':
        this.view.sync(e.x, e.y);
        this.turrets.remove(e.x, e.y);
        this.fx.burst(cx, cy, tint, 6);
        if (e.refund > 0) this.fx.number(cx, cy - 10, `+${e.refund}`, '#ffd166');
        audio.play('remove');
        break;
      case 'repaired':
        this.view.setDamage(e.x, e.y);
        this.fx.spark(cx, cy, 0x4ee3a4, 10);
        this.fx.number(cx, cy - 10, `-${e.cost}`, '#4ee3a4');
        audio.play('place');
        break;
      case 'damaged':
        this.view.setDamage(e.x, e.y);
        break;
      case 'destroyed':
        this.view.sync(e.x, e.y);
        this.turrets.remove(e.x, e.y);
        this.fx.burst(cx, cy, tint, 14);
        audio.play('break');
        if (e.block.drops) for (let i = 0; i < 3; i++) this.dropPickup(cx, cy, Math.round(e.block.drops / 3));
        break;
      case 'explosion':
        this.explode(e.x, e.y, e.explosive);
        break;
    }
  }

  // ------------------------------------------------------ pausa e término

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.justPressed.clear();
    this.touch.release();
    this.pauseMenu.setOpen(this.paused);
    audio.play('click');
    if (this.paused) this.scene.pause();
    else this.scene.resume();
  }

  private finish(outcome: 'victory' | 'defeat'): void {
    if (this.ended) return;
    this.ended = true;
    this.match.outcome = outcome;
    this.buildMenu.setOpen(false);
    this.tool = { kind: 'none' };
    this.touch.release();
    const waves = this.waves.completed;
    let record: boolean;
    if (!this.recorded) {
      record = save.recordMatch(waves, this.match.kills, this.match.blocksPlaced);
      this.recorded = true;
    } else {
      // Partida que seguiu no modo infinito: soma só o que veio depois.
      record = waves > save.data.bestWave;
      if (record) save.data.bestWave = waves;
      save.data.stats.kills += this.match.kills - this.recordedKills;
      save.save();
    }
    this.recordedKills = this.match.kills;
    audio.setMusic(null);
    audio.play(outcome === 'victory' ? 'victory' : 'defeat');
    if (outcome === 'defeat') {
      this.player.arcade.setAcceleration(0, 0);
      this.player.play('player-hurt', true);
      this.fx.burst(this.player.x, this.player.arcade.center.y, 0x67e8f9, 24);
    }
    const data: GameOverData = {
      outcome, waves, kills: this.match.kills, blocksPlaced: this.match.blocksPlaced,
      bestWave: Math.max(save.data.bestWave, waves), record,
    };
    this.time.delayedCall(900, () => {
      this.scene.pause();
      this.scene.launch('GameOver', data);
    });
  }

  /** Recomeça a partida do zero, sem recarregar a página. */
  restartMatch(): void {
    this.scene.stop('GameOver');
    this.scene.restart();
  }

  quitToMenu(): void {
    this.scene.stop('GameOver');
    this.scene.start('Menu');
  }

  /** Depois da vitória: segue com ondas além da última. */
  continueEndless(): void {
    if (this.match.outcome !== 'victory') return;
    this.match.outcome = 'playing';
    this.ended = false;
    this.waves.continueEndless();
    this.scene.resume();
    this.hud.banner('Modo infinito', 'As ondas continuam ficando mais difíceis.', 2600);
    setDebugScene('game', this.debugApi());
  }

  private cleanup(): void {
    this.abort.abort();
    this.match.building.clearListeners();
    this.turrets.destroy();
    this.hud.destroy();
    this.buildMenu.destroy();
    this.pauseMenu.destroy();
    this.touch.destroy();
    this.input.off(Phaser.Input.Events.POINTER_DOWN);
    for (const list of this.keys.values()) for (const k of list) k.removeAllListeners();
    for (const k of this.digitKeys) k.removeAllListeners();
    this.keys.clear();
  }

  // ---------------------------------------------------------------- testes

  private debugApi(): DebugApi {
    return {
      snapshot: () => {
        const b = this.player.arcade;
        return {
          time: this.now, paused: this.paused, outcome: this.match.outcome, arena: this.match.level.id,
          player: {
            x: b.center.x, y: b.bottom, hp: this.match.playerHealth.hp, maxHp: this.match.playerHealth.max,
            facing: this.player.facing, onFloor: this.player.onFloor,
            tx: Math.floor(b.center.x / TILE), ty: Math.floor((b.bottom - 2) / TILE),
          },
          resources: this.match.resources.value,
          kills: this.match.kills,
          offers: this.match.offers.slice(),
          wave: { number: this.waves.number, completed: this.waves.completed, phase: this.waves.phase, remaining: this.waves.remaining, timer: this.waves.timer },
          enemies: (this.enemies.getChildren() as Enemy[]).map((e) => ({ id: e.id, type: e.def.type, x: e.x, y: e.y, hp: e.health.hp, state: e.ai })),
          ownedBlocks: this.match.building.countOwned(),
          turrets: this.turrets.count,
          bullets: this.bullets.countActive(true) + this.turretBullets.countActive(true) + this.enemyBullets.countActive(true),
          pickups: this.pickups.getLength(),
        };
      },
      cell: (tx, ty) => this.match.building.get(tx, ty).id,
      cellHp: (tx, ty) => this.match.building.hpAt(tx, ty),
      cellToClient: (tx, ty) => {
        const cam = this.cameras.main;
        const rect = this.game.canvas.getBoundingClientRect();
        return {
          x: rect.left + (((tx + 0.5) * TILE - cam.scrollX) / VIEW_WIDTH) * rect.width,
          y: rect.top + (((ty + 0.5) * TILE - cam.scrollY) / VIEW_HEIGHT) * rect.height,
        };
      },
      spawnEnemy: (type, tiles) => {
        // Em cima do primeiro bloco sólido da coluna, nunca dentro do terreno.
        const x = this.player.x + tiles * TILE;
        const tx = Math.floor(x / TILE);
        let ty = 0;
        while (ty < this.match.building.rows && !this.match.building.blocks('enemy', tx, ty)) ty++;
        return this.spawnEnemy(type, x, ty * TILE - (type === 'boss' ? 60 : type === 'flyer' ? TILE * 4 : 40)).id;
      },
      damageCell: (tx, ty, amount) => { this.match.building.damage(tx, ty, amount); },
      setPrepTimer: (seconds) => { if (this.waves.phase === 'preparing') this.waves.timer = seconds; },
      forceVictory: () => {
        this.waves.completed = WAVES.total;
        this.waves.phase = 'victory';
        this.finish('victory');
      },
      setResources: (amount) => {
        const r = this.match.resources;
        if (amount > r.value) r.add(amount - r.value); else r.spend(r.value - amount);
      },
    };
  }
}
