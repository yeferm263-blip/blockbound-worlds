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

export type MobType =
  "pig" | "cow" | "sheep" | "chicken" | "zombie" | "skeleton" | "creeper" | "spider";

export interface MobSpec {
  hp: number;
  w: number;
  h: number;
  speed: number;
  hostile: boolean;
  damage: number;
  drops: [string, number, number][]; // item, min, max
}

export const MOBS: Record<MobType, MobSpec> = {
  pig: {
    hp: 10,
    w: 0.45,
    h: 0.9,
    speed: 1.6,
    hostile: false,
    damage: 0,
    drops: [["raw_pork", 1, 3]],
  },
  cow: {
    hp: 10,
    w: 0.45,
    h: 1.4,
    speed: 1.5,
    hostile: false,
    damage: 0,
    drops: [
      ["raw_beef", 1, 3],
      ["leather", 0, 2],
    ],
  },
  sheep: {
    hp: 8,
    w: 0.45,
    h: 1.3,
    speed: 1.5,
    hostile: false,
    damage: 0,
    drops: [
      ["b23", 1, 1],
      ["raw_beef", 0, 1],
    ],
  },
  chicken: {
    hp: 4,
    w: 0.25,
    h: 0.7,
    speed: 1.4,
    hostile: false,
    damage: 0,
    drops: [
      ["raw_chicken", 1, 1],
      ["feather", 0, 2],
    ],
  },
  zombie: {
    hp: 20,
    w: 0.3,
    h: 1.9,
    speed: 2.6,
    hostile: true,
    damage: 3,
    drops: [["rotten_flesh", 0, 2]],
  },
  skeleton: {
    hp: 20,
    w: 0.3,
    h: 1.9,
    speed: 2.4,
    hostile: true,
    damage: 2,
    drops: [["bone", 0, 2]],
  },
  creeper: {
    hp: 20,
    w: 0.3,
    h: 1.7,
    speed: 2.4,
    hostile: true,
    damage: 0,
    drops: [["gunpowder", 0, 2]],
  },
  spider: {
    hp: 16,
    w: 0.65,
    h: 0.9,
    speed: 3.2,
    hostile: true,
    damage: 2,
    drops: [["string", 0, 2]],
  },
};

// Skins from the Faithful 32x pack (Java box-UV layout). Base sizes are in "model pixels" (texture is 2x).
const SKINS = {
  pig: [pigT.url, 64, 64],
  cow: [cowT.url, 64, 64],
  sheep: [sheepT.url, 64, 32],
  wool: [woolT.url, 64, 32],
  chicken: [chickenT.url, 64, 32],
  zombie: [zombieT.url, 64, 64],
  skeleton: [skeletonT.url, 64, 32],
  creeper: [creeperT.url, 64, 32],
  spider: [spiderT.url, 64, 32],
  steve: [steveT.url, 64, 64],
} as const;
type SkinKey = keyof typeof SKINS;

const texCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
export function skinTex(key: SkinKey) {
  const url = SKINS[key][0];
  let t = texCache.get(url);
  if (!t) {
    t = loader.load(url);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    texCache.set(url, t);
  }
  return t;
}

const PX = 1 / 16;
/** BoxGeometry whose faces are UV-mapped with Minecraft's box-UV layout. Front = +Z. */
export function boxUV(
  w: number,
  h: number,
  d: number,
  u: number,
  v: number,
  tw: number,
  th: number,
  inflate = 0,
  scale = PX,
  extraH = 0,
) {
  const g = new THREE.BoxGeometry(
    (w + inflate * 2) * scale,
    (h + extraH + inflate * 2) * scale,
    (d + inflate * 2) * scale,
  );
  const rects: [number, number, number, number][] = [
    [u + d + w, v + d, d, h], // +x (entity left)
    [u, v + d, d, h], // -x (entity right)
    [u + d, v, w, d], // +y top
    [u + d + w, v, w, d], // -y bottom
    [u + d, v + d, w, h], // +z front
    [u + 2 * d + w, v + d, w, h], // -z back
  ];
  const uv = g.attributes["uv"] as THREE.BufferAttribute;
  rects.forEach(([x, y, rw, rh], f) => {
    const u0 = x / tw,
      u1 = (x + rw) / tw,
      vt = 1 - y / th,
      vb = 1 - (y + rh) / th;
    uv.setXY(f * 4 + 0, u0, vt);
    uv.setXY(f * 4 + 1, u1, vt);
    uv.setXY(f * 4 + 2, u0, vb);
    uv.setXY(f * 4 + 3, u1, vb);
  });
  uv.needsUpdate = true;
  return g;
}

export interface MobModel {
  root: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  mats: THREE.MeshLambertMaterial[];
  head?: THREE.Object3D;
  body?: THREE.Object3D;
}

export function buildMob(type: MobType): MobModel {
  const root = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const mats: THREE.MeshLambertMaterial[] = [];
  const matFor = (k: SkinKey) => {
    const m = new THREE.MeshLambertMaterial({
      map: skinTex(k),
      alphaTest: 0.4,
      side: k === "wool" ? THREE.FrontSide : THREE.DoubleSide,
    });
    mats.push(m);
    return m;
  };
  const main = matFor(type);
  const [, tw, th] = SKINS[type];
  /** add cube: size w,h,d at uv(u,v); center (x,y,z) in px relative to parent. */
  const cube = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    u: number,
    v: number,
    x: number,
    y: number,
    z: number,
    opts: {
      rotX?: number;
      inflate?: number;
      mat?: THREE.Material;
      tw?: number;
      th?: number;
      hip?: number;
    } = {},
  ) => {
    // `hip` extends a limb upward into the torso so the joint never shows a gap while swinging.
    const hip = opts.hip ?? 0;
    const mesh = new THREE.Mesh(
      boxUV(w, h, d, u, v, opts.tw ?? tw, opts.th ?? th, opts.inflate ?? 0, PX, hip),
      opts.mat ?? main,
    );
    mesh.position.set(x * PX, (y + hip / 2) * PX, z * PX);
    if (opts.rotX) mesh.rotation.x = opts.rotX;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x: number, y: number, z: number, list?: THREE.Object3D[]) => {
    const g = new THREE.Group();
    g.position.set(x * PX, y * PX, z * PX);
    root.add(g);
    list?.push(g);
    return g;
  };
  const R = Math.PI / 2;
  let head: THREE.Object3D | undefined;
  let body: THREE.Object3D | undefined;
  switch (type) {
    case "pig": {
      body = cube(root, 10, 16, 8, 28, 8, 0, 10, 0, { rotX: R });
      head = pivot(0, 12, 7);
      cube(head, 8, 8, 8, 0, 0, 0, 0, 4);
      cube(head, 4, 3, 1, 16, 16, 0, -1, 8.5);
      for (const [x, z] of [
        [-3, 5],
        [3, 5],
        [-3, -7],
        [3, -7],
      ])
        cube(pivot(x, 6, z, legs), 4, 6, 4, 0, 16, 0, -3, 0, { hip: 3 });
      break;
    }
    case "cow": {
      body = cube(root, 12, 18, 10, 18, 4, 0, 17, 0, { rotX: R });
      head = pivot(0, 20, 8);
      cube(head, 8, 8, 6, 0, 0, 0, 0, 3);
      cube(head, 1, 3, 1, 22, 0, -4.5, 4.5, 2);
      cube(head, 1, 3, 1, 22, 0, 4.5, 4.5, 2);
      for (const [x, z] of [
        [-4, 6],
        [4, 6],
        [-4, -7],
        [4, -7],
      ])
        cube(pivot(x, 12, z, legs), 4, 12, 4, 0, 16, 0, -6, 0, { hip: 3 });
      break;
    }
    case "sheep": {
      const wool = matFor("wool");
      body = cube(root, 8, 16, 6, 28, 8, 0, 15, 0, { rotX: R });
      cube(root, 8, 16, 6, 28, 8, 0, 15, 0, { rotX: R, inflate: 1.75, mat: wool });
      head = pivot(0, 20, 7);
      cube(head, 6, 6, 8, 0, 0, 0, 0, 3);
      cube(head, 6, 6, 6, 0, 0, 0, 0.5, 2, { inflate: 0.6, mat: wool });
      for (const [x, z] of [
        [-3, 5],
        [3, 5],
        [-3, -6],
        [3, -6],
      ]) {
        const p = pivot(x, 12, z, legs);
        cube(p, 4, 12, 4, 0, 16, 0, -6, 0, { hip: 3 });
        cube(p, 4, 6, 4, 0, 16, 0, -3, 0, { inflate: 0.5, mat: wool, hip: 2 });
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
      for (const s of [-1, 1])
        cube(pivot(s * 2, 12, 0, legs), lw, 12, lw, 0, 16, 0, -6, 0, { hip: 2 });
      if (type === "skeleton" && arms[0]) {
        const bow = buildBowMesh(mats);
        // Position bow in the right hand (bottom of arm)
        bow.position.set(0, -10 * PX, 1.2 * PX);
        bow.rotation.set(Math.PI / 2, 0, 0);
        arms[0].add(bow);
      }
      break;
    }
    case "creeper": {
      body = cube(root, 8, 12, 4, 16, 16, 0, 12, 0);
      head = pivot(0, 18, 0);
      cube(head, 8, 8, 8, 0, 0, 0, 4, 0);
      for (const [x, z] of [
        [-2, 2],
        [2, 2],
        [-2, -2],
        [2, -2],
      ])
        cube(pivot(x, 6, z, legs), 4, 6, 4, 0, 16, 0, -3, 0, { hip: 3 });
      break;
    }
    case "spider": {
      // Spider thorax (center body) at Y=6
      cube(root, 6, 6, 6, 0, 0, 0, 6, 0);
      // Spider abdomen (rear body) at Y=7, extending backward
      body = cube(root, 10, 8, 12, 0, 12, 0, 7, -8);
      // Spider head with red eyes facing forward (+Z) at Y=6
      head = pivot(0, 6, 4);
      cube(head, 8, 8, 8, 32, 4, 0, 0, 3);
      // 8 arched legs:
      // Legs rise up & out from thorax (knee high above back), then bend down to ground
      const zOffsets = [3, 1, -1, -3];
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const legZ = zOffsets[i % 4];
        // Leg pivot attached to thorax side
        const p = pivot(side * 3, 6, legZ, legs);

        // Upper leg (femur): extends outward and arches UPWARD
        const femur = new THREE.Group();
        p.add(femur);
        // Slant upward so knees are elevated above the back
        femur.rotation.z = side * 0.35;
        cube(femur, 8, 2, 2, 18, 0, side * 4, 0, 0);

        // Knee joint at the end of the upper leg
        const knee = new THREE.Group();
        knee.position.set(side * 8 * PX, 0, 0);
        // Bend downward and outward so the tibia slopes down to the ground
        knee.rotation.z = -side * 0.95;
        femur.add(knee);

        // Lower leg (tibia): points down toward ground level
        cube(knee, 2, 9, 2, 18, 0, side * 1, -4.5, 0);

        // Natural leg spread fan angles
        const spreadY = (1.5 - (i % 4)) * 0.32 * side;
        p.rotation.y = spreadY;
      }
      break;
    }
  }
  return { root, legs, arms, mats, head, body };
}

/** 3D wooden bow for skeletons and players with proper curved shape and visible white string. */
export function buildBowMesh(mats?: THREE.MeshLambertMaterial[]) {
  const g = new THREE.Group();
  // Warm Minecraft oak wood with slight emissive to guarantee visibility in low light and night
  const woodMat = new THREE.MeshLambertMaterial({
    color: 0x935a2a,
    emissive: new THREE.Color(0x28180c),
  });
  const darkWood = new THREE.MeshLambertMaterial({
    color: 0x5a3416,
    emissive: new THREE.Color(0x1c1008),
  });
  const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  if (mats) {
    mats.push(woodMat, darkWood);
  }

  // Center wooden grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), darkWood);
  grip.castShadow = true;
  g.add(grip);

  // Upper riser (angling forward)
  const topMid = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.075), woodMat);
  topMid.position.set(0, 0.2, 0.06);
  topMid.rotation.x = -0.28;
  topMid.castShadow = true;
  g.add(topMid);

  // Upper tip
  const topTip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.22, 0.068), darkWood);
  topTip.position.set(0, 0.4, 0.16);
  topTip.rotation.x = -0.55;
  topTip.castShadow = true;
  g.add(topTip);

  // Lower riser (angling forward)
  const botMid = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.075), woodMat);
  botMid.position.set(0, -0.2, 0.06);
  botMid.rotation.x = 0.28;
  botMid.castShadow = true;
  g.add(botMid);

  // Lower tip
  const botTip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.22, 0.068), darkWood);
  botTip.position.set(0, -0.4, 0.16);
  botTip.rotation.x = 0.55;
  botTip.castShadow = true;
  g.add(botTip);

  // Taut white bowstring connecting tips (bold enough to be crisp and visible at any distance)
  const string = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.94, 0.035), stringMat);
  string.position.set(0, 0, -0.02);
  g.add(string);

  return g;
}

/** Rotate at the hip; move the complete model together, never just the torso. */
export function animateMobGait(
  model: MobModel,
  type: MobType,
  phase: number,
  speed: number,
  time: number,
) {
  const swing = Math.sin(phase) * Math.min(1, speed) * (model.legs.length === 4 ? 0.5 : 0.7);
  model.legs.forEach((leg, i) => {
    if (type === "spider") {
      const side = i < 4 ? -1 : 1;
      const baseSpread = (1.5 - (i % 4)) * 0.32 * side;
      // Walking ripple alternating legs forward/backward
      const legCycle = Math.sin(phase + (i % 4) * 1.57 + (side < 0 ? 0 : Math.PI));
      leg.rotation.y = baseSpread + legCycle * 0.3 * Math.min(1, speed);
      leg.rotation.x = legCycle * 0.15 * Math.min(1, speed);
    } else {
      const diagonal = model.legs.length === 4 ? i === 0 || i === 3 : i % 2 === 0;
      leg.rotation.x = diagonal ? swing : -swing;
    }
  });
  return Math.abs(swing) * 0.02 + Math.sin(time) * 0.006;
}

/** First-person player arm, pointing forward. */
export function buildArm(customTexture?: THREE.Texture | string) {
  let map: THREE.Texture;
  if (customTexture instanceof THREE.Texture) {
    map = customTexture;
  } else if (typeof customTexture === "string" && customTexture.length > 0) {
    map = new THREE.TextureLoader().load(customTexture);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.colorSpace = THREE.SRGBColorSpace;
  } else {
    map = skinTex("steve");
  }
  const mat = new THREE.MeshLambertMaterial({
    map,
    emissive: new THREE.Color(0x383838),
  });
  const m = new THREE.Mesh(boxUV(4, 12, 4, 40, 16, 64, 64, 0, 0.058), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Full 3D Steve or custom skin model. */
export function buildPlayerModel(customTexture?: THREE.Texture | string): MobModel {
  const root = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const arms: THREE.Object3D[] = [];
  const mats: THREE.MeshLambertMaterial[] = [];

  let map: THREE.Texture;
  if (customTexture instanceof THREE.Texture) {
    map = customTexture;
  } else if (typeof customTexture === "string" && customTexture.length > 0) {
    map = new THREE.TextureLoader().load(customTexture);
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = false;
  } else {
    map = skinTex("steve");
  }

  const mat = new THREE.MeshLambertMaterial({
    map,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
  });
  mats.push(mat);
  const tw = 64,
    th = 64;
  const cube = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    u: number,
    v: number,
    x: number,
    y: number,
    z: number,
    opts: { inflate?: number; hip?: number } = {},
  ) => {
    const hip = opts.hip ?? 0;
    const mesh = new THREE.Mesh(boxUV(w, h, d, u, v, tw, th, opts.inflate ?? 0, PX, hip), mat);
    mesh.position.set(x * PX, (y + hip / 2) * PX, z * PX);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x: number, y: number, z: number, list?: THREE.Object3D[]) => {
    const g = new THREE.Group();
    g.position.set(x * PX, y * PX, z * PX);
    root.add(g);
    list?.push(g);
    return g;
  };

  const body = cube(root, 8, 12, 4, 16, 16, 0, 18, 0);
  const head = pivot(0, 24, 0);
  cube(head, 8, 8, 8, 0, 0, 0, 4, 0);
  cube(head, 8, 8, 8, 32, 0, 0, 4, 0, { inflate: 0.5 });
  for (const s of [-1, 1]) {
    const a = pivot(s * 6, 22, 0, arms);
    cube(a, 4, 12, 4, 40, 16, 0, -4, 0);
  }
  for (const s of [-1, 1]) {
    const p = pivot(s * 2, 12, 0, legs);
    cube(p, 4, 12, 4, 0, 16, 0, -6, 0, { hip: 2 });
  }
  return { root, legs, arms, mats, head, body };
}
