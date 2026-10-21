// Builds Minecraft-style extruded 3D item models from a flat sprite (one voxel slab per opaque pixel).
import * as THREE from "three";
import faithful from "./packs/faithful.json";
import { itemCanvas } from "./icons";

const RECTS = (faithful as { rects: Record<string, number[]> }).rects;
const ALIASES: Record<string, string> = {
  raw_pork: "porkchop",
  cooked_pork: "cooked_porkchop",
  raw_beef: "beef",
  steak: "cooked_beef",
  raw_chicken: "chicken",
};

export function packSpriteKey(id: string) {
  const key = `item/${ALIASES[id] ?? id.replace(/^wood_/, "wooden_")}`;
  return RECTS[key] ? key : null;
}

const spriteCache = new Map<string, HTMLCanvasElement>();
/** The same pixels the inventory shows: the Faithful sprite when available, else the procedural icon. */
export function itemSprite(id: string, atlas: HTMLImageElement | null): HTMLCanvasElement {
  const hit = spriteCache.get(id);
  if (hit) return hit;
  const key = packSpriteKey(id);
  if (!key || !atlas) return itemCanvas(id);
  const [x, y, w, h] = RECTS[key];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(atlas, x, y, w, h, 0, 0, w, h);
  spriteCache.set(id, c);
  return c;
}

/** Extrude opaque pixels into a thin slab geometry centered on the origin, `size` wide. */
export function extrudeSprite(canvas: HTMLCanvasElement, size: number) {
  const W = canvas.width,
    H = canvas.height;
  const data = canvas.getContext("2d")!.getImageData(0, 0, W, H).data;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 127;
  const px = size / W,
    t = size / 16; // one "pixel" of a 16px item thick
  const pos: number[] = [],
    nor: number[] = [],
    uv: number[] = [];
  const quad = (
    a: number[],
    b: number[],
    c: number[],
    d: number[],
    n: number[],
    u: number,
    v: number,
  ) => {
    for (const p of [a, b, c, a, c, d]) {
      pos.push(...p);
      nor.push(...n);
      uv.push(u, v);
    }
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!solid(x, y)) continue;
      const x0 = -size / 2 + x * px,
        x1 = x0 + px,
        y1 = size / 2 - y * px,
        y0 = y1 - px,
        z0 = -t / 2,
        z1 = t / 2;
      const u = (x + 0.5) / W,
        v = 1 - (y + 0.5) / H;
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], u, v);
      quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], u, v);
      if (!solid(x - 1, y))
        quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], u, v);
      if (!solid(x + 1, y))
        quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], u, v);
      if (!solid(x, y - 1))
        quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], u, v);
      if (!solid(x, y + 1))
        quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], u, v);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const texCache = new WeakMap<HTMLCanvasElement, THREE.Texture>();
export function itemModel(id: string, size: number, atlas: HTMLImageElement | null) {
  const canvas = itemSprite(id, atlas);
  let tex = texCache.get(canvas);
  if (!tex) {
    tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(canvas, tex);
  }
  return new THREE.Mesh(extrudeSprite(canvas, size), new THREE.MeshLambertMaterial({ map: tex }));
}
