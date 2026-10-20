import * as THREE from "three";

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

const texCache = new Map<string, THREE.Texture>();
function pixelTex(base: string, spots?: string, seed = 1) {
  const k = base + (spots ?? "") + seed;
  const hit = texCache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const g = c.getContext("2d")!;
  const col = new THREE.Color(base);
  let s = seed * 9301;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const v = 0.85 + r() * 0.25;
      let cc = col.clone().multiplyScalar(v);
      if (spots && r() < 0.28) cc = new THREE.Color(spots).multiplyScalar(v);
      g.fillStyle = "#" + cc.getHexString();
      g.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

export interface MobModel { root: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; mats: THREE.MeshLambertMaterial[]; head?: THREE.Object3D }

export function buildMob(type: MobType): MobModel {
  const root = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const mats: THREE.MeshLambertMaterial[] = [];
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, spots?: string, parent: THREE.Object3D = root) => {
    const m = new THREE.MeshLambertMaterial({ map: pixelTex(color, spots, Math.floor(w * 100 + h * 10)) });
    mats.push(m);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const leg = (w: number, h: number, color: string, x: number, top: number, z: number) => {
    const piv = new THREE.Group();
    piv.position.set(x, top, z);
    box(w, h, w, color, 0, -h / 2, 0, undefined, piv);
    root.add(piv);
    legs.push(piv);
  };
  const eyes = (parent: THREE.Object3D, y: number, z: number, sep: number, color = "#111") => {
    box(0.1, 0.1, 0.02, "#fff", -sep, y, z, undefined, parent);
    box(0.1, 0.1, 0.02, "#fff", sep, y, z, undefined, parent);
    box(0.05, 0.1, 0.03, color, -sep + 0.025, y, z + 0.005, undefined, parent);
    box(0.05, 0.1, 0.03, color, sep - 0.025, y, z + 0.005, undefined, parent);
  };
  let head: THREE.Object3D | undefined;
  switch (type) {
    case "pig": {
      box(0.6, 0.55, 1.0, "#f0a3a8", 0, 0.6, 0);
      const h = new THREE.Group(); h.position.set(0, 0.75, 0.6); root.add(h); head = h;
      box(0.5, 0.5, 0.45, "#f0a3a8", 0, 0, 0, undefined, h);
      box(0.25, 0.15, 0.06, "#e57f8a", 0, -0.08, 0.25, undefined, h);
      eyes(h, 0.08, 0.23, 0.15);
      for (const [x, z] of [[-0.18, 0.35], [0.18, 0.35], [-0.18, -0.35], [0.18, -0.35]]) leg(0.2, 0.35, "#e68f96", x, 0.35, z);
      break;
    }
    case "cow": {
      box(0.75, 0.7, 1.15, "#4a3424", 0, 1.0, 0, "#e8e2d6");
      const h = new THREE.Group(); h.position.set(0, 1.25, 0.7); root.add(h); head = h;
      box(0.5, 0.5, 0.35, "#4a3424", 0, 0, 0, "#e8e2d6", h);
      box(0.3, 0.18, 0.05, "#d9a7a0", 0, -0.13, 0.19, undefined, h);
      box(0.08, 0.15, 0.08, "#ddd", -0.25, 0.27, 0, undefined, h);
      box(0.08, 0.15, 0.08, "#ddd", 0.25, 0.27, 0, undefined, h);
      eyes(h, 0.08, 0.18, 0.15);
      for (const [x, z] of [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]]) leg(0.24, 0.65, "#3a281b", x, 0.65, z);
      break;
    }
    case "sheep": {
      box(0.8, 0.7, 1.1, "#f2f0ea", 0, 0.95, 0, "#dedbd2");
      const h = new THREE.Group(); h.position.set(0, 1.15, 0.65); root.add(h); head = h;
      box(0.42, 0.42, 0.4, "#c9b8a6", 0, 0, 0, undefined, h);
      box(0.48, 0.15, 0.3, "#f2f0ea", 0, 0.2, -0.05, undefined, h);
      eyes(h, 0.05, 0.21, 0.12);
      for (const [x, z] of [[-0.22, 0.35], [0.22, 0.35], [-0.22, -0.35], [0.22, -0.35]]) leg(0.2, 0.6, "#c9b8a6", x, 0.6, z);
      break;
    }
    case "chicken": {
      box(0.4, 0.4, 0.5, "#fafafa", 0, 0.45, 0);
      const h = new THREE.Group(); h.position.set(0, 0.8, 0.25); root.add(h); head = h;
      box(0.25, 0.35, 0.2, "#fafafa", 0, 0, 0, undefined, h);
      box(0.25, 0.1, 0.15, "#f2a520", 0, 0, 0.15, undefined, h);
      box(0.1, 0.12, 0.08, "#d42020", 0, -0.12, 0.13, undefined, h);
      box(0.06, 0.25, 0.4, "#eeeeee", -0.23, 0.48, 0);
      box(0.06, 0.25, 0.4, "#eeeeee", 0.23, 0.48, 0);
      leg(0.06, 0.25, "#f2a520", -0.1, 0.25, 0);
      leg(0.06, 0.25, "#f2a520", 0.1, 0.25, 0);
      break;
    }
    case "zombie":
    case "skeleton": {
      const z = type === "zombie";
      const skin = z ? "#5f9b4f" : "#d8d8d0";
      const shirt = z ? "#2a9da8" : "#c4c4bc";
      const pants = z ? "#3b3f9a" : "#b4b4ac";
      const lw = z ? 0.25 : 0.12;
      box(0.5, 0.75, 0.25, shirt, 0, 1.125, 0);
      const h = new THREE.Group(); h.position.set(0, 1.75, 0); root.add(h); head = h;
      box(0.5, 0.5, 0.5, skin, 0, 0, 0, undefined, h);
      box(0.1, 0.08, 0.02, "#111", -0.12, 0.02, 0.255, undefined, h);
      box(0.1, 0.08, 0.02, "#111", 0.12, 0.02, 0.255, undefined, h);
      leg(lw, 0.75, pants, -0.125, 0.75, 0);
      leg(lw, 0.75, pants, 0.125, 0.75, 0);
      for (const x of [-0.375, 0.375]) {
        const piv = new THREE.Group(); piv.position.set(x, 1.45, 0);
        box(lw, 0.7, lw, skin, 0, -0.3, 0, undefined, piv);
        piv.rotation.x = -Math.PI / 2.2;
        root.add(piv); arms.push(piv);
      }
      break;
    }
    case "creeper": {
      box(0.5, 0.8, 0.28, "#4fae3e", 0, 0.75, 0, "#7ad06a");
      const h = new THREE.Group(); h.position.set(0, 1.4, 0); root.add(h); head = h;
      box(0.5, 0.5, 0.5, "#4fae3e", 0, 0, 0, "#7ad06a", h);
      box(0.12, 0.12, 0.02, "#111", -0.12, 0.08, 0.255, undefined, h);
      box(0.12, 0.12, 0.02, "#111", 0.12, 0.08, 0.255, undefined, h);
      box(0.12, 0.2, 0.02, "#111", 0, -0.08, 0.255, undefined, h);
      for (const [x, zz] of [[-0.13, 0.22], [0.13, 0.22], [-0.13, -0.22], [0.13, -0.22]]) leg(0.22, 0.35, "#3e8f30", x, 0.35, zz);
      break;
    }
    case "spider": {
      box(0.9, 0.55, 0.8, "#2e2722", 0, 0.55, -0.35, "#3c332c");
      box(0.45, 0.4, 0.4, "#2e2722", 0, 0.55, 0.15);
      const h = new THREE.Group(); h.position.set(0, 0.55, 0.5); root.add(h); head = h;
      box(0.5, 0.45, 0.4, "#2e2722", 0, 0, 0, undefined, h);
      box(0.08, 0.08, 0.02, "#d01010", -0.12, 0.08, 0.205, undefined, h);
      box(0.08, 0.08, 0.02, "#d01010", 0.12, 0.08, 0.205, undefined, h);
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const piv = new THREE.Group();
        piv.position.set(side * 0.2, 0.6, 0.3 - (i % 4) * 0.18);
        const m = box(0.9, 0.08, 0.08, "#2e2722", side * 0.45, 0, 0, undefined, piv);
        m.rotation.z = side * -0.5;
        root.add(piv); legs.push(piv);
      }
      break;
    }
  }
  return { root, legs, arms, mats, head };
}
