import * as THREE from "three";
import pigT from "@/assets/mobs/pig_temperate.png.asset.json";
import cowT from "@/assets/mobs/cow_temperate.png.asset.json";
import sheepT from "@/assets/mobs/sheep.png.asset.json";
import woolT from "@/assets/mobs/sheep_wool.png.asset.json";
import chickenT from "@/assets/mobs/chicken_temperate.png.asset.json";
import zombieT from "@/assets/mobs/zombie.png.asset.json";
import skeletonT from "@/assets/mobs/skeleton.png.asset.json";
import creeperT from "@/assets/mobs/creeper.png.asset.json";
import spiderT from "@/assets/mobs/spider.png.asset.json";
import steveT from "@/assets/mobs/steve.png.asset.json";

export type MobType = "pig" | "cow" | "sheep" | "chicken" | "zombie" | "skeleton" | "creeper" | "spider";

export interface MobSpec {
  hp: number; w: number; h: number; speed: number; hostile: boolean; damage: number;
  drops: [string, number, number][]; // item, min, max
}

export const MOBS: Record<MobType, MobSpec> = {
  pig: { hp: 10, w: 0.45, h: 0.9, speed: 1.6, hostile: false, damage: 0, drops: [["raw_pork", 1, 3]] },
  cow: { hp: 10, w: 0.45, h: 1.4, speed: 1.5, hostile: false, damage: 0, drops: [["raw_beef", 1, 3], ["leather", 0, 2]] },
  sheep: { hp: 8, w: 0.45, h: 1.3, speed: 1.5, hostile: false, damage: 0, drops: [["b23", 1, 1], ["raw_beef", 0, 1]] },
  chicken: { hp: 4, w: 0.25, h: 0.7, speed: 1.4, hostile: false, damage: 0, drops: [["raw_chicken", 1, 1], ["feather", 0, 2]] },
  zombie: { hp: 20, w: 0.3, h: 1.9, speed: 2.6, hostile: true, damage: 3, drops: [["rotten_flesh", 0, 2]] },
  skeleton: { hp: 20, w: 0.3, h: 1.9, speed: 2.4, hostile: true, damage: 2, drops: [["bone", 0, 2]] },
  creeper: { hp: 20, w: 0.3, h: 1.7, speed: 2.4, hostile: true, damage: 0, drops: [["gunpowder", 0, 2]] },
  spider: { hp: 16, w: 0.65, h: 0.9, speed: 3.2, hostile: true, damage: 2, drops: [["string", 0, 2]] },
};

// Skins from the Faithful 32x pack (Java box-UV layout). Base sizes are in "model pixels" (texture is 2x).
const SKINS = {
  pig: [pigT.url, 64, 64], cow: [cowT.url, 64, 64], sheep: [sheepT.url, 64, 32], wool: [woolT.url, 64, 32],
  chicken: [chickenT.url, 64, 32], zombie: [zombieT.url, 64, 64], skeleton: [skeletonT.url, 64, 32],
  creeper: [creeperT.url, 64, 32], spider: [spiderT.url, 64, 32], steve: [steveT.url, 64, 64],
} as const;
type SkinKey = keyof typeof SKINS;

const texCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
export function skinTex(key: SkinKey) {
  const url = SKINS[key][0];
  let t = texCache.get(url);
  if (!t) {
    t = loader.load(url);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
    texCache.set(url, t);
  }
  return t;
}

const PX = 1 / 16;
/** BoxGeometry whose faces are UV-mapped with Minecraft's box-UV layout. Front = +Z. */
export function boxUV(w: number, h: number, d: number, u: number, v: number, tw: number, th: number, inflate = 0, scale = PX) {
  const g = new THREE.BoxGeometry((w + inflate * 2) * scale, (h + inflate * 2) * scale, (d + inflate * 2) * scale);
  const rects: [number, number, number, number][] = [
    [u + d + w, v + d, d, h], // +x (entity left)
    [u, v + d, d, h],         // -x (entity right)
    [u + d, v, w, d],         // +y top
    [u + d + w, v, w, d],     // -y bottom
    [u + d, v + d, w, h],     // +z front
    [u + 2 * d + w, v + d, w, h], // -z back
  ];
  const uv = g.attributes["uv"] as THREE.BufferAttribute;
  rects.forEach(([x, y, rw, rh], f) => {
    const u0 = x / tw, u1 = (x + rw) / tw, vt = 1 - y / th, vb = 1 - (y + rh) / th;
    uv.setXY(f * 4 + 0, u0, vt); uv.setXY(f * 4 + 1, u1, vt);
    uv.setXY(f * 4 + 2, u0, vb); uv.setXY(f * 4 + 3, u1, vb);
  });
  uv.needsUpdate = true;
  return g;
}

export interface MobModel { root: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; mats: THREE.MeshLambertMaterial[]; head?: THREE.Object3D; body?: THREE.Object3D }

export function buildMob(type: MobType): MobModel {
  const root = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const mats: THREE.MeshLambertMaterial[] = [];
  const matFor = (k: SkinKey) => {
    const m = new THREE.MeshLambertMaterial({ map: skinTex(k), alphaTest: 0.4, side: k === "wool" ? THREE.FrontSide : THREE.DoubleSide });
    mats.push(m); return m;
  };
  const main = matFor(type);
  const [, tw, th] = SKINS[type];
  /** add cube: size w,h,d at uv(u,v); center (x,y,z) in px relative to parent. */
  const cube = (parent: THREE.Object3D, w: number, h: number, d: number, u: number, v: number, x: number, y: number, z: number, opts: { rotX?: number; inflate?: number; mat?: THREE.Material; tw?: number; th?: number } = {}) => {
    const mesh = new THREE.Mesh(boxUV(w, h, d, u, v, opts.tw ?? tw, opts.th ?? th, opts.inflate ?? 0), opts.mat ?? main);
    mesh.position.set(x * PX, y * PX, z * PX);
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x: number, y: number, z: number, list?: THREE.Object3D[]) => {
    const g = new THREE.Group(); g.position.set(x * PX, y * PX, z * PX); root.add(g); list?.push(g); return g;
  };
  const R = Math.PI / 2;
  let head: THREE.Object3D | undefined;
  let body: THREE.Object3D | undefined;
  switch (type) {
    case "pig": {
      body = cube(root, 10, 16, 8, 28, 8, 0, 13, 0, { rotX: R });
      head = pivot(0, 12, 7);
      cube(head, 8, 8, 8, 0, 0, 0, 0, 4);
      cube(head, 4, 3, 1, 16, 16, 0, -1, 8.5);
      for (const [x, z] of [[-3, 5], [3, 5], [-3, -7], [3, -7]]) cube(pivot(x, 6, z, legs), 4, 6, 4, 0, 16, 0, -3, 0);
      break;
    }
    case "cow": {
      body = cube(root, 12, 18, 10, 18, 4, 0, 19, 0, { rotX: R });
      head = pivot(0, 20, 8);
      cube(head, 8, 8, 6, 0, 0, 0, 0, 3);
      cube(head, 1, 3, 1, 22, 0, -4.5, 4.5, 2);
      cube(head, 1, 3, 1, 22, 0, 4.5, 4.5, 2);
      for (const [x, z] of [[-4, 6], [4, 6], [-4, -7], [4, -7]]) cube(pivot(x, 12, z, legs), 4, 12, 4, 0, 16, 0, -6, 0);
      break;
    }
    case "sheep": {
      const wool = matFor("wool");
      body = cube(root, 8, 16, 6, 28, 8, 0, 18, 0, { rotX: R });
      cube(root, 8, 16, 6, 28, 8, 0, 18, 0, { rotX: R, inflate: 1.75, mat: wool });
      head = pivot(0, 20, 7);
      cube(head, 6, 6, 8, 0, 0, 0, 0, 3);
      cube(head, 6, 6, 6, 0, 0, 0, 0.5, 2, { inflate: 0.6, mat: wool });
      for (const [x, z] of [[-3, 5], [3, 5], [-3, -6], [3, -6]]) {
        const p = pivot(x, 12, z, legs);
        cube(p, 4, 12, 4, 0, 16, 0, -6, 0);
        cube(p, 4, 6, 4, 0, 16, 0, -3, 0, { inflate: 0.5, mat: wool });
      }
      break;
    }
    case "chicken": {
      body = cube(root, 6, 8, 6, 0, 9, 0, 8, 0, { rotX: R });
      head = pivot(0, 11, 3);
      cube(head, 4, 6, 3, 0, 0, 0, 2, 1);
      cube(head, 4, 2, 2, 14, 0, 0, 2, 3.5);
      cube(head, 2, 2, 2, 14, 4, 0, 0, 3);
      for (const s of [-1, 1]) cube(pivot(s * 3.5, 11, 0, arms), 1, 4, 6, 24, 13, 0, -2, 0);
      for (const x of [-1.5, 1.5]) cube(pivot(x, 5, 1, legs), 3, 5, 3, 26, 0, 0, -2.5, 0);
      break;
    }
    case "zombie":
    case "skeleton": {
      const thin = type === "skeleton";
      const lw = thin ? 2 : 4;
      body = cube(root, 8, 12, 4, 16, 16, 0, 18, 0);
      head = pivot(0, 24, 0);
      cube(head, 8, 8, 8, 0, 0, 0, 4, 0);
      for (const s of [-1, 1]) {
        const a = pivot(s * (4 + lw / 2), 22, 0, arms);
        cube(a, lw, 12, lw, 40, 16, 0, -4, 0);
      }
      for (const s of [-1, 1]) cube(pivot(s * 2, 12, 0, legs), lw, 12, lw, 0, 16, 0, -6, 0);
      break;
    }
    case "creeper": {
      body = cube(root, 8, 12, 4, 16, 16, 0, 12, 0);
      head = pivot(0, 18, 0);
      cube(head, 8, 8, 8, 0, 0, 0, 4, 0);
      for (const [x, z] of [[-2, 4], [2, 4], [-2, -4], [2, -4]]) cube(pivot(x, 6, z, legs), 4, 6, 4, 0, 16, 0, -3, 0);
      break;
    }
    case "spider": {
      cube(root, 6, 6, 6, 0, 0, 0, 9, 0);
      body = cube(root, 10, 8, 12, 0, 12, 0, 9, -9);
      head = pivot(0, 9, 3);
      cube(head, 8, 8, 8, 32, 4, 0, 0, 4);
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const p = pivot(side * 3, 9, 2 - (i % 4) * 2, legs);
        const m = cube(p, 16, 2, 2, 18, 0, side * 8, 0, 0);
        p.rotation.z = side * 0.55;
        void m;
      }
      break;
    }
  }
  return { root, legs, arms, mats, head, body };
}

/** First-person Steve arm (skin from the pack), pointing forward. */
export function buildArm() {
  const mat = new THREE.MeshLambertMaterial({ map: skinTex("steve") });
  const m = new THREE.Mesh(boxUV(4, 12, 4, 40, 16, 64, 64, 0, 0.058), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}
