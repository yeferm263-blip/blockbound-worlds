import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, B, BLOCKS, isOpaque } from "./blocks";
import { hash, makeNoise } from "./noise";

export const CS = 16; // chunk size xz
export const CH = 72; // chunk height
export const SEA = 26;

const idx = (x: number, y: number, z: number) => x + z * CS + y * CS * CS;

// faces: dir, 4 corners, shade
const FACES = [
  {
    d: [1, 0, 0],
    c: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    s: 0.8,
    t: 1,
  },
  {
    d: [-1, 0, 0],
    c: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    s: 0.8,
    t: 1,
  },
  {
    d: [0, 1, 0],
    c: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    s: 1.0,
    t: 0,
  },
  {
    d: [0, -1, 0],
    c: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    s: 0.5,
    t: 2,
  },
  {
    d: [0, 0, 1],
    c: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    s: 0.65,
    t: 1,
  },
  {
    d: [0, 0, -1],
    c: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    s: 0.65,
    t: 1,
  },
] as const;

export function tileUV(i: number) {
  const e = 0.002;
  const col = i % ATLAS_COLS,
    row = Math.floor(i / ATLAS_COLS);
  const u0 = col / ATLAS_COLS + e,
    u1 = (col + 1) / ATLAS_COLS - e;
  const v1 = 1 - row / ATLAS_ROWS - e,
    v0 = 1 - (row + 1) / ATLAS_ROWS + e;
  return [u0, v0, u1, v1];
}

export class Chunk {
  data = new Uint8Array(CS * CS * CH);
  mesh: THREE.Mesh | null = null;
  water: THREE.Mesh | null = null;
  dirty = true;
  constructor(
    public cx: number,
    public cz: number,
  ) {}
}

export class World {
  chunks = new Map<string, Chunk>();
  noise;
  group = new THREE.Group();
  material: THREE.MeshLambertMaterial;
  waterMat: THREE.MeshLambertMaterial;
  constructor(
    public seed: number,
    texture: THREE.Texture,
  ) {
    this.noise = makeNoise(seed);
    this.material = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.FrontSide,
    });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
  }

  key(cx: number, cz: number) {
    return cx + "," + cz;
  }

  biome(x: number, z: number) {
    const t = this.noise.fbm2(x / 260 + 100, z / 260 - 50, 2);
    if (t > 0.18) return "desert";
    if (t < -0.2) return "snow";
    return this.noise.fbm2(x / 120 - 40, z / 120 + 20, 2) > 0.05 ? "forest" : "plains";
  }

  height(x: number, z: number) {
    const n = this.noise;
    const base = n.fbm2(x / 90, z / 90, 4);
    const mount = Math.max(0, n.fbm2(x / 200 + 300, z / 200, 3)) * 40;
    return Math.floor(SEA + 2 + base * 14 + mount);
  }

  treeAt(x: number, z: number) {
    const b = this.biome(x, z);
    const r = hash(x, 0, z, this.seed);
    const h = this.height(x, z);
    if (h <= SEA) return 0;
    if (b === "forest" && r < 0.03) return hash(x, 1, z, this.seed) < 0.3 ? 2 : 1;
    if (b === "plains" && r < 0.004) return 1;
    if (b === "desert" && r < 0.006) return 3; // cactus
    return 0;
  }

  generate(c: Chunk) {
    const n = this.noise;
    const ox = c.cx * CS,
      oz = c.cz * CS;
    for (let x = 0; x < CS; x++)
      for (let z = 0; z < CS; z++) {
        const wx = ox + x,
          wz = oz + z;
        const h = Math.min(CH - 10, this.height(wx, wz));
        const biome = this.biome(wx, wz);
        for (let y = 0; y < CH; y++) {
          let id: number = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y < h - 3) {
            id = B.STONE;
            const r = hash(wx, y, wz, this.seed);
            if (r < 0.012) id = B.COAL_ORE;
            else if (r < 0.018 && y < 40) id = B.IRON_ORE;
            else if (r < 0.0205 && y < 22) id = B.GOLD_ORE;
            else if (r < 0.022 && y < 14) id = B.DIAMOND_ORE;
            else if (r < 0.03 && y < 30) id = B.GRAVEL;
          } else if (y < h) id = biome === "desert" || h <= SEA + 1 ? B.SAND : B.DIRT;
          else if (y === h) {
            if (h <= SEA + 1) id = biome === "snow" ? B.SNOW : B.SAND;
            else id = biome === "desert" ? B.SAND : biome === "snow" ? B.SNOW : B.GRASS;
          } else if (y <= SEA) id = biome === "snow" && y === SEA ? B.ICE : B.WATER;
          // caves
          if (id !== B.AIR && id !== B.WATER && id !== B.BEDROCK && y > 2 && y < h - 2) {
            const cv = n.noise3(wx / 22, y / 14, wz / 22) + n.noise3(wx / 9, y / 9, wz / 9) * 0.3;
            if (cv > 0.42) id = B.AIR;
          }
          c.data[idx(x, y, z)] = id;
        }
      }
    // trees (including from neighbors overlapping this chunk)
    for (let x = -3; x < CS + 3; x++)
      for (let z = -3; z < CS + 3; z++) {
        const wx = ox + x,
          wz = oz + z;
        const t = this.treeAt(wx, wz);
        if (!t) continue;
        const h = this.height(wx, wz);
        const set = (lx: number, y: number, lz: number, id: number, onlyAir = true) => {
          if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= CH) return;
          const i = idx(lx, y, lz);
          if (onlyAir && c.data[i] !== B.AIR) return;
          c.data[i] = id;
        };
        if (t === 3) {
          if (x >= 0 && x < CS && z >= 0 && z < CS && c.data[idx(x, h, z)] !== B.SAND) continue;
          let blocked = false;
          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (this.height(wx + dx, wz + dz) >= h + 1) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;
          const ch = 1 + Math.floor(hash(wx, 3, wz) * 3);
          for (let y = 1; y <= ch; y++) set(x, h + y, z, B.CACTUS, false);
          continue;
        }
        const th = 4 + Math.floor(hash(wx, 2, wz, this.seed) * 3);
        const log = t === 2 ? B.BIRCH_LOG : B.LOG;
        for (let dy = th - 2; dy <= th + 1; dy++) {
          const r = dy >= th ? 1 : 2;
          for (let dx = -r; dx <= r; dx++)
            for (let dz = -r; dz <= r; dz++) {
              if (
                Math.abs(dx) === r &&
                Math.abs(dz) === r &&
                (dy === th + 1 || hash(wx + dx, dy, wz + dz) < 0.5)
              )
                continue;
              set(x + dx, h + dy, z + dz, B.LEAVES);
            }
        }
        for (let y = 1; y <= th; y++) set(x, h + y, z, log, false);
        set(x, h, z, B.DIRT, false);
      }
  }

  getChunk(cx: number, cz: number) {
    return this.chunks.get(this.key(cx, cz));
  }

  ensureChunk(cx: number, cz: number) {
    let c = this.getChunk(cx, cz);
    if (!c) {
      c = new Chunk(cx, cz);
      this.generate(c);
      this.chunks.set(this.key(cx, cz), c);
      // neighbours need remesh for border faces
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nb = this.getChunk(cx + dx, cz + dz);
        if (nb) nb.dirty = true;
      }
    }
    return c;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK;
    if (y >= CH) return B.AIR;
    const cx = Math.floor(x / CS),
      cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    if (!c) return B.AIR;
    return c.data[idx(x - cx * CS, y, z - cz * CS)];
  }

  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CH) return;
    const cx = Math.floor(x / CS),
      cz = Math.floor(z / CS);
    const c = this.getChunk(cx, cz);
    if (!c) return;
    const lx = x - cx * CS,
      lz = z - cz * CS;
    c.data[idx(lx, y, lz)] = id;
    c.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CS - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CS - 1) this.markDirty(cx, cz + 1);
  }
  markDirty(cx: number, cz: number) {
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
  }

  topY(x: number, z: number) {
    for (let y = CH - 1; y > 0; y--) {
      const b = this.get(x, y, z);
      if (b && b !== B.LEAVES && b !== B.WATER) return y;
    }
    return 0;
  }

  mesh(c: Chunk) {
    const solid = {
      p: [] as number[],
      uv: [] as number[],
      col: [] as number[],
      ix: [] as number[],
    };
    const water = {
      p: [] as number[],
      uv: [] as number[],
      col: [] as number[],
      ix: [] as number[],
    };
    const ox = c.cx * CS,
      oz = c.cz * CS;
    for (let y = 0; y < CH; y++)
      for (let z = 0; z < CS; z++)
        for (let x = 0; x < CS; x++) {
          const id = c.data[idx(x, y, z)];
          if (!id) continue;
          const def = BLOCKS[id];
          const isWater = !!def.liquid;
          const target = isWater ? water : solid;
          for (const f of FACES) {
            const nx = x + f.d[0],
              ny = y + f.d[1],
              nz = z + f.d[2];
            const nb =
              nx >= 0 && nx < CS && nz >= 0 && nz < CS
                ? ny < 0 || ny >= CH
                  ? 0
                  : c.data[idx(nx, ny, nz)]
                : this.get(ox + nx, ny, oz + nz);
            if (isWater) {
              if (nb === id || isOpaque(nb)) continue;
            } else if (isOpaque(nb) || (nb === id && def.transparent && id !== B.LEAVES)) continue;
            const tile = def.tex[f.t];
            const [u0, v0, u1, v1] = tileUV(tile);
            const base = target.p.length / 3;
            const wTop =
              isWater && f.d[1] === 1 && this.get(ox + x, y + 1, oz + z) !== B.WATER ? -0.12 : 0;
            for (const cr of f.c)
              target.p.push(ox + x + cr[0], y + cr[1] + (cr[1] === 1 ? wTop : 0), oz + z + cr[2]);
            target.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
            const s = f.s;
            for (let k = 0; k < 4; k++) target.col.push(s, s, s);
            target.ix.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
    const build = (d: typeof solid, mat: THREE.Material, old: THREE.Mesh | null) => {
      if (old) {
        this.group.remove(old);
        old.geometry.dispose();
      }
      if (!d.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(d.p, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(d.col, 3));
      g.setIndex(d.ix);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      this.group.add(m);
      return m;
    };
    c.mesh = build(solid, this.material, c.mesh);
    c.water = build(water, this.waterMat, c.water);
    if (c.water) c.water.renderOrder = 1;
    c.dirty = false;
  }

  unload(c: Chunk) {
    for (const m of [c.mesh, c.water])
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    this.chunks.delete(this.key(c.cx, c.cz));
  }
}
