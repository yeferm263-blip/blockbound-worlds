import { buildAtlas } from "./textures";
import * as THREE from "three";
import { B, BLOCKS, ITEMS, RECIPES, breakInfo, blockDrop, isSolid, type Recipe } from "./blocks";
import { World, CS, CH, tileUV } from "./world";
import {
  MOBS,
  buildMob,
  buildArm,
  buildPlayerModel,
  animateMobGait,
  type MobModel,
  type MobType,
} from "./mobs";
import { sfx, startMusic, stopAudio, toggleMusic, preloadSounds, type Material } from "./audio";
import { itemModel } from "./itemModel";
import faithfulPng from "@/assets/faithful.png.asset.json";
import faithful from "./packs/faithful.json";

const FA = faithful as { width: number; height: number; rects: Record<string, number[]> };
function blockMat(id: number): Material {
  if (id === B.LOG || id === B.BIRCH_LOG || id === B.PLANKS || id === B.TABLE) return "wood";
  if (id === B.DIRT || id === B.GRAVEL) return "dirt";
  if (id === B.WOOL) return "cloth";
  if (id === B.SNOW) return "snow";
  if (id === B.GRASS) return "grass";
  if (id === B.SAND) return "sand";
  if (id === B.GLASS || id === B.ICE) return "glass";
  if (id === B.LEAVES || id === B.CACTUS) return "leaves";
  return "stone";
}
import { hash } from "./noise";

export type Slot = { id: string; count: number } | null;
export type Station = "table" | "furnace" | null;

export interface GameState {
  slots: Slot[];
  selected: number;
  cursor: Slot;
  hp: number;
  food: number;
  ui: "none" | "inventory" | "chat" | "admin";
  mode: "survival" | "creative";
  multiplayer: { connected: boolean; room: string; playerCount: number };
  /** Crafting grid: 4 cells (inventory), 9 cells (table), or [input, fuel] (furnace). */
  grid: Slot[];
  station: Station;
  locked: boolean;
  dead: boolean;
  time: number; // 0..1
  day: number;
  target: string | null;
  pos: [number, number, number];
  message: string | null;
  hurt: number;
}

const RENDER = 5;
const DAY_LEN = 600; // seconds
const GRAV = 28;

interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  w: number;
  h: number;
  onGround: boolean;
  inWater: boolean;
  hitWall: boolean;
}

interface Mob extends Body {
  type: MobType;
  hp: number;
  model: MobModel;
  yaw: number;
  wander: number;
  dir: THREE.Vector2;
  hurt: number;
  atk: number;
  fuse: number;
  walk: number;
  burn: number;
}
interface Drop extends Body {
  id: string;
  count: number;
  mesh: THREE.Object3D;
  age: number;
}
interface Arrow {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  mesh: THREE.Mesh;
  age: number;
}

const stack = (id: string) => ITEMS[id]?.stack ?? 64;

/** Shapeless grid matching: furnace = [input, fuel]; otherwise each filled cell counts as one ingredient. */
export function matchGrid(grid: Slot[], station: Station): Recipe | null {
  if (station === "furnace") {
    const [inp, fuel] = grid;
    if (!inp || fuel?.id !== "coal") return null;
    return (
      RECIPES.find(
        (r) =>
          r.station === "furnace" && r.needs[inp.id] === 1 && Object.keys(r.needs).length === 2,
      ) ?? null
    );
  }
  const cells = grid.slice(0, station === "table" ? 9 : 4);
  const have: Record<string, number> = {};
  for (const c of cells) if (c) have[c.id] = (have[c.id] ?? 0) + 1;
  const keys = Object.keys(have);
  if (!keys.length) return null;
  return (
    RECIPES.find((r) => {
      if (r.station === "furnace" || (r.station === "table" && station !== "table")) return false;
      const need = Object.entries(r.needs);
      return need.length === keys.length && need.every(([id, n]) => have[id] === n);
    }) ?? null
  );
}

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.08, 400);
  world!: World;
  atlas!: THREE.Texture;
  sun = new THREE.DirectionalLight(0xffffff, 1.4);
  hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a4a3a, 0.6);
  sunMesh!: THREE.Mesh;
  moonMesh!: THREE.Mesh;
  clouds = new THREE.Group();
  outline!: THREE.LineSegments;
  crack!: THREE.Mesh;
  hand = new THREE.Group();
  handItem: string | null | undefined = undefined;
  lastYaw = 0;
  lastPitch = 0;
  swayX = 0;
  swayY = 0;
  walkT = 0;
  handSwing = 0;

  player: Body = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    w: 0.3,
    h: 1.8,
    onGround: false,
    inWater: false,
    hitWall: false,
  };
  yaw = 0;
  pitch = 0;
  keys = new Set<string>();
  mouseL = false;
  spawn = new THREE.Vector3();
  fallStart = 0;
  mobs: Mob[] = [];
  drops: Drop[] = [];
  arrows: Arrow[] = [];
  breakTarget: string | null = null;
  breakProgress = 0;
  digT = 0;
  attackCd = 0;
  placeCd = 0;
  time = 0.3;
  dayCount = 1;
  hungerT = 0;
  regenT = 0;
  starveT = 0;
  spawnT = 0;
  state: GameState;
  listeners = new Set<(s: GameState) => void>();
  raf = 0;
  last = 0;
  disposed = false;
  msgT = 0;

  flying = false;
  lastSpacePress = 0;
  camShake = 0;
  particles: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; maxAge: number }[] = [];

  // Multiplayer
  ws: WebSocket | null = null;
  multiplayerRoom = "";
  multiplayerPlayerId = "";
  playerName = "Steve";
  remotePlayers = new Map<
    string,
    {
      id: string;
      name: string;
      model: MobModel;
      tagSprite: THREE.Sprite;
      pos: THREE.Vector3;
      targetPos: THREE.Vector3;
      yaw: number;
      targetYaw: number;
      pitch: number;
      walk: number;
      heldId: string | null;
    }
  >();
  lastMultiplayerSync = 0;
  onChatMessage?: (msg: string) => void;

  constructor(
    public canvas: HTMLCanvasElement,
    seed = Math.floor(Math.random() * 1e9),
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.state = {
      slots: Array(36).fill(null),
      selected: 0,
      cursor: null,
      hp: 20,
      food: 20,
      ui: "none",
      mode: "survival",
      multiplayer: { connected: false, room: "", playerCount: 1 },
      station: null,
      grid: Array(9).fill(null),
      locked: false,
      dead: false,
      time: this.time,
      day: 1,
      target: null,
      pos: [0, 0, 0],
      message: null,
      hurt: 0,
    };
    this.seed = seed;
  }
  seed: number;

  faImg: HTMLImageElement | null = null;
  async init() {
    preloadSounds();
    this.faImg = await new Promise((res) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = faithfulPng.url;
    });
    this.atlas = new THREE.CanvasTexture(await buildAtlas());
    this.atlas.magFilter = THREE.NearestFilter;
    this.atlas.minFilter = THREE.NearestMipmapLinearFilter;
    this.atlas.colorSpace = THREE.SRGBColorSpace;
    this.world = new World(this.seed, this.atlas);
    this.scene.add(this.world.group, this.sun, this.sun.target, this.hemi, this.camera);
    this.scene.fog = new THREE.Fog(0x9ccbff, RENDER * CS * 0.55, RENDER * CS * 0.95);

    // sun & moon (square, like the classic look)
    this.faTex = new THREE.TextureLoader().load(faithfulPng.url);
    this.faTex.magFilter = THREE.NearestFilter;
    this.faTex.minFilter = THREE.NearestFilter;
    this.faTex.colorSpace = THREE.SRGBColorSpace;
    this.faTex.generateMipmaps = false;
    const sky = (key: string) =>
      new THREE.MeshBasicMaterial({
        map: this.faSub(key),
        fog: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      sky("environment/celestial/sun.png"),
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      sky("environment/celestial/moon/full_moon.png"),
    );
    this.scene.add(this.sunMesh, this.moonMesh);
    // clouds
    const cmat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      emissive: 0x777777,
    });
    for (let i = 0; i < 40; i++) {
      const w = 8 + hash(i, 1, 2) * 20,
        d = 6 + hash(i, 3, 4) * 16;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), cmat);
      m.position.set((hash(i, 5, 6) - 0.5) * 300, 0, (hash(i, 7, 8) - 0.5) * 300);
      this.clouds.add(m);
    }
    this.clouds.position.y = 105;
    this.scene.add(this.clouds);

    // selection outline + crack overlay
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
    );
    this.crack = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({
        map: this.faSub("block/destroy_stage_0.png"),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        color: 0x999999,
        blending: THREE.MultiplyBlending,
        premultipliedAlpha: true,
      }),
    );
    this.scene.add(this.outline, this.crack);

    // hand
    this.camera.add(this.hand);
    this.hand.position.set(0.55, -0.5, -0.8);

    // spawn
    let sx = 0,
      sz = 0;
    for (let i = 0; i < 200; i++) {
      {
        const bi = this.world.biome(sx, sz);
        if (this.world.height(sx, sz) > 29 && (bi === "forest" || bi === "plains")) break;
      }
      sx += 16;
      sz += (i % 2) * 16;
    }
    const scx = Math.floor(sx / CS),
      scz = Math.floor(sz / CS);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) this.world.ensureChunk(scx + dx, scz + dz);
    this.spawn.set(sx + 0.5, this.world.topY(sx, sz) + 1.01, sz + 0.5);
    this.player.pos.copy(this.spawn);
    this.fallStart = this.spawn.y;
    for (const c of this.world.chunks.values()) this.world.mesh(c);

    this.give("b5", 0); // nothing; ensure array alive
    this.bind();
    this.resize();
    this.last = performance.now();
    this.loop();
  }

  faTex!: THREE.Texture;
  moonPhase = -1;
  stepT = 0;
  /** Texture showing one sprite from the Faithful atlas. */
  faSub(key: string) {
    const t = this.faTex.clone();
    this.faSetRect(t, key);
    return t;
  }
  faSetRect(t: THREE.Texture, key: string) {
    const r = FA.rects[key];
    if (!r) return;
    const [x, y, w, h] = r;
    t.repeat.set(w / FA.width, h / FA.height);
    t.offset.set(x / FA.width, 1 - (y + h) / FA.height);
    t.needsUpdate = true;
  }
  crackTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000";
    for (let i = 0; i < 40; i++)
      g.fillRect(
        Math.floor(hash(i, 1, 9) * 16),
        Math.floor(hash(i, 2, 9) * 16),
        1 + Math.floor(hash(i, 3, 9) * 2),
        1,
      );
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  // ---------- events ----------
  handlers: [EventTarget, string, EventListener][] = [];
  on(t: EventTarget, ev: string, fn: (e: never) => void) {
    t.addEventListener(ev, fn as EventListener);
    this.handlers.push([t, ev, fn as EventListener]);
  }
  bind() {
    this.on(window, "resize", () => this.resize());
    this.on(window, "keydown", (e: KeyboardEvent) => {
      if (this.state.dead) return;
      if (this.state.ui === "chat" || this.state.ui === "admin") return; // typing in React UI
      if (this.state.ui === "none" && (e.code === "KeyT" || e.code === "Slash")) {
        e.preventDefault();
        this.openChat(e.code === "Slash" ? "/" : "");
        return;
      }
      if (e.code === "KeyE") {
        this.toggleInventory(null);
        return;
      }
      if (this.state.ui !== "none") {
        if (e.code === "Escape") this.closeUI();
        return;
      }
      this.keys.add(e.code);
      if (e.code === "Space" && this.state.mode === "creative" && this.state.locked) {
        const now = performance.now();
        if (now - this.lastSpacePress < 350) {
          this.flying = !this.flying;
          this.player.vel.y = 0;
          this.toast(this.flying ? "Vuelo activado" : "Vuelo desactivado");
          this.lastSpacePress = 0;
        } else {
          this.lastSpacePress = now;
        }
      }
      if (e.code === "KeyF" && this.state.mode === "creative" && this.state.locked) {
        this.flying = !this.flying;
        this.player.vel.y = 0;
        this.toast(this.flying ? "Vuelo activado" : "Vuelo desactivado");
      }
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5)) - 1;
        if (n >= 0 && n < 9) this.select(n);
      }
      if (e.code === "KeyQ") this.dropHeld();
      if (e.code === "KeyM") this.toast(toggleMusic() ? "Música: activada" : "Música: desactivada");
    });
    this.on(window, "keyup", (e: KeyboardEvent) => this.keys.delete(e.code));
    this.on(this.canvas, "mousedown", (e: MouseEvent) => {
      if (!this.state.locked) {
        if (this.state.ui === "none" && !this.state.dead) this.canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) {
        this.mouseL = true;
        this.attack();
      }
      if (e.button === 2) this.use();
    });
    this.on(window, "mouseup", (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseL = false;
        this.breakProgress = 0;
      }
    });
    this.on(this.canvas, "contextmenu", (e: Event) => e.preventDefault());
    this.on(document, "mousemove", (e: MouseEvent) => {
      if (!this.state.locked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0025));
    });
    this.on(window, "wheel", (e: WheelEvent) => {
      if (this.state.locked) this.select((this.state.selected + (e.deltaY > 0 ? 1 : 8)) % 9);
    });
    this.on(document, "pointerlockchange", () => {
      this.state.locked = document.pointerLockElement === this.canvas;
      if (this.state.locked) startMusic();
      if (!this.state.locked) {
        this.keys.clear();
        this.mouseL = false;
      }
      this.emit();
    });
  }

  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  subscribe(fn: (s: GameState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit() {
    this.state = { ...this.state };
    for (const l of this.listeners) l(this.state);
  }
  toast(m: string) {
    this.state.message = m;
    this.msgT = 2.5;
    this.emit();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    stopAudio();
    this.disconnectMultiplayer();
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer.dispose();
  }

  // ---------- Multiplayer ----------
  createNameTagSprite(name: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.roundRect(8, 8, 240, 48, 8);
    ctx.fill();
    ctx.font = "bold 28px VT323, monospace, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.35, 1);
    sprite.position.set(0, 2.2, 0);
    return sprite;
  }

  addRemotePlayer(
    id: string,
    name: string,
    pos: [number, number, number],
    yaw = 0,
    pitch = 0,
    held: string | null = null,
  ) {
    if (this.remotePlayers.has(id)) return;
    const model = buildPlayerModel();
    const tagSprite = this.createNameTagSprite(name);
    model.root.add(tagSprite);
    const pVec = new THREE.Vector3(pos[0], pos[1], pos[2]);
    model.root.position.copy(pVec);
    model.root.rotation.y = yaw;
    this.scene.add(model.root);

    this.remotePlayers.set(id, {
      id,
      name,
      model,
      tagSprite,
      pos: pVec.clone(),
      targetPos: pVec.clone(),
      yaw,
      targetYaw: yaw,
      pitch,
      walk: 0,
      heldId: held,
    });
  }

  removeRemotePlayer(id: string) {
    const rp = this.remotePlayers.get(id);
    if (rp) {
      this.scene.remove(rp.model.root);
      rp.model.mats.forEach((m) => m.dispose());
      this.remotePlayers.delete(id);
    }
  }

  connectMultiplayer(roomCode: string, name: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.disconnectMultiplayer();
      const code = (roomCode || "MUNDO-1").toUpperCase().trim().slice(0, 10);
      this.playerName = (name || "Steve").trim().slice(0, 16);
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/ws/multiplayer`;

      try {
        const ws = new WebSocket(url);
        this.ws = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "join",
              room: code,
              name: this.playerName,
              pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
              yaw: this.yaw,
              pitch: this.pitch,
              seed: this.seed,
            }),
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "joined") {
              this.multiplayerRoom = msg.room;
              this.multiplayerPlayerId = msg.id;
              this.state.multiplayer = {
                connected: true,
                room: msg.room,
                playerCount: (msg.players?.length || 0) + 1,
              };
              if (Array.isArray(msg.blockChanges)) {
                for (const bc of msg.blockChanges) {
                  this.world.set(bc.x, bc.y, bc.z, bc.id);
                }
              }
              if (Array.isArray(msg.players)) {
                for (const p of msg.players) {
                  this.addRemotePlayer(p.id, p.name, p.pos, p.yaw, p.pitch, p.held);
                }
              }
              this.toast(`Conectado a sala ${msg.room}`);
              this.emit();
              resolve(true);
            } else if (msg.type === "player_joined") {
              const p = msg.player;
              this.addRemotePlayer(p.id, p.name, p.pos, p.yaw, p.pitch, p.held);
              this.toast(`[+] ${p.name} se unió`);
              if (this.state.multiplayer) {
                this.state.multiplayer.playerCount = this.remotePlayers.size + 1;
                this.emit();
              }
            } else if (msg.type === "player_update") {
              const rp = this.remotePlayers.get(msg.id);
              if (rp) {
                rp.targetPos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
                rp.targetYaw = msg.yaw;
                rp.pitch = msg.pitch;
                if (msg.swing && rp.model.arms[1]) {
                  rp.model.arms[1].rotation.x = (-Math.PI / 2) * msg.swing;
                }
                rp.heldId = msg.held;
              }
            } else if (msg.type === "block_change") {
              if (msg.by !== this.multiplayerPlayerId) {
                this.world.set(msg.x, msg.y, msg.z, msg.id);
              }
            } else if (msg.type === "chat") {
              if (this.onChatMessage) {
                this.onChatMessage(`<${msg.from}> ${msg.text}`);
              }
            } else if (msg.type === "player_left") {
              this.removeRemotePlayer(msg.id);
              this.toast(`[-] ${msg.name} salió`);
              if (this.state.multiplayer) {
                this.state.multiplayer.playerCount = this.remotePlayers.size + 1;
                this.emit();
              }
            }
          } catch (err) {
            console.error("Multiplayer msg err:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("Multiplayer WS error:", err);
          resolve(false);
        };

        ws.onclose = () => {
          this.disconnectMultiplayer();
        };
      } catch (err) {
        console.error("Multiplayer connect error:", err);
        resolve(false);
      }
    });
  }

  disconnectMultiplayer() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    for (const id of [...this.remotePlayers.keys()]) {
      this.removeRemotePlayer(id);
    }
    this.state.multiplayer = { connected: false, room: "", playerCount: 1 };
    this.emit();
  }

  sendBlockChange(x: number, y: number, z: number, id: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "block_change",
          x,
          y,
          z,
          id,
        }),
      );
    }
  }

  sendChat(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "chat",
          text,
        }),
      );
    }
  }

  // ---------- inventory ----------
  held() {
    return this.state.slots[this.state.selected]?.id ?? null;
  }
  select(i: number) {
    this.state.selected = i;
    this.emit();
  }
  count(id: string) {
    return this.state.slots.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
  }
  give(id: string, n: number): number {
    const slots = this.state.slots.slice();
    const max = stack(id);
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = slots[i];
      if (s && s.id === id && s.count < max) {
        const add = Math.min(n, max - s.count);
        slots[i] = { id, count: s.count + add };
        n -= add;
      }
    }
    for (let i = 0; i < 36 && n > 0; i++)
      if (!slots[i]) {
        const add = Math.min(n, max);
        slots[i] = { id, count: add };
        n -= add;
      }
    this.state.slots = slots;
    this.emit();
    return n;
  }
  take(id: string, n: number) {
    const slots = this.state.slots.slice();
    for (let i = 35; i >= 0 && n > 0; i--) {
      const s = slots[i];
      if (s && s.id === id) {
        const t = Math.min(n, s.count);
        n -= t;
        slots[i] = s.count - t > 0 ? { id, count: s.count - t } : null;
      }
    }
    this.state.slots = slots;
  }
  consumeHeld() {
    if (this.state.mode === "creative") return;
    const i = this.state.selected;
    const s = this.state.slots[i];
    if (!s) return;
    const slots = this.state.slots.slice();
    slots[i] = s.count > 1 ? { id: s.id, count: s.count - 1 } : null;
    this.state.slots = slots;
    this.emit();
  }
  setGameMode(mode: "survival" | "creative") {
    this.state.mode = mode;
    if (mode === "creative") {
      this.state.hp = 20;
      this.state.food = 20;
      this.toast("Modo de juego cambiado a Modo Creativo");
    } else {
      this.flying = false;
      this.toast("Modo de juego cambiado a Modo Supervivencia");
    }
    this.emit();
  }
  giveCreativeStack(id: string) {
    const i = this.state.selected;
    const slots = this.state.slots.slice();
    slots[i] = { id, count: 64 };
    this.state.slots = slots;
    sfx.pop();
    this.emit();
  }
  /** Minecraft cursor rules on any slot array (left = pick/put/swap all, right = half/one). */
  clickIn(slots: Slot[], i: number, right: boolean) {
    const s = slots[i];
    const c = this.state.cursor;
    if (!c) {
      if (!s) return;
      if (right && s.count > 1) {
        const half = Math.ceil(s.count / 2);
        this.state.cursor = { id: s.id, count: half };
        slots[i] = { id: s.id, count: s.count - half };
      } else {
        this.state.cursor = s;
        slots[i] = null;
      }
    } else if (!s) {
      if (right) {
        slots[i] = { id: c.id, count: 1 };
        this.state.cursor = c.count > 1 ? { id: c.id, count: c.count - 1 } : null;
      } else {
        slots[i] = c;
        this.state.cursor = null;
      }
    } else if (s.id === c.id) {
      const max = stack(s.id);
      const add = Math.min(right ? 1 : c.count, max - s.count);
      slots[i] = { id: s.id, count: s.count + add };
      const left = c.count - add;
      this.state.cursor = left > 0 ? { id: c.id, count: left } : null;
    } else {
      slots[i] = c;
      this.state.cursor = s;
    }
    sfx.pop();
  }
  clickSlot(i: number, right: boolean) {
    const slots = this.state.slots.slice();
    this.clickIn(slots, i, right);
    this.state.slots = slots;
    this.emit();
  }
  clickGrid(i: number, right: boolean) {
    const grid = this.state.grid.slice();
    this.clickIn(grid, i, right);
    this.state.grid = grid;
    this.emit();
  }
  /** Recipe produced by the current grid (shapeless: every filled cell holds one ingredient). */
  gridResult(): Recipe | null {
    return matchGrid(this.state.grid, this.state.station);
  }
  takeResult() {
    const r = this.gridResult();
    if (!r) return;
    const c = this.state.cursor;
    if (c && (c.id !== r.out || c.count + r.count > stack(r.out))) return;
    this.state.cursor = { id: r.out, count: (c?.count ?? 0) + r.count };
    const grid = this.state.grid.slice();
    if (this.state.station === "furnace") {
      for (const k of [0, 1]) {
        const g = grid[k]!;
        grid[k] = g.count > 1 ? { id: g.id, count: g.count - 1 } : null;
      }
    } else
      for (let k = 0; k < grid.length; k++) {
        const g = grid[k];
        if (g) grid[k] = g.count > 1 ? { id: g.id, count: g.count - 1 } : null;
      }
    this.state.grid = grid;
    sfx.pop();
    this.emit();
  }
  canCraft(r: Recipe, station: Station) {
    if (r.station === "table" && station !== "table") return false;
    if (r.station === "furnace" && station !== "furnace") return false;
    return Object.entries(r.needs).every(([id, n]) => this.count(id) >= n);
  }
  craft(r: Recipe) {
    if (!this.canCraft(r, this.state.station)) return;
    for (const [id, n] of Object.entries(r.needs)) this.take(id, n);
    const left = this.give(r.out, r.count);
    if (left > 0)
      this.spawnDrop(r.out, left, this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
  }
  recipes() {
    return RECIPES;
  }
  toggleInventory(station: Station) {
    if (this.state.ui !== "none") {
      this.closeUI();
      return;
    }
    this.state.ui = "inventory";
    this.state.station = station;
    this.keys.clear();
    this.mouseL = false;
    document.exitPointerLock();
    this.emit();
  }
  chatPrefix = "";
  openChat(prefix: string) {
    this.chatPrefix = prefix;
    this.state.ui = "chat";
    this.keys.clear();
    this.mouseL = false;
    document.exitPointerLock();
    this.emit();
  }
  openAdmin() {
    this.state.ui = "admin";
    this.emit();
  }
  async reloadTextures() {
    this.atlas.image = await buildAtlas();
    this.atlas.needsUpdate = true;
    for (const c of this.world.chunks.values()) c.dirty = true;
    this.handItem = undefined;
    this.emit();
  }
  closeUI() {
    const back = [this.state.cursor, ...this.state.grid];
    this.state.cursor = null;
    this.state.grid = Array(9).fill(null);
    for (const c of back)
      if (c) {
        const left = this.give(c.id, c.count);
        if (left) this.spawnDrop(c.id, left, this.eye());
      }
    this.state.ui = "none";
    this.state.station = null;
    this.emit();
    this.canvas.requestPointerLock();
  }
  dropHeld() {
    const id = this.held();
    if (!id) return;
    this.consumeHeld();
    const d = this.spawnDrop(id, 1, this.eye().add(this.look().multiplyScalar(0.6)));
    d.vel.copy(this.look().multiplyScalar(6));
    d.vel.y += 2;
    d.age = -1;
  }

  // ---------- helpers ----------
  eye() {
    return this.player.pos.clone().add(new THREE.Vector3(0, 1.62, 0));
  }
  look() {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }

  raycast(max = 5) {
    const o = this.eye(),
      d = this.look();
    let x = Math.floor(o.x),
      y = Math.floor(o.y),
      z = Math.floor(o.z);
    const sx = Math.sign(d.x),
      sy = Math.sign(d.y),
      sz = Math.sign(d.z);
    const tdx = Math.abs(1 / d.x),
      tdy = Math.abs(1 / d.y),
      tdz = Math.abs(1 / d.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx,
      ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy,
      tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let n = [0, 0, 0];
    let t = 0;
    while (t <= max) {
      const b = this.world.get(x, y, z);
      if (b && !BLOCKS[b]?.liquid) return { x, y, z, n, t, id: b };
      if (tx < ty && tx < tz) {
        x += sx;
        t = tx;
        tx += tdx;
        n = [-sx, 0, 0];
      } else if (ty < tz) {
        y += sy;
        t = ty;
        ty += tdy;
        n = [0, -sy, 0];
      } else {
        z += sz;
        t = tz;
        tz += tdz;
        n = [0, 0, -sz];
      }
    }
    return null;
  }

  rayMob(max = 3.5) {
    const o = this.eye(),
      d = this.look();
    let best: Mob | null = null,
      bt = max;
    for (const m of this.mobs) {
      const min = [m.pos.x - m.w, m.pos.y, m.pos.z - m.w],
        mx = [m.pos.x + m.w, m.pos.y + m.h, m.pos.z + m.w];
      let t0 = 0,
        t1 = bt;
      const oo = [o.x, o.y, o.z],
        dd = [d.x, d.y, d.z];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        const inv = 1 / dd[a];
        let ta = (min[a] - oo[a]) * inv,
          tb = (mx[a] - oo[a]) * inv;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) {
          ok = false;
          break;
        }
      }
      if (ok && t0 < bt) {
        bt = t0;
        best = m;
      }
    }
    return best ? { mob: best, t: bt } : null;
  }

  collides(p: THREE.Vector3, w: number, h: number) {
    for (let x = Math.floor(p.x - w); x <= Math.floor(p.x + w); x++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + h); y++)
        for (let z = Math.floor(p.z - w); z <= Math.floor(p.z + w); z++)
          if (isSolid(this.world.get(x, y, z))) return true;
    return false;
  }

  physics(b: Body, dt: number) {
    const feet = this.world.get(
      Math.floor(b.pos.x),
      Math.floor(b.pos.y + 0.4),
      Math.floor(b.pos.z),
    );
    b.inWater = feet === B.WATER;
    if (b === this.player && this.state.mode === "creative") {
      this.fallStart = this.player.pos.y;
    }
    const isCreativeFlying = b === this.player && this.state.mode === "creative" && this.flying;
    if (!isCreativeFlying) {
      if (b.inWater) {
        b.vel.y -= GRAV * 0.18 * dt;
        b.vel.x *= Math.exp(-1.8 * dt);
        b.vel.z *= Math.exp(-1.8 * dt);
        b.vel.y *= Math.exp(-1.2 * dt);
      } else b.vel.y -= GRAV * dt;
      b.vel.y = Math.max(b.vel.y, -50);
    }
    b.onGround = false;
    b.hitWall = false;
    const steps =
      Math.ceil((Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt) / 0.4) ||
      1;
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const a of ["x", "z", "y"] as const) {
        const d = b.vel[a] * sdt;
        if (!d) continue;
        b.pos[a] += d;
        if (this.collides(b.pos, b.w - 0.001, b.h)) {
          if (a === "y") {
            if (d < 0) {
              b.pos.y = Math.floor(b.pos.y) + 1;
              b.onGround = true;
            } else b.pos.y = Math.floor(b.pos.y + b.h) - b.h - 0.001;
          } else {
            b.pos[a] =
              d > 0
                ? Math.floor(b.pos[a] + b.w) - b.w - 0.0011
                : Math.floor(b.pos[a] - b.w) + 1 + b.w + 0.0011;
            b.hitWall = true;
          }
          b.vel[a] = 0;
        }
      }
    }
  }

  // ---------- actions ----------
  attack() {
    if (this.attackCd > 0) return;
    const hitM = this.rayMob();
    const hitB = this.raycast();
    if (hitM && (!hitB || hitM.t < hitB.t)) {
      const it = ITEMS[this.held() ?? ""];
      const dmg = it?.damage ?? 1;
      this.damageMob(hitM.mob, dmg, this.look());
      this.attackCd = 0.45;
      this.handSwing = 1;
    } else if (this.attackCd <= 0 && this.handSwing <= 0) {
      sfx.swing();
      this.handSwing = 1;
      this.attackCd = 0.3;
    }
  }

  damageMob(m: Mob, dmg: number, dir: THREE.Vector3) {
    if (m.hurt > 0.2) return;
    m.hp -= dmg;
    m.hurt = 0.5;
    sfx.hit();
    sfx.mobHurt(m.type);
    m.vel.x += dir.x * 7;
    m.vel.z += dir.z * 7;
    m.vel.y = 5;
    if (!MOBS[m.type].hostile) {
      m.wander = 4;
      m.dir.set(dir.x, dir.z).normalize();
    }
    if (m.hp <= 0) this.killMob(m, true);
  }

  killMob(m: Mob, loot: boolean) {
    this.scene.remove(m.model.root);
    this.mobs = this.mobs.filter((x) => x !== m);
    if (!loot) return;
    for (const [id, mn, mx] of MOBS[m.type].drops) {
      const n = mn + Math.floor(Math.random() * (mx - mn + 1));
      if (n > 0) this.spawnDrop(id, n, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
  }

  use() {
    if (this.placeCd > 0) return;
    this.placeCd = 0.22;
    const hit = this.raycast();
    if (hit && (hit.id === B.TABLE || hit.id === B.FURNACE) && !this.keys.has("ShiftLeft")) {
      this.toggleInventory(hit.id === B.TABLE ? "table" : "furnace");
      return;
    }
    const id = this.held();
    const it = id ? ITEMS[id] : undefined;
    if (it?.food) {
      if (this.state.food >= 20) return;
      this.state.food = Math.min(20, this.state.food + it.food);
      sfx.eat();
      this.consumeHeld();
      this.handSwing = 1;
      this.toast("¡Ñam! +" + it.food);
      return;
    }
    if (!hit || !it?.block) return;
    const p = { x: hit.x + hit.n[0], y: hit.y + hit.n[1], z: hit.z + hit.n[2] };
    const cur = this.world.get(p.x, p.y, p.z);
    if (cur && cur !== B.WATER) return;
    // don't place inside player or mobs
    const pl = this.player.pos;
    const overlap = (bx: THREE.Vector3, w: number, h: number) =>
      p.x + 1 > bx.x - w &&
      p.x < bx.x + w &&
      p.y + 1 > bx.y &&
      p.y < bx.y + h &&
      p.z + 1 > bx.z - w &&
      p.z < bx.z + w;
    if (overlap(pl, 0.3, 1.8) || this.mobs.some((m) => overlap(m.pos, m.w, m.h))) return;
    if (it.block === B.CACTUS) {
      const below = this.world.get(p.x, p.y - 1, p.z);
      if (below !== B.SAND && below !== B.CACTUS) return;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const side = this.world.get(p.x + dx, p.y, p.z + dz);
        if (side && isSolid(side)) return;
      }
    }
    this.world.set(p.x, p.y, p.z, it.block);
    this.sendBlockChange(p.x, p.y, p.z, it.block);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const side = this.world.get(p.x + dx, p.y, p.z + dz);
      if (side === B.CACTUS) {
        this.breakBlock(p.x + dx, p.y, p.z + dz, B.CACTUS, true);
      }
    }
    sfx.place(blockMat(it.block));
    this.consumeHeld();
    this.handSwing = 1;
  }

  breakBlock(x: number, y: number, z: number, id: number, drops: boolean) {
    if (drops && this.state.mode !== "creative") sfx.brk(blockMat(id));
    this.world.set(x, y, z, B.AIR);
    this.sendBlockChange(x, y, z, B.AIR);
    if (drops && this.state.mode !== "creative") {
      let d = blockDrop(id);
      if (id === B.LEAVES && Math.random() < 0.06) d = "apple";
      if (id === B.GRAVEL && Math.random() < 0.1) d = "stick";
      if (d) this.spawnDrop(d, 1, new THREE.Vector3(x + 0.5, y + 0.3, z + 0.5));
    }
    if (id === B.CACTUS) {
      for (let yy = y + 1; yy < CH; yy++) {
        const above = this.world.get(x, yy, z);
        if (above !== B.CACTUS) break;
        this.world.set(x, yy, z, B.AIR);
        if (drops) this.spawnDrop("b20", 1, new THREE.Vector3(x + 0.5, yy + 0.3, z + 0.5));
      }
    }
    // sand / gravel gravity
    for (let yy = y + 1; yy < CH; yy++) {
      const above = this.world.get(x, yy, z);
      if (above !== B.SAND && above !== B.GRAVEL) break;
      this.world.set(x, yy, z, B.AIR);
      this.world.set(x, yy - 1, z, above);
    }
    // water flows in (simple)
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ])
      if (this.world.get(x + dx, y + dy, z + dz) === B.WATER) {
        this.world.set(x, y, z, B.WATER);
        break;
      }
  }

  spawnDrop(id: string, count: number, pos: THREE.Vector3): Drop {
    const mesh = this.itemMesh(id, 0.28);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const d: Drop = {
      id,
      count,
      mesh,
      age: 0,
      pos: pos.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3),
      w: 0.14,
      h: 0.28,
      onGround: false,
      inWater: false,
      hitWall: false,
    };
    this.drops.push(d);
    return d;
  }

  blockGeo(id: number, size: number) {
    const g = new THREE.BoxGeometry(size, size, size);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    const def = BLOCKS[id];
    for (let f = 0; f < 6; f++) {
      const tile = def.tex[f === 2 ? 0 : f === 3 ? 2 : 1];
      const [u0, v0, u1, v1] = tileUV(tile);
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      }
    }
    return g;
  }

  itemMesh(id: string, size: number): THREE.Object3D {
    const it = ITEMS[id];
    if (it?.block)
      return new THREE.Mesh(
        this.blockGeo(it.block, size),
        new THREE.MeshLambertMaterial({ map: this.atlas, alphaTest: 0.5 }),
      );
    return itemModel(id, size * 1.6, this.faImg);
  }

  spawnMob(type: MobType, pos: THREE.Vector3) {
    const spec = MOBS[type];
    const model = buildMob(type);
    model.root.position.copy(pos);
    this.scene.add(model.root);
    this.mobs.push({
      type,
      hp: spec.hp,
      model,
      yaw: Math.random() * 6.28,
      wander: 0,
      dir: new THREE.Vector2(),
      hurt: 0,
      atk: 0,
      fuse: 0,
      walk: 0,
      burn: 0,
      pos: pos.clone(),
      vel: new THREE.Vector3(),
      w: spec.w,
      h: spec.h,
      onGround: false,
      inWater: false,
      hitWall: false,
    });
  }

  hurtPlayer(n: number, from?: THREE.Vector3) {
    if (this.state.dead || n <= 0 || this.state.mode === "creative") return;
    this.state.hp = Math.max(0, this.state.hp - n);
    sfx.hurt();
    this.state.hurt = 1;
    if (from) {
      const d = this.player.pos.clone().sub(from).setY(0).normalize();
      this.player.vel.x += d.x * 8;
      this.player.vel.z += d.z * 8;
      this.player.vel.y = 5;
    }
    if (this.state.hp <= 0) this.die();
    this.emit();
  }

  die() {
    this.state.dead = true;
    for (const s of this.state.slots)
      if (s) this.spawnDrop(s.id, s.count, this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    this.state.slots = Array(36).fill(null);
    document.exitPointerLock();
    this.emit();
  }
  respawn() {
    this.state.dead = false;
    this.state.hp = 20;
    this.state.food = 20;
    this.player.pos.copy(this.spawn);
    this.player.vel.set(0, 0, 0);
    this.fallStart = this.spawn.y;
    this.emit();
    this.canvas.requestPointerLock();
  }

  explode(c: THREE.Vector3, r: number) {
    sfx.explode();
    this.spawnExplosionParticles(c);
    this.camShake = 0.55;

    const ir = Math.floor(r);
    const cx = Math.floor(c.x),
      cy = Math.floor(c.y),
      cz = Math.floor(c.z);
    for (let x = -ir; x <= ir; x++)
      for (let y = -ir; y <= ir; y++)
        for (let z = -ir; z <= ir; z++) {
          if (x * x + y * y + z * z > r * r) continue;
          const bx = cx + x,
            by = cy + y,
            bz = cz + z;
          const id = this.world.get(bx, by, bz);
          if (!id || id === B.BEDROCK || id === B.WATER) continue;
          this.world.set(bx, by, bz, B.AIR);
          this.sendBlockChange(bx, by, bz, B.AIR);
          const d = blockDrop(id);
          if (d && Math.random() < 0.3)
            this.spawnDrop(d, 1, new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5));
        }
    const dist = this.player.pos.distanceTo(c);
    if (dist < r * 2) this.hurtPlayer(Math.round((1 - dist / (r * 2)) * 18), c);
    for (const m of [...this.mobs]) {
      const dm = m.pos.distanceTo(c);
      if (dm < r * 2) this.damageMob(m, (1 - dm / (r * 2)) * 20, m.pos.clone().sub(c).normalize());
    }
  }

  spawnExplosionParticles(c: THREE.Vector3) {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const colors = [0xffffff, 0xffaa00, 0xff4400, 0x888888, 0x333333];
    for (let i = 0; i < 32; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(c).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
        ),
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 14,
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, vel, age: 0, maxAge: 0.35 + Math.random() * 0.3 });
    }
  }

  // ---------- loop ----------
  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  daylight() {
    return Math.max(0.12, Math.min(1, Math.sin(this.time * Math.PI * 2) * 2.2 + 0.4));
  }

  update(dt: number) {
    const st = this.state;
    const playing = st.locked && st.ui === "none" && !st.dead;
    // time
    this.time += dt / DAY_LEN;
    if (this.time >= 1) {
      this.time -= 1;
      this.dayCount++;
    }
    this.attackCd -= dt;
    this.placeCd -= dt;
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) {
        st.message = null;
        this.emit();
      }
    }
    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 2.5);

    // player movement
    const p = this.player;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (playing) {
      if (this.keys.has("KeyW")) wish.add(fwd);
      if (this.keys.has("KeyS")) wish.sub(fwd);
      if (this.keys.has("KeyD")) wish.add(right);
      if (this.keys.has("KeyA")) wish.sub(right);
    }
    const sneak = this.keys.has("ShiftLeft");
    const sprint = this.keys.has("ControlLeft") && st.food > 6 && !sneak;
    const speed =
      this.state.mode === "creative" && this.flying
        ? sprint
          ? 12.0
          : 8.0
        : p.inWater
          ? 3.0
          : sneak
            ? 1.4
            : sprint
              ? 5.6
              : 4.3;
    if (wish.lengthSq()) wish.normalize().multiplyScalar(speed);
    const k = p.onGround ? 14 : p.inWater ? 8 : 3;
    const blend = 1 - Math.exp(-k * dt);
    p.vel.x += (wish.x - p.vel.x) * blend;
    p.vel.z += (wish.z - p.vel.z) * blend;
    if (this.state.mode === "creative" && this.flying) {
      if (playing && this.keys.has("Space")) p.vel.y = 8.5;
      else if (playing && (this.keys.has("ShiftLeft") || this.keys.has("KeyC"))) p.vel.y = -8.5;
      else p.vel.y = 0;
    } else if (playing && this.keys.has("Space")) {
      if (p.inWater) {
        p.vel.y = Math.min(p.vel.y + 28 * dt, 4.2);
        const aboveFeet = this.world.get(
          Math.floor(p.pos.x),
          Math.floor(p.pos.y + 1.0),
          Math.floor(p.pos.z),
        );
        if (aboveFeet !== B.WATER) {
          p.vel.y = 8.0;
        }
      } else if (p.onGround) {
        p.vel.y = 8.6;
        this.hungerT += 0.5;
      }
    }
    if (p.inWater && wish.lengthSq() > 0 && p.hitWall) {
      const aboveHead = this.world.get(
        Math.floor(p.pos.x),
        Math.floor(p.pos.y + 1.2),
        Math.floor(p.pos.z),
      );
      if (aboveHead === B.AIR) {
        p.vel.y = Math.max(p.vel.y, 7.2);
      }
    }
    const prevGround = p.onGround;
    const prev = p.pos.clone();
    this.physics(p, dt);
    // sneaking: don't walk off edges
    if (sneak && prevGround && !p.onGround && p.vel.y <= 0) {
      p.pos.x = prev.x;
      p.pos.z = prev.z;
      p.pos.y = prev.y;
      p.vel.y = 0;
      p.onGround = true;
    }
    if (p.inWater) this.fallStart = p.pos.y;
    if (!p.onGround) this.fallStart = Math.max(this.fallStart, p.pos.y);
    else {
      const fall = this.fallStart - p.pos.y;
      if (fall > 3.5 && this.state.mode !== "creative") this.hurtPlayer(Math.floor(fall - 3));
      this.fallStart = p.pos.y;
    }
    if (p.pos.y < -30) {
      this.hurtPlayer(20);
    }
    if (
      this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)) === B.CACTUS ||
      this.touching(p, B.CACTUS)
    ) {
      if (st.hurt <= 0) this.hurtPlayer(1);
    }

    // hunger
    if (this.state.mode === "creative") {
      this.hungerT = 0;
      st.food = 20;
      st.hp = 20;
    } else {
      this.hungerT += dt * (sprint && wish.lengthSq() ? 3 : 1);
      if (this.hungerT > 30) {
        this.hungerT = 0;
        st.food = Math.max(0, st.food - 1);
        this.emit();
      }
      if (st.food >= 18 && st.hp < 20) {
        this.regenT += dt;
        if (this.regenT > 3) {
          this.regenT = 0;
          st.hp++;
          this.hungerT += 6;
          this.emit();
        }
      }
      if (st.food === 0) {
        this.starveT += dt;
        if (this.starveT > 4) {
          this.starveT = 0;
          if (st.hp > 1) this.hurtPlayer(1);
        }
      }
    }

    // camera
    const bob = p.onGround && wish.lengthSq() ? Math.sin(now() * 0.012) * 0.04 : 0;
    this.camera.position.set(p.pos.x, p.pos.y + (sneak ? 1.5 : 1.62) + bob, p.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.fov +=
      ((sprint && wish.lengthSq() ? 84 : 75) - this.camera.fov) * (1 - Math.exp(-8 * dt));
    this.camera.updateProjectionMatrix();

    // camera shake
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt * 2.5);
      this.camera.position.x += (Math.random() - 0.5) * this.camShake * 0.15;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake * 0.15;
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += dt;
      pt.vel.y -= GRAV * 0.3 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      const life = 1 - pt.age / pt.maxAge;
      if (life <= 0) {
        this.scene.remove(pt.mesh);
        pt.mesh.geometry.dispose();
        (pt.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      } else {
        pt.mesh.scale.setScalar(life);
      }
    }

    // update remote players
    for (const rp of this.remotePlayers.values()) {
      const prevPos = rp.pos.clone();
      rp.pos.lerp(rp.targetPos, 1 - Math.exp(-14 * dt));
      rp.model.root.position.copy(rp.pos);

      let dy = rp.targetYaw - rp.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      rp.yaw += dy * (1 - Math.exp(-12 * dt));
      rp.model.root.rotation.y = rp.yaw;

      if (rp.model.head) {
        rp.model.head.rotation.x = -rp.pitch;
      }

      const moveDist = rp.pos.distanceTo(prevPos);
      const spd = dt > 0 ? moveDist / dt : 0;
      rp.walk += spd * dt * 3;
      const rbob = animateMobGait(
        rp.model,
        "zombie" as any,
        rp.walk,
        Math.min(spd, 1),
        performance.now() / 1000,
      );
      rp.model.root.position.y += rbob;
    }

    // sync local state over websocket at 20Hz
    const nowTs = performance.now();
    if (this.ws && this.ws.readyState === WebSocket.OPEN && nowTs - this.lastMultiplayerSync > 50) {
      this.lastMultiplayerSync = nowTs;
      this.ws.send(
        JSON.stringify({
          type: "state",
          pos: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
          yaw: this.yaw,
          pitch: this.pitch,
          swing: this.handSwing,
          held: this.held(),
          hp: this.state.hp,
        }),
      );
    }

    // target + breaking
    const hit = playing ? this.raycast() : null;
    if (hit) {
      this.outline.visible = true;
      this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      const key = `${hit.x},${hit.y},${hit.z}`;
      if (this.mouseL && !(this.rayMob() && this.rayMob()!.t < hit.t)) {
        if (key !== this.breakTarget) {
          this.breakTarget = key;
          this.breakProgress = 0;
        }
        const info = breakInfo(hit.id, this.held());
        if (this.state.mode === "creative") {
          this.breakBlock(hit.x, hit.y, hit.z, hit.id, false);
          this.breakProgress = 0;
          this.breakTarget = null;
          sfx.dig(blockMat(hit.id));
          this.handSwing = Math.max(this.handSwing, 0.6);
        } else {
          this.breakProgress += dt / info.time;
          this.digT = (this.digT ?? 0) - dt;
          if (this.digT <= 0) {
            this.digT = 0.22;
            sfx.dig(blockMat(hit.id));
          }
          this.handSwing = Math.max(this.handSwing, 0.6);
          if (this.breakProgress >= 1) {
            this.breakBlock(hit.x, hit.y, hit.z, hit.id, info.drops);
            this.breakProgress = 0;
            this.breakTarget = null;
            this.hungerT += 0.3;
          }
        }
      } else this.breakProgress = 0;
      this.crack.visible = this.breakProgress > 0;
      this.crack.position.copy(this.outline.position);
      if (this.breakProgress > 0) {
        const stage = Math.min(9, Math.floor(this.breakProgress * 10));
        const cm = this.crack.material as THREE.MeshBasicMaterial;
        if (cm.userData["stage"] !== stage) {
          cm.userData["stage"] = stage;
          this.faSetRect(cm.map!, `block/destroy_stage_${stage}.png`);
        }
      }
      const name = BLOCKS[hit.id]?.name ?? null;
      if (st.target !== name) {
        st.target = name;
        this.emit();
      }
    } else {
      this.outline.visible = false;
      this.crack.visible = false;
      if (st.target) {
        st.target = null;
        this.emit();
      }
    }
    if (this.mouseL && playing) this.attack();

    // hand
    this.updateHand(dt);

    // world streaming
    this.stream();

    // environment
    const light = this.daylight();
    const day = new THREE.Color(0x8ec5ff),
      night = new THREE.Color(0x0a1022),
      dusk = new THREE.Color(0xf29a5a);
    const sunH = Math.sin(this.time * Math.PI * 2);
    const sky = night.clone().lerp(day, Math.min(1, Math.max(0, (light - 0.12) / 0.88)));
    if (Math.abs(sunH) < 0.25) sky.lerp(dusk, (1 - Math.abs(sunH) / 0.25) * 0.45);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.sun.intensity = 1.6 * light;
    this.hemi.intensity = 0.35 + 0.5 * light;
    const ang = this.time * Math.PI * 2;
    const sdir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    this.sun.position.copy(p.pos).addScaledVector(sdir, 50);
    this.sun.target.position.copy(p.pos);
    this.sunMesh.position.copy(this.camera.position).addScaledVector(sdir, 180);
    this.sunMesh.lookAt(this.camera.position);
    this.moonMesh.position.copy(this.camera.position).addScaledVector(sdir, -180);
    this.moonMesh.lookAt(this.camera.position);
    const phase = this.dayCount % 8;
    if (phase !== this.moonPhase) {
      this.moonPhase = phase;
      const names = [
        "full_moon",
        "waning_gibbous",
        "third_quarter",
        "waning_crescent",
        "new_moon",
        "waxing_crescent",
        "first_quarter",
        "waxing_gibbous",
      ];
      this.faSetRect(
        (this.moonMesh.material as THREE.MeshBasicMaterial).map!,
        `environment/celestial/moon/${names[phase]}.png`,
      );
    }
    if (playing && p.onGround && Math.hypot(p.vel.x, p.vel.z) > 1) {
      this.stepT -= dt * Math.hypot(p.vel.x, p.vel.z);
      if (this.stepT <= 0) {
        this.stepT = 1.6;
        const under = this.world.get(
          Math.floor(p.pos.x),
          Math.floor(p.pos.y - 0.1),
          Math.floor(p.pos.z),
        );
        if (under) sfx.step(blockMat(under));
      }
    }
    this.clouds.position.x += dt * 1.2;
    for (const c of this.clouds.children) {
      const wx = c.position.x + this.clouds.position.x - p.pos.x,
        wz = c.position.z - p.pos.z;
      if (wx > 150) c.position.x -= 300;
      if (wx < -150) c.position.x += 300;
      if (wz > 150) c.position.z -= 300;
      if (wz < -150) c.position.z += 300;
    }
    const firstCloud = this.clouds.children[0] as THREE.Mesh | undefined;
    if (firstCloud?.material) {
      (firstCloud.material as THREE.MeshLambertMaterial).emissive.setScalar(0.45 * light);
    }

    this.updateMobs(dt, light);
    this.updateDrops(dt);
    this.updateArrows(dt);

    st.time = this.time;
    st.day = this.dayCount;
    st.pos = [Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)];
  }

  touching(b: Body, id: number) {
    const w = b.w + 0.05;
    for (const [dx, dz] of [
      [w, 0],
      [-w, 0],
      [0, w],
      [0, -w],
    ])
      if (
        this.world.get(
          Math.floor(b.pos.x + dx),
          Math.floor(b.pos.y + 0.5),
          Math.floor(b.pos.z + dz),
        ) === id
      )
        return true;
    return false;
  }

  updateHand(dt: number) {
    const id = this.held();
    if (id !== this.handItem) {
      this.handItem = id;
      this.hand.clear();
      if (id) {
        const m = this.itemMesh(id, ITEMS[id]?.block ? 0.4 : 0.5);
        if (ITEMS[id]?.block) m.rotation.set(0.1, 0.7, 0);
        else m.rotation.set(0, -0.5, 0.1);
        this.hand.add(m);
      } else {
        const arm = buildArm();
        arm.position.set(0.05, -0.05, 0.1);
        arm.rotation.set(-Math.PI / 2 + 0.2, 0.1, 0);
        this.hand.add(arm);
      }
    }
    if (this.handSwing > 0) this.handSwing = Math.max(0, this.handSwing - dt * 3.2);
    // Actions & Stuff style: sway lags camera rotation, walk bob, arc slash with ease-out.
    const yaw = this.yaw,
      pitch = this.pitch;
    const dyaw = Math.atan2(Math.sin(yaw - this.lastYaw), Math.cos(yaw - this.lastYaw));
    this.lastYaw = yaw;
    const k = 1 - Math.exp(-10 * dt);
    this.swayX += (THREE.MathUtils.clamp(-dyaw * 6, -0.25, 0.25) - this.swayX) * k;
    this.swayY += ((pitch - this.lastPitch) * 6 - this.swayY) * k;
    this.lastPitch = pitch;
    const p = this.player.vel;
    const speed = Math.min(1.5, Math.hypot(p.x, p.z) / 4.3);
    this.walkT += dt * speed * 9;
    const bx = Math.sin(this.walkT) * 0.035 * speed,
      by = -Math.abs(Math.cos(this.walkT)) * 0.03 * speed;
    const t = 1 - this.handSwing; // 0..1 progress
    const s = this.handSwing > 0 ? Math.sin(t * Math.PI) : 0;
    const isSword = this.handItem && ITEMS[this.handItem]?.tool === "sword";
    const arc = isSword ? Math.sin(t * Math.PI * 1.0) : 0;
    this.hand.rotation.set(
      -s * 1.1 + this.swayY * 0.4,
      s * 0.5 + this.swayX + (isSword ? -arc * 0.9 : 0),
      isSword ? arc * 0.6 : s * 0.2,
    );
    this.hand.position.set(
      0.55 - s * 0.25 + bx + this.swayX * 0.3,
      -0.5 - s * 0.08 + by + this.swayY * 0.1,
      -0.8 + s * 0.12,
    );
  }

  streamT = 0;
  stream() {
    const pcx = Math.floor(this.player.pos.x / CS),
      pcz = Math.floor(this.player.pos.z / CS);
    let gen = 0;
    outer: for (let r = 0; r <= RENDER; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (!this.world.getChunk(pcx + dx, pcz + dz)) {
            this.world.ensureChunk(pcx + dx, pcz + dz);
            if (++gen >= 1) break outer;
          }
        }
    // mesh dirty chunks (closest first; edits always immediate)
    let meshed = 0;
    const list = [...this.world.chunks.values()]
      .filter((c) => c.dirty)
      .sort(
        (a, b) =>
          Math.abs(a.cx - pcx) +
          Math.abs(a.cz - pcz) -
          (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)),
      );
    for (const c of list) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > RENDER) continue;
      const near = d <= 1;
      if (!near && meshed >= 2) continue;
      // only mesh when all neighbours exist (avoids seams)
      if (
        !near &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([x, z]) => !this.world.getChunk(c.cx + x, c.cz + z))
      )
        continue;
      this.world.mesh(c);
      meshed++;
    }
    for (const c of this.world.chunks.values()) {
      const vis = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) <= RENDER;
      if (c.mesh) c.mesh.visible = vis;
      if (c.water) c.water.visible = vis;
    }
  }

  updateMobs(dt: number, light: number) {
    const p = this.player.pos;
    // spawning
    this.spawnT += dt;
    if (this.spawnT > 1.5) {
      this.spawnT = 0;
      const passive = this.mobs.filter((m) => !MOBS[m.type].hostile).length;
      const hostile = this.mobs.length - passive;
      const tryPos = (min: number, max: number) => {
        const a = Math.random() * 6.28,
          r = min + Math.random() * (max - min);
        const x = Math.floor(p.x + Math.cos(a) * r),
          z = Math.floor(p.z + Math.sin(a) * r);
        if (!this.world.getChunk(Math.floor(x / CS), Math.floor(z / CS))) return null;
        const y = this.world.topY(x, z);
        return { pos: new THREE.Vector3(x + 0.5, y + 1, z + 0.5), ground: this.world.get(x, y, z) };
      };
      if (passive < 12) {
        const t = tryPos(18, 48);
        if (t && t.ground === B.GRASS) {
          const types: MobType[] = ["pig", "cow", "sheep", "chicken"];
          const ty = types[Math.floor(Math.random() * 4)];
          for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++)
            this.spawnMob(ty, t.pos.clone().add(new THREE.Vector3(i * 0.8, 0, 0)));
        }
      }
      if (light < 0.4 && hostile < 10) {
        const t = tryPos(16, 36);
        if (t && t.ground !== B.WATER && t.ground !== B.LEAVES) {
          const types: MobType[] = ["zombie", "zombie", "skeleton", "creeper", "spider"];
          this.spawnMob(types[Math.floor(Math.random() * types.length)], t.pos);
        }
      }
    }
    for (const m of [...this.mobs]) {
      const spec = MOBS[m.type];
      const toP = new THREE.Vector3().subVectors(p, m.pos);
      const dist = toP.length();
      if (dist > 80) {
        this.killMob(m, false);
        continue;
      }
      m.hurt -= dt;
      m.atk -= dt;
      const move = new THREE.Vector2();
      let spd = spec.speed;
      if (spec.hostile && dist < 18 && !this.state.dead) {
        move.set(toP.x, toP.z).normalize();
        if (m.type === "skeleton" && dist < 8) move.multiplyScalar(-0.3);
        if (m.type === "skeleton" && dist < 16 && m.atk <= 0) {
          m.atk = 2.2;
          const from = m.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
          const dir = this.eye().sub(from);
          dir.y += dist * 0.08;
          dir.normalize();
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.5),
            new THREE.MeshLambertMaterial({ color: 0x6b4a2b }),
          );
          mesh.position.copy(from);
          this.scene.add(mesh);
          this.arrows.push({ pos: from, vel: dir.multiplyScalar(18), mesh, age: 0 });
        }
        if (m.type === "creeper") {
          if (dist < 3.2) {
            if (m.fuse === 0) sfx.fuse();
            m.fuse += dt;
            move.set(0, 0);
          } else if (dist > 5.5) {
            m.fuse = Math.max(0, m.fuse - dt * 1.5);
          } else if (m.fuse > 0) {
            m.fuse += dt;
            move.set(0, 0);
          }
          const flash = m.fuse > 0 && Math.floor(m.fuse * 9) % 2 === 0;
          for (const mat of m.model.mats) mat.emissive.setScalar(flash ? 0.85 : 0);
          m.model.root.scale.set(
            1 + m.fuse * 0.28,
            1 + m.fuse * 0.45,
            1 + m.fuse * 0.28,
          );
          if (m.fuse > 1.4) {
            this.killMob(m, false);
            this.explode(m.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 3.5);
            continue;
          }
        } else if (
          spec.damage &&
          dist < 1.4 &&
          Math.abs(toP.y) < 1.5 &&
          m.atk <= 0 &&
          m.type !== "skeleton"
        ) {
          m.atk = 1;
          this.hurtPlayer(spec.damage, m.pos);
        }
        if (m.type === "spider" && light > 0.6) {
          move.set(0, 0);
          spd = 0;
        }
      } else {
        m.wander -= dt;
        if (m.wander <= 0) {
          m.wander = 2 + Math.random() * 5;
          const a = Math.random() * 6.28;
          m.dir.set(Math.random() < 0.4 ? 0 : Math.cos(a), Math.sin(a));
          if (m.dir.x === 0) m.dir.set(0, 0);
        }
        move.copy(m.dir);
        if (m.hurt > 0) spd *= 2;
      }
      // burn in daylight
      if (
        (m.type === "zombie" || m.type === "skeleton") &&
        light > 0.7 &&
        this.world.topY(Math.floor(m.pos.x), Math.floor(m.pos.z)) < m.pos.y
      ) {
        m.burn += dt;
        if (m.burn > 1) {
          m.burn = 0;
          this.damageMob(m, 2, new THREE.Vector3());
          if (!this.mobs.includes(m)) continue;
        }
      }
      const blend = 1 - Math.exp(-(m.onGround ? 10 : 2) * dt);
      m.vel.x += (move.x * spd - m.vel.x) * blend;
      m.vel.z += (move.y * spd - m.vel.z) * blend;
      if (m.inWater) m.vel.y = Math.max(m.vel.y, 1.5);
      this.physics(m, dt);
      if (m.hitWall && m.onGround) m.vel.y = m.type === "spider" ? 6 : 8;
      if (move.lengthSq() > 0.01) {
        const ty = Math.atan2(move.x, move.y);
        let dy = ty - m.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        m.yaw += dy * (1 - Math.exp(-8 * dt));
      }
      const sp = Math.hypot(m.vel.x, m.vel.z);
      m.walk += sp * dt * 3;
      const sw = Math.sin(m.walk) * Math.min(1, sp) * 0.7;
      const bob = animateMobGait(m.model, m.type, m.walk, sp, this.time * 900 + m.yaw);
      const humanoid = m.type === "zombie" || m.type === "skeleton";
      if (m.type === "chicken")
        m.model.arms.forEach(
          (a, i) =>
            (a.rotation.z =
              (i ? -1 : 1) *
              (m.onGround ? Math.abs(sw) * 0.3 : 0.6 + Math.sin(this.time * 4000) * 0.6)),
        );
      else
        m.model.arms.forEach(
          (a, i) =>
            (a.rotation.x = humanoid
              ? (m.type === "skeleton" && dist < 16
                  ? -Math.PI / 2 + (m.model.head ? m.model.head.rotation.x * 0.7 : 0)
                  : -Math.PI / 2.2 + (i ? sw : -sw) * 0.2 + Math.sin(m.walk * 0.5 + i) * 0.05)
              : 0),
        );
      // Shared bob keeps the torso, wool, head and hip joints connected.
      m.model.root.rotation.z = m.hurt > 0 ? Math.sin(m.hurt * 20) * 0.12 : 0;
      if (!spec.hostile && m.model.head)
        m.model.head.rotation.x = sp < 0.2 ? Math.sin(this.time * 300 + m.yaw) * 0.25 + 0.2 : 0;
      if (Math.random() < dt * 0.04 && dist < 16) sfx.mob(m.type);
      if (m.model.head && spec.hostile && dist < 18)
        m.model.head.rotation.x = -Math.atan2(toP.y - 1, Math.hypot(toP.x, toP.z)) * 0.5;
      m.model.root.position.copy(m.pos);
      m.model.root.position.y += bob;
      m.model.root.rotation.y = m.yaw;
      if (m.type !== "creeper")
        for (const mat of m.model.mats) mat.emissive.setRGB(m.hurt > 0.2 ? 0.7 : 0, 0, 0);
    }
  }

  updateDrops(dt: number) {
    const p = this.player.pos;
    for (const d of [...this.drops]) {
      d.age += dt;
      this.physics(d, dt);
      d.vel.x *= Math.exp(-4 * dt);
      d.vel.z *= Math.exp(-4 * dt);
      const t = performance.now() / 1000;
      d.mesh.position.set(d.pos.x, d.pos.y + 0.18 + Math.sin(t * 2 + d.age) * 0.06, d.pos.z);
      d.mesh.rotation.y = t * 1.5;
      const dist = d.mesh.position.distanceTo(p.clone().setY(p.y + 0.8));
      if (d.age > 0.6 && dist < 1.8 && !this.state.dead) {
        d.pos.lerp(new THREE.Vector3(p.x, p.y + 0.6, p.z), 1 - Math.exp(-12 * dt));
        if (dist < 0.8) {
          const left = this.give(d.id, d.count);
          if (left === 0) {
            this.scene.remove(d.mesh);
            this.drops = this.drops.filter((x) => x !== d);
          } else d.count = left;
        }
      }
      if (d.age > 300) {
        this.scene.remove(d.mesh);
        this.drops = this.drops.filter((x) => x !== d);
      }
    }
  }

  updateArrows(dt: number) {
    for (const a of [...this.arrows]) {
      a.age += dt;
      a.vel.y -= 9 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.clone().add(a.vel));
      const pc = this.player.pos.clone().setY(this.player.pos.y + 0.9);
      let gone =
        a.age > 5 ||
        isSolid(this.world.get(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z)));
      if (
        !gone &&
        Math.abs(a.pos.x - pc.x) < 0.4 &&
        Math.abs(a.pos.z - pc.z) < 0.4 &&
        Math.abs(a.pos.y - pc.y) < 0.95
      ) {
        this.hurtPlayer(3, a.pos.clone().sub(a.vel));
        gone = true;
      }
      if (gone) {
        this.scene.remove(a.mesh);
        this.arrows = this.arrows.filter((x) => x !== a);
      }
    }
  }
}

const now = () => performance.now();
