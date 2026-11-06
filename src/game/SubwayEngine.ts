import * as THREE from 'three';
import {
  ActivePowerUpTimers,
  CHARACTER_SKINS,
  CharacterSkin,
  FloatingCallout,
  GameHUDData,
  GameState,
  POWERUP_DURATIONS,
  PowerUpType,
} from './types';
import {
  BarrierKind,
  createBarrierMesh,
  createCoinMesh,
  createInspectorRig,
  createPowerupMesh,
  createRunnerRig,
  createTrainCarMesh,
  InspectorRig,
  RAMP_LENGTH,
  RunnerRig,
  TRAIN_HEIGHT,
  TRAIN_LENGTH,
} from './meshes';
import { sound } from './audio';

const LANE_WIDTH = 2.8;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

const BASE_SPEED = 24;
const MAX_SPEED = 52;
const GRAVITY = -54;
const NORMAL_JUMP_VEL = 17.2; // Peak ~2.74 (can even mantle train roofs at peak, easily clears barriers!)
const SUPER_JUMP_VEL = 23.2;  // Peak ~4.98 (soars effortlessly over trains!)
const FAST_DROP_VEL = -40;

interface TrainEntity {
  id: number;
  lane: number; // 0, 1, 2
  z: number;
  isMoving: boolean;
  moveSpeed: number;
  hasRamp: boolean;
  hornPlayed: boolean;
  closeCallAwarded: boolean;
  mesh: THREE.Group;
}

interface BarrierEntity {
  id: number;
  lane: number;
  z: number;
  kind: BarrierKind;
  mesh: THREE.Group;
}

interface CoinEntity {
  id: number;
  lane: number;
  x: number;
  y: number;
  z: number;
  attracted: boolean;
  mesh: THREE.Group;
}

interface PowerupEntity {
  id: number;
  lane: number;
  y: number;
  z: number;
  type: PowerUpType;
  mesh: THREE.Group;
}

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  mesh: THREE.Mesh;
}

export interface EngineCallbacks {
  onStateChange: (state: GameState) => void;
  onHUDUpdate: (hud: GameHUDData) => void;
  onCallout: (callout: FloatingCallout) => void;
  onGameOver: (finalHud: GameHUDData) => void;
}

export class SubwayEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private runner!: RunnerRig;
  private inspector!: InspectorRig;
  private menuPropTrain!: THREE.Group;

  private envChunks: THREE.Group[] = [];
  private readonly CHUNK_LEN = 30;
  private readonly NUM_CHUNKS = 8;

  private trains: TrainEntity[] = [];
  private barriers: BarrierEntity[] = [];
  private coins: CoinEntity[] = [];
  private powerups: PowerupEntity[] = [];
  private particles: Particle[] = [];

  private state: GameState = 'menu';
  private animFrameId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private entityIdCounter = 1;
  private calloutIdCounter = 1;

  // Player physics & lane state
  private currentLane = 1; // 0=left, 1=center, 2=right
  private prevLane = 1;
  private laneSwitchTimer = 0;
  private playerX = 0;
  private playerY = 0;
  private playerVy = 0;
  private groundY = 0;
  private isGrounded = true;
  private isRolling = false;
  private rollTimer = 0;
  private fastDropping = false;
  private bufferedAction: 'jump' | 'roll' | null = null;
  private bufferedTimer = 0;

  // Gameplay stats
  private worldSpeed = BASE_SPEED;
  private distance = 0;
  private score = 0;
  private runCoins = 0;
  private coinStreak = 0;
  private coinStreakTimer = 0;
  private bestCombo = 0;
  private crashReason = '';

  // Hoverboard & Stumble / Inspector state
  private hoverboardsLeft = 3;
  private hoverboardCooldown = 0;
  private stumbleTimer = 0; // > 0 when inspector is right behind player
  private openingChaseTimer = 0;
  private invulnerableTimer = 0;
  private wasOnRoof = false;
  private rooftopBonusCooldown = 0;

  private powerupTimers: ActivePowerUpTimers = {
    jetpack: 0,
    magnet: 0,
    sneakers: 0,
    multiplier: 0,
    hoverboard: 0,
  };

  // Spawner state
  private nextSpawnZ = -42; // Track coordinate distance to next pattern
  private patternCount = 0;
  private skyCoinSpawnAccum = 0;

  // Camera & Juice
  private camShake = 0;
  private camPos = new THREE.Vector3(0, 4.8, 7.6);
  private camLook = new THREE.Vector3(0, 1.8, -14);
  private hudSyncTimer = 0;
  private currentSkin: CharacterSkin = CHARACTER_SKINS[0];

  // Touch / Swipe gesture tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchConsumed = false;
  private lastTapTime = 0;

  constructor(container: HTMLElement, initialSkin: CharacterSkin, callbacks: EngineCallbacks) {
    this.container = container;
    this.currentSkin = initialSkin;
    this.callbacks = callbacks;

    this.initScene();
    this.initEnvironment();
    this.initActors();
    this.initParticles();
    this.bindInputs();

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private initScene() {
    this.scene = new THREE.Scene();
    // Vibrant urban twilight sky color & horizon fog
    const skyColor = new THREE.Color('#131b3a');
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2('#172042', 0.0082);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 230);
    this.camera.position.copy(this.camPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Rich colorful lighting: warm golden sunset key light + cool sky hemisphere + neon bounce
    const hemi = new THREE.HemisphereLight('#93c5fd', '#1e1b4b', 1.15);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight('#fff1d6', 1.75);
    dirLight.position.set(16, 28, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 95;
    const d = 24;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Distant glowing sunset/neon horizon backdrop disc
    const sunGeo = new THREE.CircleGeometry(28, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: '#fb7185',
      transparent: true,
      opacity: 0.45,
      fog: false,
    });
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    sunDisc.position.set(0, 26, -185);
    this.scene.add(sunDisc);
  }

  private initEnvironment() {
    const gravelMat = new THREE.MeshStandardMaterial({ color: '#27293d', roughness: 0.95 });
    const platformMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });
    const curbMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 });
    const sleeperMat = new THREE.MeshStandardMaterial({ color: '#452719', roughness: 0.9 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.2 });
    const archMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.5 });

    const buildingPalette = ['#1e293b', '#312e81', '#1e3a8a', '#3b0764', '#0f172a', '#3730a3'];
    const neonPalette = ['#38bdf8', '#f43f5e', '#facc15', '#a855f7', '#2dd4bf'];

    for (let i = 0; i < this.NUM_CHUNKS; i++) {
      const chunk = new THREE.Group();

      // Roadbed gravel
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(12.5, this.CHUNK_LEN), gravelMat);
      bed.rotation.x = -Math.PI / 2;
      bed.receiveShadow = true;
      chunk.add(bed);

      // Raised side platforms
      for (const side of [-1, 1]) {
        const plat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.9, this.CHUNK_LEN), platformMat);
        plat.position.set(side * 10.6, 0.4, 0);
        plat.receiveShadow = true;
        chunk.add(plat);

        const safetyLine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.92, this.CHUNK_LEN), curbMat);
        safetyLine.position.set(side * 5.72, 0.4, 0);
        chunk.add(safetyLine);
      }

      // 3 lanes of steel rails & wooden sleepers
      for (const laneX of LANES) {
        for (const rOff of [-0.58, 0.58]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, this.CHUNK_LEN), railMat);
          rail.position.set(laneX + rOff, 0.07, 0);
          chunk.add(rail);
        }

        for (let sz = -this.CHUNK_LEN / 2 + 1; sz < this.CHUNK_LEN / 2; sz += 1.8) {
          const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 0.34), sleeperMat);
          sleeper.position.set(laneX, 0.025, sz);
          chunk.add(sleeper);
        }
      }

      // Overhead catenary steel gantry & glowing street lamps
      const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 7.6, 0.38), archMat);
      pillarL.position.set(-5.9, 3.8, 0);
      chunk.add(pillarL);

      const pillarR = pillarL.clone();
      pillarR.position.x = 5.9;
      chunk.add(pillarR);

      const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(12.3, 0.35, 0.35), archMat);
      crossBeam.position.set(0, 7.5, 0);
      chunk.add(crossBeam);

      // Neon light strips on catenary posts
      const neonColor = neonPalette[i % neonPalette.length];
      const lampMat = new THREE.MeshBasicMaterial({ color: neonColor });
      const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.8, 0.16), lampMat);
      lampL.position.set(-5.68, 5.4, 0);
      chunk.add(lampL);
      const lampR = lampL.clone();
      lampR.position.x = 5.68;
      chunk.add(lampR);

      // Urban skyline buildings on left & right
      for (const side of [-1, 1]) {
        for (let b = 0; b < 2; b++) {
          const bHeight = 9 + ((i * 7 + b * 5 + (side > 0 ? 3 : 0)) % 14);
          const bWidth = 5.5 + ((i + b) % 3) * 1.4;
          const bDepth = 11.5;
          const bColor = buildingPalette[(i + b + (side > 0 ? 2 : 0)) % buildingPalette.length];

          const bMesh = new THREE.Mesh(
            new THREE.BoxGeometry(bWidth, bHeight, bDepth),
            new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.85 })
          );
          const bz = (b - 0.5) * 14.5;
          const bx = side * (9.8 + bWidth / 2);
          bMesh.position.set(bx, bHeight / 2 + 0.8, bz);
          chunk.add(bMesh);

          // Lit neon billboard or window band
          const winColor = neonPalette[(i + b * 2 + (side > 0 ? 1 : 0)) % neonPalette.length];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 1.3),
            new THREE.MeshBasicMaterial({ color: winColor })
          );
          sign.position.set(side * 9.75, 4.2 + (b % 2) * 2.4, bz);
          sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          chunk.add(sign);
        }
      }

      chunk.position.z = 15 - i * this.CHUNK_LEN;
      this.scene.add(chunk);
      this.envChunks.push(chunk);
    }
  }

  private initActors() {
    this.runner = createRunnerRig(this.currentSkin);
    this.scene.add(this.runner.group);

    this.inspector = createInspectorRig();
    this.scene.add(this.inspector.group);

    // Start Screen prop: parked graffiti subway car in right lane
    this.menuPropTrain = createTrainCarMesh(1, false, false);
    this.menuPropTrain.position.set(LANES[2], 0, -2.5);
    this.scene.add(this.menuPropTrain);

    this.poseForMenu(0);
  }

  private initParticles() {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    for (let i = 0; i < 160; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        life: 0,
        maxLife: 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        mesh,
      });
    }
  }

  private emitParticles(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    count: number,
    spread = 3.5,
    upward = 3.5,
    scale = 1
  ) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.maxLife = 0.32 + Math.random() * 0.35;
        p.life = p.maxLife;
        p.vx = (Math.random() - 0.5) * spread * 2;
        p.vy = Math.random() * upward + 0.5;
        p.vz = (Math.random() - 0.5) * spread * 2;
        p.mesh.position.set(
          x + (Math.random() - 0.5) * 0.4,
          y + (Math.random() - 0.5) * 0.4,
          z + (Math.random() - 0.5) * 0.4
        );
        p.mesh.scale.setScalar(scale * (0.7 + Math.random() * 0.7));
        (p.mesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += (p.vz + (this.state === 'playing' ? this.worldSpeed * 0.45 : 0)) * dt;
      p.mesh.rotation.x += 6 * dt;
      p.mesh.rotation.y += 7 * dt;
      const ratio = p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio;
    }
  }

  private bindInputs() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);

    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointercancel', this.handlePointerUp);
  }

  public destroy() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    sound.stopMusic();
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointercancel', this.handlePointerUp);
    this.renderer.dispose();
  }

  private handleResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // Do not hijack typing inside high-score player tag input!
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    sound.unlock();

    if (this.state === 'menu') {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    if (this.state === 'gameover') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyR') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }

    if (this.state !== 'playing') return;

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        this.moveLane(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        this.moveLane(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        this.triggerJump();
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        this.triggerRoll();
        break;
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        e.preventDefault();
        this.activateHoverboard();
        break;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    sound.unlock();
    if (this.state !== 'playing') return;

    const now = performance.now();
    if (now - this.lastTapTime < 280) {
      this.activateHoverboard();
      this.lastTapTime = 0;
    } else {
      this.lastTapTime = now;
    }

    this.touchStartX = e.clientX;
    this.touchStartY = e.clientY;
    this.touchConsumed = false;
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.state !== 'playing' || this.touchConsumed) return;
    if (e.buttons === 0 && e.pointerType === 'mouse') return;

    const dx = e.clientX - this.touchStartX;
    const dy = e.clientY - this.touchStartY;
    const dist = Math.hypot(dx, dy);

    // Zero-latency instant swipe recognition at 22px threshold!
    if (dist > 22) {
      this.touchConsumed = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.moveLane(dx > 0 ? 1 : -1);
      } else {
        if (dy < 0) {
          this.triggerJump();
        } else {
          this.triggerRoll();
        }
      }
    }
  };

  private handlePointerUp = () => {
    this.touchConsumed = false;
  };

  public setSkin(skin: CharacterSkin) {
    this.currentSkin = skin;
    this.runner.applySkin(skin);
    this.emitParticles(this.runner.group.position.x, 1.3, this.runner.group.position.z, skin.boardGlow, 18, 2.5, 3.5);
    sound.playCoin(4);
  }

  public togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      sound.stopMusic();
      this.callbacks.onStateChange('paused');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.lastTime = performance.now();
      sound.startMusic();
      this.callbacks.onStateChange('playing');
    }
  }

  public returnToMenu() {
    this.clearWorldEntities();
    this.state = 'menu';
    this.menuPropTrain.visible = true;
    sound.stopMusic();
    this.poseForMenu(this.elapsed);
    this.callbacks.onStateChange('menu');
  }

  public startGame() {
    sound.unlock();
    this.clearWorldEntities();
    this.menuPropTrain.visible = false;

    // Reset player physics & stats
    this.currentLane = 1;
    this.prevLane = 1;
    this.laneSwitchTimer = 0;
    this.playerX = LANES[1];
    this.playerY = 0;
    this.playerVy = 0;
    this.groundY = 0;
    this.isGrounded = true;
    this.isRolling = false;
    this.rollTimer = 0;
    this.fastDropping = false;
    this.bufferedAction = null;
    this.bufferedTimer = 0;

    this.worldSpeed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this.runCoins = 0;
    this.coinStreak = 0;
    this.coinStreakTimer = 0;
    this.bestCombo = 0;
    this.crashReason = '';

    this.hoverboardsLeft = 3;
    this.hoverboardCooldown = 0;
    this.stumbleTimer = 0;
    this.openingChaseTimer = 3.6; // Inspector chases you out of the yard on start!
    this.invulnerableTimer = 0;
    this.wasOnRoof = false;
    this.rooftopBonusCooldown = 0;
    this.camShake = 0.25;

    this.powerupTimers = {
      jetpack: 0,
      magnet: 0,
      sneakers: 0,
      multiplier: 0,
      hoverboard: 0,
    };

    this.runner.sprayCan.visible = false;
    this.runner.hoverboard.visible = false;
    this.runner.jetpack.visible = false;
    this.runner.superShoeLeft.visible = false;
    this.runner.superShoeRight.visible = false;
    this.runner.magnetHalo.visible = false;
    this.runner.group.rotation.set(0, 0, 0); // Rig naturally faces -Z down the tracks!
    this.runner.bodyPivot.scale.set(1, 1, 1);

    // Pre-populate initial 190m of exciting track patterns!
    this.nextSpawnZ = -26;
    this.patternCount = 0;
    while (this.nextSpawnZ > -195) {
      this.spawnNextPattern();
    }

    this.state = 'playing';
    this.lastTime = performance.now();
    sound.playWhistleAndBark();
    sound.setDynamicTempo(0, false);
    sound.startMusic();

    this.callbacks.onStateChange('playing');
    this.pushHUDUpdate();
    this.emitCallout('BUSTED! RUN!', 'Swipe or Arrow Keys to Dodge', '#facc15');
  }

  private clearWorldEntities() {
    for (const t of this.trains) this.scene.remove(t.mesh);
    for (const b of this.barriers) this.scene.remove(b.mesh);
    for (const c of this.coins) this.scene.remove(c.mesh);
    for (const p of this.powerups) this.scene.remove(p.mesh);
    this.trains = [];
    this.barriers = [];
    this.coins = [];
    this.powerups = [];
  }

  private emitCallout(text: string, subtext: string | undefined, color: string) {
    this.callbacks.onCallout({
      id: this.calloutIdCounter++,
      text,
      subtext,
      color,
    });
  }

  // ==================== PLAYER CONTROLS ====================

  public moveLane(dir: -1 | 1) {
    if (this.state !== 'playing') return;
    const next = this.currentLane + dir;
    if (next < 0 || next > 2) {
      // Edge rail bump feedback
      this.camShake = Math.max(this.camShake, 0.14);
      return;
    }

    // Check Close-Call dodge bonus before leaving current lane!
    if (this.powerupTimers.jetpack <= 0) {
      for (const t of this.trains) {
        if (t.lane === this.currentLane && !t.closeCallAwarded) {
          const frontDist = -(t.z + TRAIN_LENGTH / 2); // positive when train front is ahead in -Z
          if (frontDist > 0.3 && frontDist < 5.2 && this.playerY < TRAIN_HEIGHT - 0.3) {
            t.closeCallAwarded = true;
            const bonus = 150 * this.getEffectiveMultiplier();
            this.score += bonus;
            this.emitCallout(`CLOSE CALL! +${bonus}`, 'Razor-sharp reflex!', '#38bdf8');
            this.emitParticles(this.playerX, this.playerY + 1, 0, '#38bdf8', 12, 3, 3);
          }
        }
      }
    }

    this.prevLane = this.currentLane;
    this.currentLane = next;
    this.laneSwitchTimer = 0.14;
    sound.playSwipe();
    this.emitParticles(this.playerX, this.playerY + 0.2, 0, '#e2e8f0', 5, 1.8, 1.5, 0.7);
  }

  public triggerJump() {
    if (this.state !== 'playing' || this.powerupTimers.jetpack > 0) return;

    if (this.isGrounded) {
      this.executeJump();
    } else {
      // Buffer jump right before landing!
      this.bufferedAction = 'jump';
      this.bufferedTimer = 0.16;
    }
  }

  private executeJump() {
    const hasSuper = this.powerupTimers.sneakers > 0;
    this.playerVy = hasSuper ? SUPER_JUMP_VEL : NORMAL_JUMP_VEL;
    this.isGrounded = false;
    this.isRolling = false;
    this.rollTimer = 0;
    this.fastDropping = false;
    sound.playJump(hasSuper);
    this.emitParticles(
      this.playerX,
      this.playerY + 0.1,
      0,
      hasSuper ? '#84cc16' : '#f8fafc',
      hasSuper ? 14 : 7,
      2.4,
      2.2
    );
  }

  public triggerRoll() {
    if (this.state !== 'playing' || this.powerupTimers.jetpack > 0) return;

    if (!this.isGrounded) {
      // Signature Subway Surfers mid-air Fast-Drop Cancel!
      this.playerVy = FAST_DROP_VEL;
      this.fastDropping = true;
      this.isRolling = true;
      this.rollTimer = 0.62;
      sound.playRoll(true);
    } else {
      this.isRolling = true;
      this.rollTimer = 0.62;
      sound.playRoll(false);
      this.emitParticles(this.playerX, this.playerY + 0.15, 0, '#cbd5e1', 6, 2.0, 1.2, 0.7);
    }
  }

  public activateHoverboard() {
    if (this.state !== 'playing') return;
    if (this.powerupTimers.hoverboard > 0 || this.powerupTimers.jetpack > 0) return;
    if (this.hoverboardsLeft <= 0 || this.hoverboardCooldown > 0) return;

    this.hoverboardsLeft--;
    this.powerupTimers.hoverboard = POWERUP_DURATIONS.hoverboard;
    this.runner.hoverboard.visible = true;
    this.camShake = Math.max(this.camShake, 0.25);
    sound.playHoverboardStart();
    this.emitParticles(this.playerX, this.playerY + 0.3, 0, this.currentSkin.boardGlow, 24, 4, 3.5);
    this.emitCallout('HOVERBOARD ON!', 'Crash Shield Active!', '#ec4899');
    this.pushHUDUpdate();
  }

  // ==================== SMART TRACK PATTERN DIRECTOR ====================

  private spawnCoinLine(lane: number, startZ: number, count: number, spacing = 2.3, y = 0.85) {
    for (let i = 0; i < count; i++) {
      this.addCoin(lane, y, startZ - i * spacing);
    }
  }

  private spawnCoinArc(lane: number, centerZ: number, peakY = 2.45, halfSpan = 5.2, count = 7) {
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1)) * 2 - 1; // -1 .. +1
      const z = centerZ - t * halfSpan;
      const y = 0.8 + (peakY - 0.8) * (1 - t * t);
      this.addCoin(lane, y, z);
    }
  }

  private addCoin(lane: number, y: number, z: number) {
    const mesh = createCoinMesh();
    mesh.position.set(LANES[lane], y, z);
    this.scene.add(mesh);
    this.coins.push({
      id: this.entityIdCounter++,
      lane,
      x: LANES[lane],
      y,
      z,
      attracted: false,
      mesh,
    });
  }

  private addBarrier(lane: number, z: number, kind: BarrierKind) {
    const mesh = createBarrierMesh(kind);
    mesh.position.set(LANES[lane], 0, z);
    this.scene.add(mesh);
    this.barriers.push({
      id: this.entityIdCounter++,
      lane,
      z,
      kind,
      mesh,
    });
  }

  private addTrain(lane: number, z: number, variant: number, isMoving: boolean, hasRamp: boolean) {
    const mesh = createTrainCarMesh(variant, isMoving, hasRamp);
    mesh.position.set(LANES[lane], 0, z);
    this.scene.add(mesh);
    this.trains.push({
      id: this.entityIdCounter++,
      lane,
      z,
      isMoving,
      moveSpeed: isMoving ? 15 + Math.min(10, this.worldSpeed * 0.25) : 0,
      hasRamp,
      hornPlayed: false,
      closeCallAwarded: false,
      mesh,
    });
  }

  private addPowerup(lane: number, y: number, z: number, forcedType?: PowerUpType) {
    const pool: PowerUpType[] = ['magnet', 'jetpack', 'sneakers', 'multiplier', 'hoverboard_pickup'];
    const type = forcedType ?? pool[Math.floor(Math.random() * pool.length)];
    const mesh = createPowerupMesh(type);
    mesh.position.set(LANES[lane], y, z);
    this.scene.add(mesh);
    this.powerups.push({
      id: this.entityIdCounter++,
      lane,
      y,
      z,
      type,
      mesh,
    });
  }

  private spawnNextPattern() {
    const z0 = this.nextSpawnZ;
    const idx = this.patternCount++;

    // Pattern 0: Exhilarating First-10-Seconds Welcome Gauntlet!
    if (idx === 0) {
      // Immediate line of coins in center lane + jump arc over low barrier + slide gate!
      this.spawnCoinLine(1, z0, 5, 2.2, 0.85);
      this.addBarrier(1, z0 - 15, 'low');
      this.spawnCoinArc(1, z0 - 15, 2.4, 5.2, 7);
      this.addTrain(0, z0 - 15, 0, false, false);

      this.addBarrier(1, z0 - 29, 'high');
      this.spawnCoinLine(1, z0 - 26, 4, 2.0, 0.65);
      this.addTrain(2, z0 - 28, 2, false, true); // Early climbable ramp train on right!
      this.spawnCoinLine(2, z0 - 22, 6, 2.3, TRAIN_HEIGHT + 0.85);
      this.addPowerup(2, TRAIN_HEIGHT + 0.95, z0 - 34, 'magnet');

      this.nextSpawnZ -= 44;
      return;
    }

    // Pattern 1: Second chunk guarantees another fun rooftop + early powerup opportunity
    if (idx === 1) {
      this.addTrain(1, z0 - 10, 1, false, true);
      this.addTrain(1, z0 - 25.5, 1, false, false);
      this.spawnCoinLine(1, z0 - 4, 10, 2.4, TRAIN_HEIGHT + 0.85);
      this.addPowerup(0, 1.0, z0 - 14, 'sneakers');
      this.addBarrier(2, z0 - 12, 'low');
      this.spawnCoinArc(2, z0 - 12, 2.4, 4.8, 5);
      this.addBarrier(0, z0 - 24, 'high');
      this.nextSpawnZ -= 38;
      return;
    }

    // Periodic Power-Up spawn every 3-4 patterns!
    const shouldSpawnPowerup = idx % 3 === 1;
    const patternType = Math.floor(Math.random() * 7);

    switch (patternType) {
      case 0: {
        // Rooftop Highway: Ramp train leading across 2-car chain + side barriers
        const rampLane = Math.floor(Math.random() * 3);
        const otherLanes = [0, 1, 2].filter((l) => l !== rampLane);
        const v = idx % 4;
        this.addTrain(rampLane, z0 - 10, v, false, true);
        this.addTrain(rampLane, z0 - 25.5, v, false, false);
        this.spawnCoinLine(rampLane, z0 - 5, 9, 2.5, TRAIN_HEIGHT + 0.85);

        this.addBarrier(otherLanes[0], z0 - 10, 'low');
        this.spawnCoinArc(otherLanes[0], z0 - 10, 2.4, 4.6, 5);
        this.addBarrier(otherLanes[1], z0 - 22, 'high');
        if (shouldSpawnPowerup) {
          this.addPowerup(rampLane, TRAIN_HEIGHT + 0.95, z0 - 28);
        }
        this.nextSpawnZ -= 38;
        break;
      }

      case 1: {
        // Oncoming Metro Express! 1 moving oncoming train + 1 stationary train + 1 open barrier lane
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
        const movingLane = lanes[0];
        const parkedLane = lanes[1];
        const openLane = lanes[2];

        this.addTrain(movingLane, z0 - 22, 3, true, false);
        this.addTrain(parkedLane, z0 - 12, 0, false, false);

        this.addBarrier(openLane, z0 - 9, 'low');
        this.spawnCoinArc(openLane, z0 - 9, 2.4, 4.5, 5);
        this.addBarrier(openLane, z0 - 22, 'high');
        this.spawnCoinLine(openLane, z0 - 19, 4, 2.0, 0.65);

        if (shouldSpawnPowerup) {
          this.addPowerup(openLane, 1.0, z0 - 28);
        }
        this.nextSpawnZ -= 36;
        break;
      }

      case 2: {
        // Slalom Coin Weave: Staggered stationary trains forcing snappy Left-Center-Right flow
        const firstBlock = Math.random() < 0.5 ? 0 : 2;
        const oppBlock = firstBlock === 0 ? 2 : 0;

        this.addTrain(firstBlock, z0 - 9, 1, false, false);
        this.addTrain(1, z0 - 23, 2, false, false);
        this.addTrain(oppBlock, z0 - 37, 0, false, false);

        this.spawnCoinLine(1, z0 - 3, 5, 2.1, 0.85);
        this.spawnCoinLine(oppBlock, z0 - 16, 5, 2.1, 0.85);
        this.spawnCoinLine(firstBlock, z0 - 30, 5, 2.1, 0.85);

        this.addBarrier(oppBlock, z0 - 10, 'high');
        this.addBarrier(firstBlock, z0 - 24, 'low');

        if (shouldSpawnPowerup) {
          this.addPowerup(1, 1.0, z0 - 36);
        }
        this.nextSpawnZ -= 47;
        break;
      }

      case 3: {
        // Hurdle & limbo sprint: Synchronized jump/roll gates across all 3 lanes
        this.addBarrier(0, z0 - 7, 'low');
        this.addBarrier(1, z0 - 7, 'high');
        this.addBarrier(2, z0 - 7, 'low');
        this.spawnCoinArc(0, z0 - 7, 2.4, 4.5, 5);
        this.spawnCoinLine(1, z0 - 4, 4, 2.0, 0.65);
        this.spawnCoinArc(2, z0 - 7, 2.4, 4.5, 5);

        this.addBarrier(0, z0 - 20, 'high');
        this.addBarrier(1, z0 - 20, 'low');
        this.addBarrier(2, z0 - 20, 'high');
        this.spawnCoinArc(1, z0 - 20, 2.4, 4.5, 5);

        if (shouldSpawnPowerup) {
          this.addPowerup(1, 2.5, z0 - 20);
        }
        this.nextSpawnZ -= 30;
        break;
      }

      case 4: {
        // Rooftop Crossover: Climb left/right ramp train, then leap across gap to center train roof!
        const startLane = Math.random() < 0.5 ? 0 : 2;
        this.addTrain(startLane, z0 - 10, 2, false, true);
        this.spawnCoinLine(startLane, z0 - 4, 5, 2.2, TRAIN_HEIGHT + 0.85);

        // Center train further ahead so player leaps diagonally/sideways onto its roof!
        this.addTrain(1, z0 - 24, 3, false, false);
        this.addTrain(1, z0 - 39.5, 3, false, false);
        this.spawnCoinLine(1, z0 - 19, 9, 2.4, TRAIN_HEIGHT + 0.85);

        // Ground open lane always safe too
        const groundLane = startLane === 0 ? 2 : 0;
        this.addBarrier(groundLane, z0 - 16, 'low');
        this.addBarrier(groundLane, z0 - 30, 'high');

        if (shouldSpawnPowerup) {
          this.addPowerup(1, TRAIN_HEIGHT + 1.0, z0 - 38);
        }
        this.nextSpawnZ -= 50;
        break;
      }

      case 5: {
        // Twin Oncoming Expresses (only when speed is warmed up; always leaves 1 safe lane!)
        const safeLane = Math.floor(Math.random() * 3);
        for (let l = 0; l < 3; l++) {
          if (l !== safeLane) {
            this.addTrain(l, z0 - 24 - l * 3, (idx + l) % 4, true, false);
          }
        }
        this.spawnCoinLine(safeLane, z0 - 6, 8, 2.2, 0.85);
        this.addBarrier(safeLane, z0 - 25, 'low');
        this.spawnCoinArc(safeLane, z0 - 25, 2.4, 4.8, 5);

        if (shouldSpawnPowerup) {
          this.addPowerup(safeLane, 2.5, z0 - 25);
        }
        this.nextSpawnZ -= 36;
        break;
      }

      default: {
        // Triple-train Yard with 1 Ramp! Climb over all 3 parallel trains!
        const rampLane = Math.floor(Math.random() * 3);
        for (let l = 0; l < 3; l++) {
          this.addTrain(l, z0 - 13, (l + idx) % 4, false, l === rampLane);
        }
        this.spawnCoinLine(rampLane, z0 - 6, 6, 2.2, TRAIN_HEIGHT + 0.85);
        // Diagonal rooftop coins across all 3 roofs!
        this.addCoin(0, TRAIN_HEIGHT + 0.85, z0 - 16);
        this.addCoin(1, TRAIN_HEIGHT + 0.85, z0 - 18.5);
        this.addCoin(2, TRAIN_HEIGHT + 0.85, z0 - 21);

        if (shouldSpawnPowerup) {
          this.addPowerup(1, TRAIN_HEIGHT + 1.0, z0 - 14, 'jetpack');
        }
        this.nextSpawnZ -= 30;
        break;
      }
    }
  }

  // ==================== MAIN 60FPS GAME LOOP ====================

  private loop = (now: number) => {
    this.animFrameId = requestAnimationFrame(this.loop);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05); // Clamp dt on tab switch

    if (this.state === 'menu') {
      this.elapsed += dt;
      this.poseForMenu(this.elapsed);
      this.updateParticles(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.state === 'gameover') {
      this.elapsed += dt;
      this.updateParticles(dt);
      this.updateGameOverCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // === PLAYING STATE ===
    this.elapsed += dt;
    this.updateGameplay(dt);
    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private poseForMenu(t: number) {
    // Runner stands next to parked train in right lane spraying graffiti & bouncing to the beat!
    this.runner.sprayCan.visible = true;
    this.runner.hoverboard.visible = false;
    this.runner.jetpack.visible = false;
    this.runner.magnetHalo.visible = false;
    this.runner.superShoeLeft.visible = false;
    this.runner.superShoeRight.visible = false;

    this.runner.group.position.set(0.65, Math.abs(Math.sin(t * 4.5)) * 0.08, -1.2);
    this.runner.group.rotation.set(0, Math.PI - 0.55 + Math.sin(t * 1.4) * 0.18, 0);
    this.runner.bodyPivot.scale.set(1, 1, 1);
    this.runner.bodyPivot.rotation.set(0, 0, 0);

    // Shaking spray-paint can animation
    this.runner.rightArm.rotation.x = -1.15 + Math.sin(t * 14) * 0.25;
    this.runner.leftArm.rotation.x = 0.25 * Math.sin(t * 4.5);
    this.runner.leftLeg.rotation.x = 0;
    this.runner.rightLeg.rotation.x = 0;

    if (Math.random() < 0.28) {
      this.emitParticles(1.25, 1.35, -1.2, this.currentSkin.boardGlow, 1, 0.8, 1.2, 0.55);
    }

    // Inspector patrolling curiously in background left lane
    this.inspector.group.visible = true;
    this.inspector.group.position.set(-2.5, 0, -5.5 + Math.sin(t * 1.2) * 1.2);
    this.inspector.group.rotation.y = Math.cos(t * 1.2) > 0 ? Math.PI - 0.2 : 0.2;
    this.inspector.leftLeg.rotation.x = Math.sin(t * 6) * 0.45;
    this.inspector.rightLeg.rotation.x = -Math.sin(t * 6) * 0.45;

    // Cinematic Start Screen camera orbit
    this.camera.fov = 52;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(-1.35 + Math.sin(t * 0.6) * 0.45, 2.35, 4.35);
    this.camera.lookAt(0.35, 1.35, -2.0);
  }

  private getEffectiveMultiplier(): number {
    // Base multiplier scales from x1 up to x15 with distance milestones, doubled when 2X Star is active!
    const distTier = 1 + Math.min(14, Math.floor(this.distance / 180));
    return this.powerupTimers.multiplier > 0 ? distTier * 2 : distTier;
  }

  private updateGameplay(dt: number) {
    // 1. Escalate speed smoothly over time (thrilling within 10s, pro-fast at 90s+)
    const isJetpack = this.powerupTimers.jetpack > 0;
    const targetBaseSpeed = Math.min(MAX_SPEED, BASE_SPEED + this.distance * 0.017);
    this.worldSpeed = isJetpack ? targetBaseSpeed * 1.38 : targetBaseSpeed;

    const speedRatio = (targetBaseSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
    sound.setDynamicTempo(speedRatio, isJetpack);

    // Distance & continuous run score
    const stepZ = this.worldSpeed * dt;
    this.distance += stepZ * 0.42;
    this.score += stepZ * 1.8 * this.getEffectiveMultiplier();

    // Cooldowns & timers
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.hoverboardCooldown > 0) this.hoverboardCooldown = Math.max(0, this.hoverboardCooldown - dt);
    if (this.openingChaseTimer > 0) this.openingChaseTimer = Math.max(0, this.openingChaseTimer - dt);
    if (this.stumbleTimer > 0) this.stumbleTimer = Math.max(0, this.stumbleTimer - dt);
    if (this.coinStreakTimer > 0) {
      this.coinStreakTimer -= dt;
      if (this.coinStreakTimer <= 0) this.coinStreak = 0;
    }

    // Update active Power-Up timers
    this.updatePowerupTimers(dt);

    // 2. Scroll recycled 3D Track Environment Chunks
    for (const chunk of this.envChunks) {
      chunk.position.z += stepZ;
      if (chunk.position.z > this.CHUNK_LEN * 1.2) {
        chunk.position.z -= this.NUM_CHUNKS * this.CHUNK_LEN;
      }
    }

    // 3. Spawn upcoming obstacle patterns ahead
    this.nextSpawnZ += stepZ;
    while (this.nextSpawnZ > -185) {
      this.spawnNextPattern();
    }

    // Spawn dense sky-coins across all 3 lanes while flying on Jetpack!
    if (isJetpack) {
      this.skyCoinSpawnAccum += stepZ;
      if (this.skyCoinSpawnAccum >= 3.0) {
        this.skyCoinSpawnAccum = 0;
        const waveLane = Math.floor((this.elapsed * 3.5) % 3);
        this.addCoin(waveLane, 8.6, -75);
        this.addCoin((waveLane + 1) % 3, 8.6, -75);
      }
    }

    // 4. Horizontal lane interpolation
    const targetX = LANES[this.currentLane];
    this.playerX += (targetX - this.playerX) * Math.min(1, dt * 20);
    if (Math.abs(targetX - this.playerX) < 0.01) this.playerX = targetX;
    if (this.laneSwitchTimer > 0) this.laneSwitchTimer = Math.max(0, this.laneSwitchTimer - dt);

    // 5. Move Trains, Barriers, Coins, Power-Ups toward player (+Z)
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const t = this.trains[i];
      t.z += (this.worldSpeed + (t.isMoving ? t.moveSpeed : 0)) * dt;
      t.mesh.position.z = t.z;

      // Play warning horn when an oncoming moving train approaches within 52m
      if (t.isMoving && !t.hornPlayed && t.z > -58 && t.z < -15) {
        t.hornPlayed = true;
        sound.playTrainHorn();
      }

      if (t.z > 26) {
        this.scene.remove(t.mesh);
        this.trains.splice(i, 1);
      }
    }

    for (let i = this.barriers.length - 1; i >= 0; i--) {
      const b = this.barriers[i];
      b.z += stepZ;
      b.mesh.position.z = b.z;
      if (b.z > 14) {
        this.scene.remove(b.mesh);
        this.barriers.splice(i, 1);
      }
    }

    // 6. Vertical Physics (Jetpack flight vs Ground / Ramp / Train Rooftop)
    if (isJetpack) {
      this.isRolling = false;
      this.isGrounded = false;
      this.playerVy = 0;
      this.playerY += (8.5 - this.playerY) * Math.min(1, dt * 7);

      // Rainbow spray-paint jetpack thruster clouds!
      const jetColors = ['#06b6d4', '#f97316', '#facc15', '#ec4899', '#a855f7'];
      const cHex = jetColors[Math.floor(Math.random() * jetColors.length)];
      this.emitParticles(this.playerX - 0.16, this.playerY + 0.6, 0.5, cHex, 1, 0.9, 0.5, 1.1);
      this.emitParticles(this.playerX + 0.16, this.playerY + 0.6, 0.5, cHex, 1, 0.9, 0.5, 1.1);
    } else {
      // Compute dynamic support surface height (Y=0 track, sloped ramp 0..2.65, or Y=2.65 train roof)
      this.groundY = this.computeSupportHeight();

      if (!this.isGrounded || this.playerY > this.groundY + 0.04) {
        this.isGrounded = false;
        this.playerVy += GRAVITY * dt;
        this.playerY += this.playerVy * dt;

        if (this.playerY <= this.groundY) {
          this.playerY = this.groundY;
          this.playerVy = 0;
          this.isGrounded = true;

          if (this.fastDropping) {
            this.fastDropping = false;
            this.camShake = Math.max(this.camShake, 0.16);
            this.emitParticles(this.playerX, this.playerY + 0.1, 0, '#e2e8f0', 10, 3.0, 1.8, 0.8);
          }

          if (this.bufferedAction === 'jump' && this.bufferedTimer > 0) {
            this.bufferedAction = null;
            this.executeJump();
          }
        }
      } else {
        this.playerY = this.groundY;
        this.playerVy = 0;
        this.isGrounded = true;
      }

      if (this.bufferedTimer > 0) {
        this.bufferedTimer -= dt;
        if (this.bufferedTimer <= 0) this.bufferedAction = null;
      }

      if (this.rooftopBonusCooldown > 0) {
        this.rooftopBonusCooldown = Math.max(0, this.rooftopBonusCooldown - dt);
      }
      const onRoofNow = this.isGrounded && this.groundY >= TRAIN_HEIGHT - 0.1;
      if (onRoofNow && !this.wasOnRoof && this.rooftopBonusCooldown <= 0) {
        const roofBonus = 100 * this.getEffectiveMultiplier();
        this.score += roofBonus;
        this.rooftopBonusCooldown = 4.5;
        this.emitParticles(this.playerX, this.playerY + 0.15, 0, '#38bdf8', 12, 2.8, 2.2, 0.8);
        this.emitCallout(`ROOFTOP! +${roofBonus}`, 'High ground advantage!', '#fde047');
      }
      this.wasOnRoof = onRoofNow;

      if (this.isRolling) {
        this.rollTimer -= dt;
        if (this.rollTimer <= 0) {
          this.isRolling = false;
        }
      }
    }

    // Hoverboard neon wake particles
    if (this.powerupTimers.hoverboard > 0 && Math.random() < 0.65) {
      this.emitParticles(this.playerX, this.playerY + 0.12, 0.6, this.currentSkin.boardGlow, 1, 1.2, 0.8, 0.75);
    }

    // 7. Collectibles (Coins + Magnet Pull + Power-Ups)
    this.updateCollectibles(dt, stepZ);

    // 8. Obstacle Collisions (Trains & Barriers)
    if (!isJetpack && this.invulnerableTimer <= 0) {
      this.checkObstacleCollisions();
    }

    // 9. Animate Runner, Inspector & Dynamic Chase Camera
    this.animateRunnerAndInspector(dt);
    this.updatePlayingCamera(dt, isJetpack);

    // 10. Throttled HUD update (~18fps) for silky React performance
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.055) {
      this.hudSyncTimer = 0;
      this.pushHUDUpdate();
    }
  }

  private updatePowerupTimers(dt: number) {
    // Jetpack ending -> safely clear obstacles right underneath landing path!
    if (this.powerupTimers.jetpack > 0) {
      this.powerupTimers.jetpack = Math.max(0, this.powerupTimers.jetpack - dt);
      if (this.powerupTimers.jetpack === 0) {
        this.runner.jetpack.visible = false;
        this.invulnerableTimer = 1.3;
        this.clearObstaclesNearLanding(26);
      }
    }

    if (this.powerupTimers.magnet > 0) {
      this.powerupTimers.magnet = Math.max(0, this.powerupTimers.magnet - dt);
      this.runner.magnetHalo.visible = this.powerupTimers.magnet > 0;
      this.runner.magnetHalo.rotation.z += 4 * dt;
    }

    if (this.powerupTimers.sneakers > 0) {
      this.powerupTimers.sneakers = Math.max(0, this.powerupTimers.sneakers - dt);
      const vis = this.powerupTimers.sneakers > 0;
      this.runner.superShoeLeft.visible = vis;
      this.runner.superShoeRight.visible = vis;
    }

    if (this.powerupTimers.multiplier > 0) {
      this.powerupTimers.multiplier = Math.max(0, this.powerupTimers.multiplier - dt);
    }

    if (this.powerupTimers.hoverboard > 0) {
      this.powerupTimers.hoverboard = Math.max(0, this.powerupTimers.hoverboard - dt);
      if (this.powerupTimers.hoverboard === 0) {
        this.runner.hoverboard.visible = false;
        this.hoverboardCooldown = 2.5;
      }
    }
  }

  private computeSupportHeight(): number {
    let support = 0;

    for (const t of this.trains) {
      if (Math.abs(this.playerX - LANES[t.lane]) > 1.05) continue;

      // Local Z relative to train center (+Z is front facing runner)
      const localZ = -t.z;

      // Boarding Ramp check: localZ in [TRAIN_LENGTH/2, TRAIN_LENGTH/2 + RAMP_LENGTH]
      if (t.hasRamp && localZ >= TRAIN_LENGTH / 2 - 0.2 && localZ <= TRAIN_LENGTH / 2 + RAMP_LENGTH + 0.3) {
        const progress = 1 - (localZ - TRAIN_LENGTH / 2) / RAMP_LENGTH;
        const rampH = Math.max(0, Math.min(TRAIN_HEIGHT, progress * TRAIN_HEIGHT));
        if (this.playerY >= rampH - 0.65) {
          support = Math.max(support, rampH);
        }
      }

      // Train Roof check: localZ in [-TRAIN_LENGTH/2 - 0.3, +TRAIN_LENGTH/2 + 0.25]
      if (localZ >= -TRAIN_LENGTH / 2 - 0.3 && localZ <= TRAIN_LENGTH / 2 + 0.25) {
        // Mantle forgiveness: if jumping/running at >= TRAIN_HEIGHT - 0.45, step cleanly onto roof!
        if (this.playerY >= TRAIN_HEIGHT - 0.45) {
          support = Math.max(support, TRAIN_HEIGHT);
        }
      }
    }

    return support;
  }

  private updateCollectibles(dt: number, stepZ: number) {
    const magnetOn = this.powerupTimers.magnet > 0 || this.powerupTimers.jetpack > 0;
    const playerCollectY = this.playerY + (this.isRolling ? 0.55 : 1.0);

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.z += stepZ;

      // Coin Magnet pulls all nearby coins from every lane smoothly into the player!
      if (magnetOn && c.z > -20 && c.z < 2.5 && Math.abs(c.y - playerCollectY) < 4.5) {
        c.attracted = true;
      }

      if (c.attracted) {
        c.x += (this.playerX - c.x) * Math.min(1, dt * 15);
        c.y += (playerCollectY - c.y) * Math.min(1, dt * 15);
        c.z += (0 - c.z) * Math.min(1, dt * 12);
      }

      c.mesh.position.set(c.x, c.y + Math.sin(this.elapsed * 5 + c.id) * 0.08, c.z);
      c.mesh.rotation.y += 3.6 * dt;

      // Check pickup
      const dx = Math.abs(c.x - this.playerX);
      const dy = Math.abs(c.y - playerCollectY);
      const dz = Math.abs(c.z);

      if (dx < 0.95 && dy < 1.25 && dz < 1.15) {
        this.runCoins++;
        this.coinStreak++;
        this.coinStreakTimer = 1.35;
        if (this.coinStreak > this.bestCombo) this.bestCombo = this.coinStreak;

        const coinPoints = 50 * this.getEffectiveMultiplier();
        this.score += coinPoints;
        sound.playCoin(this.coinStreak);
        this.emitParticles(c.x, c.y, c.z, '#facc15', 7, 2.6, 2.6, 0.75);

        if (this.coinStreak > 0 && this.coinStreak % 25 === 0) {
          const streakBonus = 250 * this.getEffectiveMultiplier();
          this.score += streakBonus;
          this.emitCallout(`${this.coinStreak} COIN STREAK!`, `+${streakBonus} Bonus`, '#facc15');
        }

        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
        continue;
      }

      if (c.z > 10) {
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
      }
    }

    // Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.z += stepZ;
      p.mesh.position.set(LANES[p.lane], p.y + Math.sin(this.elapsed * 4 + p.id) * 0.14, p.z);
      p.mesh.rotation.y += 2.8 * dt;

      const dx = Math.abs(LANES[p.lane] - this.playerX);
      const dy = Math.abs(p.y - playerCollectY);
      const dz = Math.abs(p.z);

      if (dx < 1.1 && dy < 1.45 && dz < 1.3) {
        this.applyPowerup(p.type);
        this.scene.remove(p.mesh);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.z > 10) {
        this.scene.remove(p.mesh);
        this.powerups.splice(i, 1);
      }
    }
  }

  private applyPowerup(type: PowerUpType) {
    sound.playPowerup();
    this.camShake = Math.max(this.camShake, 0.2);

    switch (type) {
      case 'jetpack':
        this.powerupTimers.jetpack = POWERUP_DURATIONS.jetpack;
        this.runner.jetpack.visible = true;
        this.stumbleTimer = 0; // Outrun inspector completely!
        this.emitParticles(this.playerX, this.playerY + 1, 0, '#06b6d4', 28, 4.5, 4.5);
        this.emitCallout('SPRAY JETPACK!', 'Sky Bonus Coins!', '#06b6d4');
        break;
      case 'magnet':
        this.powerupTimers.magnet = POWERUP_DURATIONS.magnet;
        this.runner.magnetHalo.visible = true;
        this.emitParticles(this.playerX, this.playerY + 1, 0, '#ef4444', 20, 3.5, 3.5);
        this.emitCallout('COIN MAGNET!', 'Pulling All 3 Lanes!', '#ef4444');
        break;
      case 'sneakers':
        this.powerupTimers.sneakers = POWERUP_DURATIONS.sneakers;
        this.runner.superShoeLeft.visible = true;
        this.runner.superShoeRight.visible = true;
        this.emitParticles(this.playerX, this.playerY + 0.4, 0, '#84cc16', 20, 3.5, 3.5);
        this.emitCallout('SUPER SNEAKERS!', 'Leap Over Trains!', '#84cc16');
        break;
      case 'multiplier':
        this.powerupTimers.multiplier = POWERUP_DURATIONS.multiplier;
        this.emitParticles(this.playerX, this.playerY + 1.2, 0, '#a855f7', 22, 3.8, 3.8);
        this.emitCallout('2X MULTIPLIER!', 'Double Score Active!', '#c084fc');
        break;
      case 'hoverboard_pickup':
        this.hoverboardsLeft++;
        this.emitParticles(this.playerX, this.playerY + 1, 0, '#ec4899', 20, 3.5, 3.5);
        this.emitCallout('+1 HOVERBOARD!', 'Press SPACE or Double-Tap', '#ec4899');
        break;
    }

    this.pushHUDUpdate();
  }

  private checkObstacleCollisions() {
    // 1. Check Subway Trains
    for (const t of this.trains) {
      const laneX = LANES[t.lane];
      if (Math.abs(this.playerX - laneX) > 0.98) continue;

      const localZ = -t.z; // +TRAIN_LENGTH/2 is front bumper, -TRAIN_LENGTH/2 is rear

      // If train has a boarding ramp, the ramp zone itself is safe to climb!
      if (t.hasRamp && localZ >= TRAIN_LENGTH / 2 - 0.35) {
        continue;
      }

      if (localZ <= TRAIN_LENGTH / 2 + 0.35 && localZ >= -TRAIN_LENGTH / 2 + 0.25) {
        // Above roof height (including mantle forgiveness)? Safe!
        if (this.playerY >= TRAIN_HEIGHT - 0.45) {
          this.playerY = Math.max(this.playerY, TRAIN_HEIGHT);
          continue;
        }

        // Did the player swipe sideways into the SIDE of the train?
        if (this.laneSwitchTimer > 0 && localZ < TRAIN_LENGTH / 2 - 0.55 && this.prevLane !== t.lane) {
          this.currentLane = this.prevLane;
          this.laneSwitchTimer = 0.1;
          this.triggerStumble('Side-scraped a subway car!');
          return;
        }

        // Head-on impact with front of train!
        this.triggerImpact(t.isMoving ? 'Hit an oncoming Express Train!' : 'Crashed into a parked Metro Car!');
        return;
      }
    }

    // 2. Check Track Barriers
    for (const b of this.barriers) {
      const laneX = LANES[b.lane];
      if (Math.abs(this.playerX - laneX) > 0.96) continue;
      if (Math.abs(b.z) > 0.52) continue;

      if (b.kind === 'low') {
        // Cleared if jumping above Y = 0.86
        if (this.playerY > 0.86) continue;
        // Grazing top of low barrier (`0.48..0.86`) causes a stumble rather than instant death!
        if (this.playerY > 0.48) {
          this.scene.remove(b.mesh);
          b.z = 99;
          this.triggerStumble('Clipped a low barrier!');
          return;
        }
        this.triggerImpact('Tripped over a track barrier!');
        return;
      } else if (b.kind === 'high') {
        // Cleared if rolling underneath OR super-jumping above Y = 2.42!
        if (this.isRolling && this.playerY < 0.35) continue;
        if (this.playerY > 2.42) continue;
        this.triggerImpact('Smacked into an overhead gate! (Swipe Down to Roll)');
        return;
      } else {
        // 'full' solid barrier
        if (this.playerY > 2.38) continue;
        this.triggerImpact('Crashed into a buffer stop!');
        return;
      }
    }
  }

  private triggerStumble(reason: string) {
    // If Hoverboard is active, absorb without penalty!
    if (this.powerupTimers.hoverboard > 0) {
      this.camShake = Math.max(this.camShake, 0.25);
      this.emitParticles(this.playerX, this.playerY + 0.8, 0, '#f97316', 12, 3, 2.5);
      sound.playSwipe();
      return;
    }

    // If Inspector is ALREADY right behind you from a recent stumble, stumbling again means CAUGHT!
    if (this.stumbleTimer > 1.2) {
      this.triggerGameOver(`Caught by the Inspector! (${reason})`);
      return;
    }

    this.stumbleTimer = 5.5;
    this.invulnerableTimer = 0.45;
    this.camShake = Math.max(this.camShake, 0.45);
    sound.playStumble();
    this.emitParticles(this.playerX, this.playerY + 0.9, 0, '#fb923c', 18, 3.5, 3);
    this.emitCallout('STUMBLE!', 'Inspector is right behind you!', '#fb923c');
    this.pushHUDUpdate();
  }

  private triggerImpact(reason: string) {
    // Hoverboard Crash Shield Save!!
    if (this.powerupTimers.hoverboard > 0) {
      this.powerupTimers.hoverboard = 0;
      this.runner.hoverboard.visible = false;
      this.hoverboardCooldown = 3.0;
      this.invulnerableTimer = 1.4;
      this.stumbleTimer = 0;
      this.camShake = 0.75;

      sound.playHoverboardBlast();
      this.emitParticles(this.playerX, this.playerY + 1.0, -1, '#ec4899', 40, 7, 6, 1.3);
      this.emitParticles(this.playerX, this.playerY + 1.0, -1, '#38bdf8', 30, 6, 5, 1.2);

      // Vaporize all obstacles within 32m ahead!
      this.clearObstaclesNearLanding(32);

      const saveBonus = 300 * this.getEffectiveMultiplier();
      this.score += saveBonus;
      this.emitCallout('SHIELD BLAST!', `Hoverboard Saved You! +${saveBonus}`, '#ec4899');
      this.pushHUDUpdate();
      return;
    }

    this.triggerGameOver(reason);
  }

  private clearObstaclesNearLanding(rangeZ: number) {
    for (let i = this.trains.length - 1; i >= 0; i--) {
      if (this.trains[i].z > -rangeZ && this.trains[i].z < 14) {
        this.scene.remove(this.trains[i].mesh);
        this.trains.splice(i, 1);
      }
    }
    for (let i = this.barriers.length - 1; i >= 0; i--) {
      if (this.barriers[i].z > -rangeZ && this.barriers[i].z < 12) {
        this.scene.remove(this.barriers[i].mesh);
        this.barriers.splice(i, 1);
      }
    }
  }

  private triggerGameOver(reason: string) {
    this.state = 'gameover';
    this.crashReason = reason;
    this.camShake = 0.85;
    sound.stopMusic();
    sound.playCrash();

    this.emitParticles(this.playerX, this.playerY + 1.0, 0, '#ef4444', 35, 5.5, 5, 1.2);
    this.emitParticles(this.playerX, this.playerY + 1.0, 0, '#facc15', 25, 4.5, 4.5, 1.0);

    // Position Inspector & Dog catching up right next to knocked-back runner!
    this.runner.bodyPivot.rotation.set(0.65, 0, 0.25);
    this.inspector.group.visible = true;
    this.inspector.group.position.set(this.playerX - 0.55, this.groundY, 1.35);
    this.inspector.group.rotation.y = 0;

    const finalHud = this.buildHUDSnapshot();
    this.callbacks.onHUDUpdate(finalHud);
    this.callbacks.onStateChange('gameover');
    this.callbacks.onGameOver(finalHud);
  }

  // ==================== PROCEDURAL CHARACTER & CAMERA ANIMATION ====================

  private animateRunnerAndInspector(dt: number) {
    const isJetpack = this.powerupTimers.jetpack > 0;
    const isBoard = this.powerupTimers.hoverboard > 0 && !isJetpack;

    this.runner.group.position.set(this.playerX, this.playerY + (isBoard ? 0.16 : 0), 0);

    // Bank/lean smoothly into lane turns!
    const bankAngle = (this.playerX - LANES[this.currentLane]) * 0.16;

    if (isJetpack) {
      // Heroic horizontal Superman jetpack flight pose pitching forward (-Z)!
      this.runner.bodyPivot.scale.set(1, 1, 1);
      this.runner.bodyPivot.rotation.set(-1.18, 0, bankAngle);
      this.runner.leftArm.rotation.x = 2.6;
      this.runner.rightArm.rotation.x = 2.6;
      this.runner.leftLeg.rotation.x = -0.2 + Math.sin(this.elapsed * 12) * 0.12;
      this.runner.rightLeg.rotation.x = -0.2 - Math.sin(this.elapsed * 12) * 0.12;
    } else if (this.isRolling) {
      // Compact tuck-and-slide forward roll!
      this.runner.bodyPivot.scale.set(1.12, 0.48, 1.12);
      this.runner.bodyPivot.rotation.set(this.elapsed * -18, 0, bankAngle);
    } else if (isBoard) {
      // Cool sideways surfing stance on Hoverboard!
      this.runner.bodyPivot.scale.set(1, 1, 1);
      this.runner.bodyPivot.rotation.set(-0.08, 0.45, bankAngle);
      this.runner.hoverboard.rotation.z = -bankAngle * 1.4;
      this.runner.hoverboard.position.y = 0.08 + Math.sin(this.elapsed * 10) * 0.03;
      this.runner.leftArm.rotation.x = -0.55;
      this.runner.rightArm.rotation.x = 0.55;
      this.runner.leftLeg.rotation.x = -0.18;
      this.runner.rightLeg.rotation.x = 0.18;
    } else if (!this.isGrounded) {
      // Expressive mid-air jump stride!
      this.runner.bodyPivot.scale.set(1, 1, 1);
      this.runner.bodyPivot.rotation.set(-0.16, 0, bankAngle);
      this.runner.leftArm.rotation.x = 1.1;
      this.runner.rightArm.rotation.x = 0.6;
      this.runner.leftLeg.rotation.x = -0.65;
      this.runner.rightLeg.rotation.x = 0.55;
    } else {
      // Energetic pumping sprint!
      this.runner.bodyPivot.scale.set(1, 1, 1);
      const runFreq = this.worldSpeed * 0.58;
      const swing = Math.sin(this.elapsed * runFreq);
      this.runner.bodyPivot.rotation.set(-0.14, 0, bankAngle + swing * 0.05);
      this.runner.group.position.y += Math.abs(swing) * 0.09;
      this.runner.leftLeg.rotation.x = swing * 0.95;
      this.runner.rightLeg.rotation.x = -swing * 0.95;
      this.runner.leftArm.rotation.x = -swing * 0.85;
      this.runner.rightArm.rotation.x = swing * 0.85;
    }

    // Inspector & Guard Dog chasing right behind on Opening Sprint or Stumble!
    const chaseIntensity = Math.max(
      this.openingChaseTimer > 0 ? Math.min(1, this.openingChaseTimer / 1.2) : 0,
      this.stumbleTimer > 0 ? Math.min(1, this.stumbleTimer / 1.2) : 0
    );

    if (chaseIntensity > 0.01 && !isJetpack) {
      this.inspector.group.visible = true;
      const targetInspZ = 2.4 + (1 - chaseIntensity) * 5.2;
      this.inspector.group.position.x += (this.playerX - this.inspector.group.position.x) * Math.min(1, dt * 8);
      this.inspector.group.position.y = this.groundY;
      this.inspector.group.position.z = targetInspZ;
      this.inspector.group.rotation.y = 0; // Notice inspector mesh faces -Z naturally (+Z back, -Z visor/mustache)

      const cSwing = Math.sin(this.elapsed * 20);
      this.inspector.leftLeg.rotation.x = cSwing * 1.05;
      this.inspector.rightLeg.rotation.x = -cSwing * 1.05;
      this.inspector.leftArm.rotation.x = -cSwing * 0.9;
      this.inspector.rightArm.rotation.x = -0.8 + cSwing * 0.6; // Waving baton!
      this.inspector.dogGroup.position.y = Math.abs(Math.cos(this.elapsed * 22)) * 0.18;
    } else {
      this.inspector.group.visible = false;
    }
  }

  private updatePlayingCamera(dt: number, isJetpack: boolean) {
    // Dynamic FOV warp with speed & Jetpack!
    const targetFov = isJetpack ? 72 : 58 + ((this.worldSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 9;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    const targetCamX = this.playerX * 0.62;
    const targetCamY = isJetpack ? 11.4 : 4.75 + this.playerY * 0.68;
    const targetCamZ = isJetpack ? 8.8 : 7.4;

    this.camPos.x += (targetCamX - this.camPos.x) * Math.min(1, dt * 9);
    this.camPos.y += (targetCamY - this.camPos.y) * Math.min(1, dt * 7);
    this.camPos.z += (targetCamZ - this.camPos.z) * Math.min(1, dt * 6);

    const targetLookX = this.playerX * 0.35;
    const targetLookY = isJetpack ? 7.8 : 1.7 + this.playerY * 0.55;
    this.camLook.x += (targetLookX - this.camLook.x) * Math.min(1, dt * 10);
    this.camLook.y += (targetLookY - this.camLook.y) * Math.min(1, dt * 8);
    this.camLook.z = -15;

    // Screen Shake decay
    let shakeX = 0;
    let shakeY = 0;
    if (this.camShake > 0.005) {
      shakeX = (Math.random() - 0.5) * this.camShake * 1.3;
      shakeY = (Math.random() - 0.5) * this.camShake * 1.1;
      this.camShake = Math.max(0, this.camShake - dt * 2.4);
    }

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);
  }

  private updateGameOverCamera(dt: number) {
    if (this.camShake > 0.005) {
      const sx = (Math.random() - 0.5) * this.camShake * 1.5;
      const sy = (Math.random() - 0.5) * this.camShake * 1.3;
      this.camShake = Math.max(0, this.camShake - dt * 2.2);
      this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    }
    // Inspector waves baton in victory
    this.inspector.rightArm.rotation.x = -1.2 + Math.sin(this.elapsed * 12) * 0.4;
    this.inspector.dogGroup.position.y = Math.abs(Math.sin(this.elapsed * 10)) * 0.16;
  }

  private buildHUDSnapshot(): GameHUDData {
    return {
      score: Math.floor(this.score),
      coins: this.runCoins,
      distance: Math.floor(this.distance),
      multiplier: this.getEffectiveMultiplier(),
      speedKmh: Math.round(this.worldSpeed * 3.1),
      hoverboardsLeft: this.hoverboardsLeft,
      hoverboardCooldown: Number(this.hoverboardCooldown.toFixed(1)),
      stumbleTimer: Number(this.stumbleTimer.toFixed(1)),
      bestCombo: this.bestCombo,
      currentCoinStreak: this.coinStreak,
      crashReason: this.crashReason,
      powerups: { ...this.powerupTimers },
    };
  }

  private pushHUDUpdate() {
    this.callbacks.onHUDUpdate(this.buildHUDSnapshot());
  }
}
